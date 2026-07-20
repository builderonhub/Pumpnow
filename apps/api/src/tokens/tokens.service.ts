import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@pumpnow/database';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';
import { ListTokensDto, TokenSort } from './dto/list-tokens.dto';
import { ListTokenChildrenDto } from './dto/list-token-children.dto';
import type { PaginatedResponse, TokenSummaryResponse } from './tokens.types';
import { serializeValue } from '../common/serialization';
import { CandleInterval, ListCandlesDto } from './dto/list-candles.dto';

@Injectable()
export class TokensService {
  private readonly ttl: number;
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    config: ConfigService,
  ) {
    this.ttl = config.get<number>('API_CACHE_TTL_SECONDS', 15);
  }

  async list(
    query: ListTokensDto,
  ): Promise<PaginatedResponse<TokenSummaryResponse>> {
    const version = await this.redis.getVersion('tokens');
    const key = `api:tokens:v${version}:${query.status ?? 'all'}:${query.sort}:${query.page}:${query.limit}`;
    const cached =
      await this.redis.getJson<PaginatedResponse<TokenSummaryResponse>>(key);
    if (cached) return cached;

    const where: Prisma.TokenWhereInput = query.status
      ? { status: query.status }
      : {};
    const orderBy: Prisma.TokenOrderByWithRelationInput[] = this.orderBy(
      query.sort,
    );
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.token.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: this.summarySelect(),
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
    await this.redis.setJson(key, result, this.ttl);
    return result;
  }

  async findOne(address: string): Promise<Record<string, unknown>> {
    const version = await this.redis.getVersion('tokens');
    const key = `api:token:v${version}:${address}`;
    const cached = await this.redis.getJson<Record<string, unknown>>(key);
    if (cached) return cached;
    const token = await this.prisma.token.findUnique({
      where: { address },
      include: { liquidityPool: true },
    });
    if (!token) throw new NotFoundException('Token not found');
    const result = serializeValue(token) as Record<string, unknown>;
    await this.redis.setJson(key, result, this.ttl);
    return result;
  }

  async trades(
    address: string,
    query: ListTokenChildrenDto,
  ): Promise<PaginatedResponse<Record<string, unknown>>> {
    await this.ensureToken(address);
    const where = { tokenAddress: address };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.trade.findMany({
        where,
        orderBy: [{ blockTimestamp: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.trade.count({ where }),
    ]);
    return serializeValue({
      data: rows,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    }) as PaginatedResponse<Record<string, unknown>>;
  }

  async holders(
    address: string,
    query: ListTokenChildrenDto,
  ): Promise<PaginatedResponse<Record<string, unknown>>> {
    await this.ensureToken(address);
    const where = { tokenAddress: address, balance: { gt: 0 } };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.holder.findMany({
        where,
        orderBy: [{ balance: 'desc' }, { walletAddress: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.holder.count({ where }),
    ]);
    return serializeValue({
      data: rows,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    }) as PaginatedResponse<Record<string, unknown>>;
  }

  async candles(
    address: string,
    query: ListCandlesDto,
  ): Promise<Record<string, unknown>[]> {
    await this.ensureToken(address);
    if (query.from && query.to && query.from > query.to)
      throw new BadRequestException('from must be before to');
    const version = await this.redis.getVersion('candles');
    const key = `api:candles:v${version}:${address}:${query.interval}:${query.from?.toISOString() ?? ''}:${query.to?.toISOString() ?? ''}:${query.limit}`;
    const cached = await this.redis.getJson<Record<string, unknown>[]>(key);
    if (cached) return cached;
    const where = {
      tokenAddress: address,
      openTime: { gte: query.from, lte: query.to },
    };
    const args = {
      where,
      orderBy: { openTime: 'desc' as const },
      take: query.limit,
    };
    const rows =
      query.interval === CandleInterval.ONE_MINUTE
        ? await this.prisma.candle1m.findMany(args)
        : query.interval === CandleInterval.FIVE_MINUTES
          ? await this.prisma.candle5m.findMany(args)
          : await this.prisma.candle1h.findMany(args);
    const result = serializeValue(rows.reverse()) as Record<string, unknown>[];
    await this.redis.setJson(key, result, this.ttl);
    return result;
  }

  private async ensureToken(address: string): Promise<void> {
    if (
      !(await this.prisma.token.findUnique({
        where: { address },
        select: { address: true },
      }))
    )
      throw new NotFoundException('Token not found');
  }

  private orderBy(sort: TokenSort): Prisma.TokenOrderByWithRelationInput[] {
    if (sort === TokenSort.TOP_VOLUME)
      return [{ volume24h: 'desc' }, { createdAt: 'desc' }];
    if (sort === TokenSort.TRENDING)
      return [
        { volume24h: 'desc' },
        { tradeCount: 'desc' },
        { createdAt: 'desc' },
      ];
    return [{ createdAt: 'desc' }, { address: 'asc' }];
  }

  private summarySelect(): Prisma.TokenSelect {
    return {
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
  }
}
