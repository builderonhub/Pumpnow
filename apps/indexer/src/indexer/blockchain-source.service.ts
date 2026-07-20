import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  createPublicClient,
  decodeEventLog,
  getAbiItem,
  http,
  isAddress,
  type Abi,
  type AbiEvent,
  type Address,
  type Hex,
  type Log,
  type PublicClient,
} from "viem";
import { AbiLoader } from "./abi.loader";
import type { IndexedLog } from "./indexer.types";

type Args = Record<string, unknown>;
const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

@Injectable()
export class BlockchainSourceService {
  readonly chainId: bigint;
  readonly factoryAddress: Address;
  private readonly client: PublicClient;
  private readonly factoryAbi: Abi;
  private readonly pairAbi: Abi;
  private readonly treasuryAbi: Abi;
  private treasuryAddress?: Address;

  constructor(config: ConfigService, abiLoader: AbiLoader) {
    const rpcUrl = config.getOrThrow<string>("RPC_URL");
    const factory = config.getOrThrow<string>("PUMP_FACTORY_ADDRESS");
    if (!isAddress(factory)) throw new Error("PUMP_FACTORY_ADDRESS is invalid");
    this.factoryAddress = factory;
    this.chainId = BigInt(config.getOrThrow<string>("CHAIN_ID"));
    this.client = createPublicClient({ transport: http(rpcUrl) });
    this.factoryAbi = abiLoader.load("PumpFactory");
    this.pairAbi = abiLoader.load("PumpPair");
    this.treasuryAbi = abiLoader.load("Treasury");
  }

  latestBlock(): Promise<bigint> {
    return this.client.getBlockNumber();
  }
  async blockHash(blockNumber: bigint): Promise<Hex> {
    const block = await this.client.getBlock({ blockNumber });
    if (!block.hash) throw new Error(`Missing hash for block ${blockNumber}`);
    return block.hash;
  }

  async logs(fromBlock: bigint, toBlock: bigint): Promise<IndexedLog[]> {
    const treasuryAddress = await this.getTreasuryAddress();
    const events: Array<{ address?: Address; event: AbiEvent }> = [
      {
        address: this.factoryAddress,
        event: getAbiItem({
          abi: this.factoryAbi,
          name: "TokenCreated",
        }) as AbiEvent,
      },
      { event: getAbiItem({ abi: this.pairAbi, name: "Buy" }) as AbiEvent },
      { event: getAbiItem({ abi: this.pairAbi, name: "Sell" }) as AbiEvent },
      {
        event: getAbiItem({ abi: this.pairAbi, name: "Graduated" }) as AbiEvent,
      },
      {
        address: treasuryAddress,
        event: getAbiItem({
          abi: this.treasuryAbi,
          name: "FeeCollected",
        }) as AbiEvent,
      },
    ];
    // Arc's public RPC does not reliably support OR-ed event topics and also
    // rate-limits bursts. Retry each event independently and pace requests so
    // progress on earlier event types is not discarded by a later throttle.
    const groups: Log[][] = [];
    for (const [index, { address, event }] of events.entries()) {
      if (index > 0) await wait(750);
      groups.push(
        await this.getLogsWithRetry(address, event, fromBlock, toBlock),
      );
    }
    const raw = groups
      .flat()
      .sort(
        (a, b) =>
          Number((a.blockNumber ?? 0n) - (b.blockNumber ?? 0n)) ||
          (a.logIndex ?? 0) - (b.logIndex ?? 0),
      );
    const timestamps = new Map<bigint, Date>();
    const output: IndexedLog[] = [];
    for (const log of raw) {
      if (
        log.blockNumber === null ||
        log.blockHash === null ||
        log.transactionHash === null ||
        log.logIndex === null
      )
        continue;
      let timestamp = timestamps.get(log.blockNumber);
      if (!timestamp) {
        const block = await this.client.getBlock({
          blockNumber: log.blockNumber,
        });
        timestamp = new Date(Number(block.timestamp) * 1000);
        timestamps.set(log.blockNumber, timestamp);
      }
      const decoded = this.decode(log, timestamp);
      if (
        decoded.eventName === "TokenCreated" &&
        decoded.address.toLowerCase() !== this.factoryAddress.toLowerCase()
      )
        continue;
      if (
        decoded.eventName === "FeeCollected" &&
        decoded.address.toLowerCase() !== treasuryAddress.toLowerCase()
      )
        continue;
      output.push(decoded);
    }
    return output;
  }

  private async getLogsWithRetry(
    address: Address | undefined,
    event: AbiEvent,
    fromBlock: bigint,
    toBlock: bigint,
  ): Promise<Log[]> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      try {
        return await this.client.getLogs({
          address,
          event,
          fromBlock,
          toBlock,
        });
      } catch (error) {
        lastError = error;
        if (attempt < 7) await wait(Math.min(15_000, 1_000 * 2 ** attempt));
      }
    }
    throw lastError;
  }

  private async getTreasuryAddress(): Promise<Address> {
    if (!this.treasuryAddress) {
      const result = await this.client.readContract({
        address: this.factoryAddress,
        abi: this.factoryAbi,
        functionName: "treasury",
      });
      if (typeof result !== "string" || !isAddress(result))
        throw new Error("Factory returned an invalid treasury address");
      this.treasuryAddress = result;
    }
    return this.treasuryAddress;
  }

  private decode(log: Log, blockTimestamp: Date): IndexedLog {
    const base = {
      transactionHash: log.transactionHash as Hex,
      logIndex: log.logIndex as number,
      blockNumber: log.blockNumber as bigint,
      blockHash: log.blockHash as Hex,
      address: log.address,
      blockTimestamp,
    };
    for (const abi of [this.factoryAbi, this.pairAbi, this.treasuryAbi]) {
      try {
        const decoded = decodeEventLog({
          abi,
          data: log.data,
          topics: log.topics,
        }) as unknown as { eventName: string; args: unknown };
        const args = decoded.args as Args;
        switch (decoded.eventName) {
          case "TokenCreated":
            return {
              ...base,
              eventName: "TokenCreated",
              args: args as unknown as Extract<
                IndexedLog,
                { eventName: "TokenCreated" }
              >["args"],
            };
          case "Buy":
            return {
              ...base,
              eventName: "Buy",
              args: args as unknown as Extract<
                IndexedLog,
                { eventName: "Buy" }
              >["args"],
            };
          case "Sell":
            return {
              ...base,
              eventName: "Sell",
              args: args as unknown as Extract<
                IndexedLog,
                { eventName: "Sell" }
              >["args"],
            };
          case "FeeCollected":
            return {
              ...base,
              eventName: "FeeCollected",
              args: args as unknown as Extract<
                IndexedLog,
                { eventName: "FeeCollected" }
              >["args"],
            };
          case "Graduated":
            return {
              ...base,
              eventName: "Graduated",
              args: args as unknown as Extract<
                IndexedLog,
                { eventName: "Graduated" }
              >["args"],
            };
        }
      } catch {
        continue;
      }
    }
    throw new Error(
      `Unable to decode log ${String(log.transactionHash)}:${String(log.logIndex)}`,
    );
  }
}
