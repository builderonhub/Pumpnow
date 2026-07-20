import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';

type HealthResponse = {
  status: 'ok';
  service: 'pumpnow-api';
  checks: {
    postgres: 'up';
    redis: 'up';
  };
  timestamp: string;
};

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  async check(): Promise<HealthResponse> {
    const [postgres, redis] = await Promise.allSettled([
      this.prisma.$queryRaw`SELECT 1`,
      this.redis.ping(),
    ]);

    if (postgres.status === 'rejected' || redis.status === 'rejected') {
      throw new ServiceUnavailableException({
        status: 'error',
        service: 'pumpnow-api',
        checks: {
          postgres: postgres.status === 'fulfilled' ? 'up' : 'down',
          redis: redis.status === 'fulfilled' ? 'up' : 'down',
        },
        timestamp: new Date().toISOString(),
      });
    }

    return {
      status: 'ok',
      service: 'pumpnow-api',
      checks: {
        postgres: 'up',
        redis: 'up',
      },
      timestamp: new Date().toISOString(),
    };
  }
}
