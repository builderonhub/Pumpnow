import {
  Injectable,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../database/prisma.service";
import { BlockchainSourceService } from "./blockchain-source.service";
import { EventProcessorService } from "./event-processor.service";
import type { IndexerHealth } from "./indexer.types";
import { RedisLockService } from "./redis-lock.service";
import { StructuredLogger } from "./structured-logger.service";

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

@Injectable()
export class IndexerRunnerService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private stopped = false;
  private running = false;
  private latestChainBlock: bigint | null = null;
  private readonly mode: "live" | "backfill";
  private readonly confirmations: bigint;
  private readonly range: bigint;
  private readonly pollMs: number;
  private readonly maxRetries: number;
  private readonly lockTtlMs: number;
  private readonly startBlock: bigint;
  private readonly stateKey: string;
  private readonly lockKey: string;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly source: BlockchainSourceService,
    private readonly processor: EventProcessorService,
    private readonly lock: RedisLockService,
    private readonly logger: StructuredLogger,
  ) {
    this.mode =
      config.get("INDEXER_MODE", "live") === "backfill" ? "backfill" : "live";
    this.confirmations = BigInt(config.get("INDEXER_CONFIRMATIONS", "12"));
    this.range = BigInt(config.get("INDEXER_BLOCK_RANGE", "1000"));
    this.pollMs = Number(config.get("INDEXER_POLL_INTERVAL_MS", "5000"));
    this.maxRetries = Number(config.get("INDEXER_MAX_RETRIES", "5"));
    this.lockTtlMs = Number(config.get("INDEXER_LOCK_TTL_MS", "30000"));
    this.startBlock = BigInt(config.get("INDEXER_START_BLOCK", "0"));
    this.stateKey = `pumpnow:${this.source.chainId}:${this.source.factoryAddress.toLowerCase()}`;
    this.lockKey = `indexer:lock:${this.stateKey}`;
  }

  onApplicationBootstrap(): void {
    void this.run();
  }
  async onApplicationShutdown(): Promise<void> {
    this.stopped = true;
    await this.lock.release(this.lockKey);
  }
  async health(): Promise<IndexerHealth> {
    const state = await this.prisma.indexerState.findUnique({
      where: { key: this.stateKey },
    });
    return {
      latestIndexedBlock: state?.lastBlockNumber ?? null,
      latestChainBlock: this.latestChainBlock,
      running: this.running,
      mode: this.mode,
    };
  }

  async run(): Promise<void> {
    if (this.running) return;
    if (!(await this.lock.acquire(this.lockKey, this.lockTtlMs))) {
      this.logger.info("indexer.lock_unavailable", {
        chainId: this.source.chainId.toString(),
      });
      return;
    }
    this.running = true;
    this.logger.info("indexer.started", {
      mode: this.mode,
      chainId: this.source.chainId.toString(),
    });
    try {
      do {
        await this.syncOnce();
        if (this.mode === "backfill") break;
        await delay(this.pollMs);
      } while (!this.stopped);
    } catch (error) {
      this.logger.error("indexer.stopped_with_error", error);
    } finally {
      this.running = false;
      await this.lock.release(this.lockKey);
    }
  }

  async syncOnce(): Promise<void> {
    await this.lock.refresh(this.lockKey, this.lockTtlMs);
    this.latestChainBlock = await this.retry("rpc.latest_block", () =>
      this.source.latestBlock(),
    );
    if (this.latestChainBlock < this.confirmations) return;
    const safeHead = this.latestChainBlock - this.confirmations;
    const state = await this.prisma.indexerState.findUnique({
      where: { key: this.stateKey },
    });
    if (state?.lastBlockHash) {
      const canonicalHash = await this.retry("rpc.checkpoint_hash", () =>
        this.source.blockHash(state.lastBlockNumber),
      );
      if (canonicalHash.toLowerCase() !== state.lastBlockHash.toLowerCase())
        throw new Error(
          `Reorg detected at checkpoint ${state.lastBlockNumber}; run a backfill from an earlier block`,
        );
    }
    let from = state ? state.lastBlockNumber + 1n : this.startBlock;
    while (from <= safeHead && !this.stopped) {
      const to =
        from + this.range - 1n < safeHead ? from + this.range - 1n : safeHead;
      const logs = await this.retry("rpc.get_logs", () =>
        this.source.logs(from, to),
      );
      let processed = 0;
      for (const log of logs)
        if (
          (await this.processor.process(log, this.source.chainId)) ===
          "processed"
        )
          processed += 1;
      const hash = await this.retry("rpc.range_hash", () =>
        this.source.blockHash(to),
      );
      await this.prisma.indexerState.upsert({
        where: { key: this.stateKey },
        create: {
          key: this.stateKey,
          chainId: this.source.chainId,
          lastBlockNumber: to,
          lastBlockHash: hash.toLowerCase(),
        },
        update: { lastBlockNumber: to, lastBlockHash: hash.toLowerCase() },
      });
      this.logger.info("indexer.range_complete", {
        from: from.toString(),
        to: to.toString(),
        logs: logs.length,
        processed,
      });
      from = to + 1n;
      if (!(await this.lock.refresh(this.lockKey, this.lockTtlMs)))
        throw new Error("Indexer lock was lost");
    }
  }

  private async retry<T>(
    event: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (attempt === this.maxRetries) break;
        const waitMs =
          Math.min(30_000, 250 * 2 ** attempt) +
          Math.floor(Math.random() * 100);
        this.logger.error(event, error, {
          attempt: attempt + 1,
          retryInMs: waitMs,
        });
        await delay(waitMs);
      }
    }
    throw lastError;
  }
}
