import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { RedisService } from "../redis/redis.service";

@Injectable()
export class RedisLockService {
  private readonly token = randomUUID();
  constructor(private readonly redis: RedisService) {}

  async acquire(key: string, ttlMs: number): Promise<boolean> {
    return this.redis.setIfAbsent(key, this.token, ttlMs);
  }

  async refresh(key: string, ttlMs: number): Promise<boolean> {
    return this.redis.refreshLock(key, this.token, ttlMs);
  }

  async release(key: string): Promise<void> {
    await this.redis.releaseLock(key, this.token);
  }
}
