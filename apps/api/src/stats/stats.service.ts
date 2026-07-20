import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';
import { serializeValue } from '../common/serialization';

@Injectable()
export class StatsService {
  private readonly ttl: number;
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    config: ConfigService,
  ) {
    this.ttl = config.get<number>('API_STATS_CACHE_TTL_SECONDS', 30);
  }

  async platform(): Promise<Record<string, unknown>> {
    const version = await this.redis.getVersion('stats');
    const key = `api:stats:v${version}:platform`;
    const cached = await this.redis.getJson<Record<string, unknown>>(key);
    if (cached) return cached;
    const stats = await this.prisma.platformStats.findFirst({
      orderBy: { updatedAt: 'desc' },
    });
    if (!stats)
      throw new NotFoundException('Platform stats are not available yet');
    const result = serializeValue(stats) as Record<string, unknown>;
    await this.redis.setJson(key, result, this.ttl);
    return result;
  }
}
