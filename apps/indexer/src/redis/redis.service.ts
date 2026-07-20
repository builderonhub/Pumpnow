import { Inject, Injectable, OnModuleDestroy } from "@nestjs/common";
import Redis from "ioredis";
import { REDIS_CLIENT } from "./redis.constants";

export const REALTIME_CHANNEL = "pumpnow:realtime";

export type RealtimeEvent = {
  type: "token.created" | "token.updated" | "trade.created" | "stats.updated";
  tokenAddress?: string;
  transactionHash: string;
  occurredAt: string;
};

@Injectable()
export class RedisService implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

  async ping(): Promise<"PONG"> {
    if (this.client.status === "wait") {
      await this.client.connect();
    }

    const response = await this.client.ping();

    if (response !== "PONG") {
      throw new Error("Unexpected Redis PING response");
    }

    return response;
  }

  private async connected(): Promise<Redis> {
    if (this.client.status === "wait") await this.client.connect();
    return this.client;
  }

  async setIfAbsent(
    key: string,
    value: string,
    ttlMs: number,
  ): Promise<boolean> {
    const client = await this.connected();
    return (await client.set(key, value, "PX", ttlMs, "NX")) === "OK";
  }

  async exists(key: string): Promise<boolean> {
    const client = await this.connected();
    return (await client.exists(key)) === 1;
  }

  async refreshLock(
    key: string,
    value: string,
    ttlMs: number,
  ): Promise<boolean> {
    const client = await this.connected();
    const result = await client.eval(
      "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('pexpire', KEYS[1], ARGV[2]) else return 0 end",
      1,
      key,
      value,
      String(ttlMs),
    );
    return result === 1;
  }

  async releaseLock(key: string, value: string): Promise<void> {
    const client = await this.connected();
    await client.eval(
      "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
      1,
      key,
      value,
    );
  }

  async invalidateApiCaches(): Promise<void> {
    const client = await this.connected();
    await client
      .multi()
      .incr("cache:version:tokens")
      .incr("cache:version:stats")
      .incr("cache:version:candles")
      .exec();
  }

  async publish(event: RealtimeEvent): Promise<void> {
    const client = await this.connected();
    await client.publish(REALTIME_CHANNEL, JSON.stringify(event));
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client.status !== "end") {
      await this.client.quit();
    }
  }
}
