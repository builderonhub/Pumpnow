/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/require-await */
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../database/prisma.service";
import { BlockchainSourceService } from "./blockchain-source.service";
import { EventProcessorService } from "./event-processor.service";
import { IndexerRunnerService } from "./indexer-runner.service";
import type { IndexedLog } from "./indexer.types";
import { RedisLockService } from "./redis-lock.service";

const address = `0x${"1".repeat(40)}`;
const hash = `0x${"a".repeat(64)}`;
const log: IndexedLog = {
  eventName: "TokenCreated",
  transactionHash: hash,
  logIndex: 0,
  blockNumber: 95n,
  blockHash: hash,
  address,
  blockTimestamp: new Date("2026-07-20T00:00:00Z"),
  args: {
    token: address,
    pair: address,
    creator: address,
    name: "Mock",
    symbol: "MOCK",
    initialSupply: 1000n,
  },
};

describe("IndexerRunnerService", () => {
  const state = {
    value: null as null | { lastBlockNumber: bigint; lastBlockHash: string },
  };
  const prisma = {
    indexerState: {
      findUnique: jest.fn(async () => state.value),
      upsert: jest.fn(
        async (input: {
          create: { lastBlockNumber: bigint; lastBlockHash: string };
        }) => {
          state.value = input.create;
          return input.create;
        },
      ),
    },
  };
  const source = {
    chainId: 5042002n,
    factoryAddress: address,
    latestBlock: jest.fn(async () => 110n),
    blockHash: jest.fn(async () => hash),
    logs: jest.fn(async () => [log]),
  };
  const processor = { process: jest.fn(async () => "processed" as const) };
  const lock = {
    acquire: jest.fn(async () => true),
    refresh: jest.fn(async () => true),
    release: jest.fn(async () => undefined),
  };
  const logger = { info: jest.fn(), error: jest.fn() };
  const config = new ConfigService({
    INDEXER_MODE: "backfill",
    INDEXER_CONFIRMATIONS: "10",
    INDEXER_BLOCK_RANGE: "1000",
    INDEXER_START_BLOCK: "90",
    INDEXER_MAX_RETRIES: "0",
    INDEXER_LOCK_TTL_MS: "30000",
  });
  const makeRunner = (): IndexerRunnerService =>
    new IndexerRunnerService(
      config,
      prisma as unknown as PrismaService,
      source as unknown as BlockchainSourceService,
      processor as unknown as EventProcessorService,
      lock as unknown as RedisLockService,
      logger,
    );

  beforeEach(() => {
    state.value = null;
    jest.clearAllMocks();
  });

  it("indexes only through the confirmed head and saves its hash", async () => {
    await makeRunner().syncOnce();
    expect(source.logs).toHaveBeenCalledWith(90n, 100n);
    expect(processor.process).toHaveBeenCalledWith(log, 5042002n);
    expect(prisma.indexerState.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          lastBlockNumber: 100n,
          lastBlockHash: hash,
        }),
      }),
    );
  });

  it("fails safe when the stored checkpoint is no longer canonical", async () => {
    state.value = {
      lastBlockNumber: 100n,
      lastBlockHash: `0x${"b".repeat(64)}`,
    };
    await expect(makeRunner().syncOnce()).rejects.toThrow("Reorg detected");
    expect(source.logs).not.toHaveBeenCalled();
  });
});
