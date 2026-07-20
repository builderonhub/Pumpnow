import { ConfigService } from '@nestjs/config';
import { Prisma } from '@pumpnow/database';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';
import { ListTokensDto, TokenSort } from './dto/list-tokens.dto';
import { TokensService } from './tokens.service';

describe('TokensService', () => {
  const token = {
    address: `0x${'1'.repeat(40)}`,
    creatorAddress: `0x${'2'.repeat(40)}`,
    name: 'Pump',
    symbol: 'PUMP',
    status: 'BONDING',
    price: new Prisma.Decimal('1.5'),
    marketCap: new Prisma.Decimal('100'),
    volume24h: new Prisma.Decimal('20'),
    totalVolume: new Prisma.Decimal('30'),
    holderCount: 2,
    tradeCount: 3,
    bondingCurveProgress: new Prisma.Decimal('10'),
    logoUrl: null,
    createdAt: new Date('2026-07-20T00:00:00Z'),
  };

  it('returns serialized paginated tokens and stores cache', async () => {
    const prisma = {
      token: {
        findMany: jest.fn().mockResolvedValue([token]),
        count: jest.fn().mockResolvedValue(1),
      },
      $transaction: jest.fn(async (operations: Promise<unknown>[]) =>
        Promise.all(operations),
      ),
    };
    const redis = {
      getVersion: jest.fn().mockResolvedValue('1'),
      getJson: jest.fn().mockResolvedValue(null),
      setJson: jest.fn(),
    };
    const service = new TokensService(
      prisma as unknown as PrismaService,
      redis as unknown as RedisService,
      new ConfigService(),
    );
    const query = Object.assign(new ListTokensDto(), {
      page: 1,
      limit: 20,
      sort: TokenSort.NEW,
    });
    const result = await service.list(query);
    expect(result.data[0]?.price).toBe('1.5');
    expect(result.data[0]?.createdAt).toBe('2026-07-20T00:00:00.000Z');
    expect(result.meta).toEqual({
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    });
    expect(redis.setJson).toHaveBeenCalled();
  });

  it('returns cached list without querying Prisma', async () => {
    const cached = {
      data: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    };
    const prisma = {
      token: { findMany: jest.fn(), count: jest.fn() },
      $transaction: jest.fn(),
    };
    const redis = {
      getVersion: jest.fn().mockResolvedValue('2'),
      getJson: jest.fn().mockResolvedValue(cached),
      setJson: jest.fn(),
    };
    const service = new TokensService(
      prisma as unknown as PrismaService,
      redis as unknown as RedisService,
      new ConfigService(),
    );
    await expect(service.list(new ListTokensDto())).resolves.toEqual(cached);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
