import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { firstValueFrom, timeout } from 'rxjs';
import { RealtimeService } from './realtime.service';

describe('Realtime Redis pub/sub integration', () => {
  it('delivers a published event to an API subscriber', async () => {
    const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
    const service = new RealtimeService(
      new ConfigService({ REDIS_URL: redisUrl }),
    );
    const publisher = new Redis(redisUrl);
    await service.onModuleInit();
    try {
      const received = firstValueFrom(service.stream().pipe(timeout(3_000)));
      await publisher.publish(
        'pumpnow:realtime',
        JSON.stringify({
          type: 'trade.created',
          tokenAddress: '0xabc',
          transactionHash: '0xintegration',
          occurredAt: new Date(0).toISOString(),
        }),
      );
      await expect(received).resolves.toEqual(
        expect.objectContaining({
          type: 'trade.created',
          transactionHash: '0xintegration',
        }),
      );
    } finally {
      await publisher.quit();
      await service.onModuleDestroy();
    }
  });
});
