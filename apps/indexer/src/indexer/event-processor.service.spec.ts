/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/require-await */
import { Prisma } from "@pumpnow/database";
import type { Address } from "viem";
import { PrismaService } from "../database/prisma.service";
import { EventProcessorService } from "./event-processor.service";
import type { IndexedLog } from "./indexer.types";
import { RedisService } from "../redis/redis.service";

const addr = (character: string): Address => `0x${character.repeat(40)}`;
const hash = `0x${"a".repeat(64)}`;

describe("EventProcessorService", () => {
  it("maps TokenCreated atomically to wallet, token, pool and stats", async () => {
    const tx = {
      indexedEvent: { create: jest.fn() },
      wallet: { upsert: jest.fn() },
      token: { create: jest.fn() },
      liquidityPool: { create: jest.fn() },
      platformStats: { upsert: jest.fn() },
    };
    const prisma = {
      $transaction: jest.fn(
        async (callback: (client: unknown) => Promise<void>) => callback(tx),
      ),
    };
    const service = new EventProcessorService(
      prisma as unknown as PrismaService,
      { invalidateApiCaches: jest.fn() } as unknown as RedisService,
    );
    const log: IndexedLog = {
      eventName: "TokenCreated",
      transactionHash: hash,
      logIndex: 3,
      blockNumber: 50n,
      blockHash: hash,
      address: addr("1"),
      blockTimestamp: new Date("2026-07-20T00:00:00Z"),
      args: {
        token: addr("2"),
        pair: addr("3"),
        creator: addr("4"),
        name: "Mock",
        symbol: "MOCK",
        initialSupply: 1000n,
      },
    };
    await expect(service.process(log, 5042002n)).resolves.toBe("processed");
    expect(tx.indexedEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        transactionHash: hash,
        logIndex: 3,
        eventName: "TokenCreated",
      }),
    });
    expect(tx.token.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        address: addr("2"),
        creatorAddress: addr("4"),
        totalSupply: "1000",
      }),
    });
    expect(tx.liquidityPool.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        address: addr("3"),
        tokenAddress: addr("2"),
        tokenReserve: "1000",
      }),
    });
  });

  it("treats a unique violation as an idempotent duplicate", async () => {
    const duplicate = new Prisma.PrismaClientKnownRequestError("duplicate", {
      code: "P2002",
      clientVersion: "test",
    });
    const prisma = {
      $transaction: jest.fn(async () => {
        throw duplicate;
      }),
    };
    const service = new EventProcessorService(
      prisma as unknown as PrismaService,
      { invalidateApiCaches: jest.fn() } as unknown as RedisService,
    );
    const log = {
      eventName: "TokenCreated",
      transactionHash: hash,
      logIndex: 0,
      blockNumber: 1n,
      blockHash: hash,
      address: addr("1"),
      blockTimestamp: new Date(),
      args: {
        token: addr("2"),
        pair: addr("3"),
        creator: addr("4"),
        name: "M",
        symbol: "M",
        initialSupply: 1n,
      },
    } as IndexedLog;
    await expect(service.process(log, 1n)).resolves.toBe("duplicate");
  });
});
