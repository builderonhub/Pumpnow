import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { Subject } from 'rxjs';

export type RealtimeEvent = {
  type: 'token.created' | 'trade.created' | 'stats.updated';
  tokenAddress?: string;
  transactionHash: string;
  occurredAt: string;
};

@Injectable()
export class RealtimeService implements OnModuleInit, OnModuleDestroy {
  private readonly events = new Subject<RealtimeEvent>();
  private readonly subscriber: Redis;

  constructor(config: ConfigService) {
    this.subscriber = new Redis(config.getOrThrow<string>('REDIS_URL'), {
      lazyConnect: true,
      maxRetriesPerRequest: null,
    });
  }

  stream() {
    return this.events.asObservable();
  }

  async onModuleInit(): Promise<void> {
    await this.subscriber.connect();
    await this.subscriber.subscribe('pumpnow:realtime');
    this.subscriber.on('message', (_channel, payload) => {
      try {
        this.events.next(JSON.parse(payload) as RealtimeEvent);
      } catch {
        /* ignore malformed external messages */
      }
    });
  }

  async onModuleDestroy(): Promise<void> {
    this.events.complete();
    if (this.subscriber.status !== 'end') await this.subscriber.quit();
  }
}
