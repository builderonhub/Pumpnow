import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { serializeValue } from '../common/serialization';

@Injectable()
export class WalletsService {
  constructor(private readonly prisma: PrismaService) {}

  async portfolio(address: string): Promise<Record<string, unknown>> {
    const [createdTokens, holdings, trades] = await this.prisma.$transaction([
      this.prisma.token.findMany({
        where: { creatorAddress: address },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.holder.findMany({
        where: { walletAddress: address, balance: { gt: 0 } },
        orderBy: { lastUpdatedAt: 'desc' },
        include: { token: true },
      }),
      this.prisma.trade.findMany({
        where: { walletAddress: address },
        orderBy: [{ blockTimestamp: 'desc' }, { id: 'desc' }],
        take: 100,
        include: {
          token: { select: { name: true, symbol: true, decimals: true } },
        },
      }),
    ]);
    return serializeValue({
      address,
      createdTokens,
      holdings,
      trades,
    }) as Record<string, unknown>;
  }
}
