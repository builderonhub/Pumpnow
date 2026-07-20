import { Injectable } from '@nestjs/common';
import { Prisma } from '@pumpnow/database';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';
import { serializeValue } from '../common/serialization';
import type {
  PaginatedResponse,
  TokenSummaryResponse,
} from '../tokens/tokens.types';
import { SearchDto } from './dto/search.dto';

@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async search(
    query: SearchDto,
  ): Promise<PaginatedResponse<TokenSummaryResponse>> {
    const version = await this.redis.getVersion('tokens');
    const normalized = query.q.toLowerCase();
    const key = `api:search:v${version}:${encodeURIComponent(normalized)}:${query.page}:${query.limit}`;
    const cached =
      await this.redis.getJson<PaginatedResponse<TokenSummaryResponse>>(key);
    if (cached) return cached;
    const where: Prisma.TokenWhereInput = {
      OR: [
        { address: { equals: normalized, mode: 'insensitive' } },
        { name: { contains: query.q, mode: 'insensitive' } },
        { symbol: { contains: query.q, mode: 'insensitive' } },
      ],
    };
    const select: Prisma.TokenSelect = {
      address: true,
      creatorAddress: true,
      name: true,
      symbol: true,
      status: true,
      price: true,
      marketCap: true,
      volume24h: true,
      totalVolume: true,
      holderCount: true,
      tradeCount: true,
      bondingCurveProgress: true,
      logoUrl: true,
      createdAt: true,
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.token.findMany({
        where,
        select,
        orderBy: [{ volume24h: 'desc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.token.count({ where }),
    ]);
    const result = serializeValue({
      data: rows,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    }) as PaginatedResponse<TokenSummaryResponse>;
    await this.redis.setJson(key, result, 15);
    return result;
  }
}
