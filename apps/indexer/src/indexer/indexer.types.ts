import type { Address, Hex } from "viem";

type EventBase = {
  transactionHash: Hex;
  logIndex: number;
  blockNumber: bigint;
  blockHash: Hex;
  address: Address;
  blockTimestamp: Date;
};

export type IndexedLog = EventBase &
  (
    | {
        eventName: "TokenCreated";
        args: {
          token: Address;
          pair: Address;
          creator: Address;
          name: string;
          symbol: string;
          initialSupply: bigint;
          graduationTokenAmount: bigint;
          description: string;
          imageUrl: string;
          websiteUrl: string;
          xUrl: string;
          telegramUrl: string;
        };
      }
    | {
        eventName: "Buy";
        args: {
          buyer: Address;
          token: Address;
          tokenAmount: bigint;
          curveCost: bigint;
          fee: bigint;
          nativeReserve: bigint;
        };
      }
    | {
        eventName: "Sell";
        args: {
          seller: Address;
          token: Address;
          tokenAmount: bigint;
          nativeOutput: bigint;
          fee: bigint;
          nativeReserve: bigint;
        };
      }
    | {
        eventName: "FeeCollected";
        args: {
          payer: Address;
          token: Address;
          collector: Address;
          amount: bigint;
        };
      }
    | {
        eventName: "DexSwap";
        args: {
          sender: Address;
          recipient: Address;
          token: Address;
          nativeToToken: boolean;
          amountIn: bigint;
          amountOut: bigint;
          fee: bigint;
          tokenReserve: bigint;
          nativeReserve: bigint;
        };
      }
    | {
        eventName: "Graduated";
        args: {
          token: Address;
          pair: Address;
          adapter: Address;
          nativeLiquidity: bigint;
          tokenLiquidity: bigint;
          positionId: Hex;
          timestamp: bigint;
        };
      }
  );

export type IndexerHealth = {
  latestIndexedBlock: bigint | null;
  latestChainBlock: bigint | null;
  running: boolean;
  mode: "live" | "backfill";
};
