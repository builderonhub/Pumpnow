import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

@Injectable()
export class RedisService implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

  async ping(): Promise<'PONG'> {
    if (this.client.status === 'wait') {
      await this.client.connect();
    }

    const response = await this.client.ping();

    if (response !== 'PONG') {
      throw new Error('Unexpected Redis PING response');
    }

    return response;
  }

  async getJson<T>(key: string): Promise<T | null> {
    const value = await this.client.get(key);
    return value === null ? null : (JSON.parse(value) as T);
  }

  async setJson(
    key: string,
    value: unknown,
    ttlSeconds: number,
  ): Promise<void> {
    await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async getVersion(namespace: string): Promise<string> {
    const key = `cache:version:${namespace}`;
    const version = await this.client.get(key);
    return version ?? '1';
  }

  async invalidate(namespace: string): Promise<void> {
    await this.client.incr(`cache:version:${namespace}`);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client.status !== 'end') {
      await this.client.quit();
    }
  }
}
