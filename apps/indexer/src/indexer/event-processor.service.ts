import { Injectable } from "@nestjs/common";
import {
  FeeType,
  LiquidityPoolStatus,
  Prisma,
  TokenStatus,
  TradeSide,
} from "@pumpnow/database";
import { PrismaService } from "../database/prisma.service";
import type { IndexedLog } from "./indexer.types";
import { RedisService } from "../redis/redis.service";
import type { RealtimeEvent } from "../redis/redis.service";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
export const candleOpenTime = (timestamp: Date, intervalMs: number): Date =>
  new Date(Math.floor(timestamp.getTime() / intervalMs) * intervalMs);

@Injectable()
export class EventProcessorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async process(
    log: IndexedLog,
    chainId: bigint,
  ): Promise<"processed" | "duplicate"> {
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.indexedEvent.create({
          data: {
            transactionHash: log.transactionHash.toLowerCase(),
            logIndex: log.logIndex,
            blockNumber: log.blockNumber,
            blockHash: log.blockHash.toLowerCase(),
            eventName: log.eventName,
          },
        });

        switch (log.eventName) {
          case "TokenCreated":
            await this.tokenCreated(tx, log, chainId);
            break;
          case "Buy":
            await this.trade(tx, log, chainId, TradeSide.BUY);
            break;
          case "Sell":
            await this.trade(tx, log, chainId, TradeSide.SELL);
            break;
          case "FeeCollected":
            await this.feeCollected(tx, log, chainId);
            break;
          case "Graduated":
            await this.graduated(tx, log, chainId);
            break;
        }
      });
      await this.redis.invalidateApiCaches();
      for (const event of this.realtimeEvents(log))
        await this.redis.publish(event);
      return "processed";
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      )
        return "duplicate";
      throw error;
    }
  }

  private realtimeEvents(log: IndexedLog): RealtimeEvent[] {
    const base = {
      transactionHash: log.transactionHash.toLowerCase(),
      occurredAt: log.blockTimestamp.toISOString(),
    };
    if (log.eventName === "TokenCreated")
      return [
        {
          ...base,
          type: "token.created",
          tokenAddress: log.args.token.toLowerCase(),
        },
        { ...base, type: "stats.updated" },
      ];
    if (log.eventName === "Buy" || log.eventName === "Sell")
      return [
        {
          ...base,
          type: "trade.created",
          tokenAddress: log.args.token.toLowerCase(),
        },
        { ...base, type: "stats.updated" },
      ];
    if (log.eventName === "Graduated")
      return [
        {
          ...base,
          type: "token.updated",
          tokenAddress: log.args.token.toLowerCase(),
        },
        {
          ...base,
          type: "stats.updated",
          tokenAddress: log.args.token.toLowerCase(),
        },
      ];
    if (log.eventName === "FeeCollected")
      return [
        {
          ...base,
          type: "stats.updated",
          tokenAddress: log.args.token.toLowerCase(),
        },
      ];
    return [];
  }

  private wallet(
    tx: Prisma.TransactionClient,
    address: string,
  ): Promise<unknown> {
    return tx.wallet.upsert({
      where: { address: address.toLowerCase() },
      create: { address: address.toLowerCase() },
      update: {},
    });
  }

  private async tokenCreated(
    tx: Prisma.TransactionClient,
    log: Extract<IndexedLog, { eventName: "TokenCreated" }>,
    chainId: bigint,
  ): Promise<void> {
    const token = log.args.token.toLowerCase();
    const pair = log.args.pair.toLowerCase();
    const creator = log.args.creator.toLowerCase();
    await this.wallet(tx, creator);
    await tx.token.create({
      data: {
        address: token,
        creatorAddress: creator,
        name: log.args.name,
        symbol: log.args.symbol,
        totalSupply: log.args.initialSupply.toString(),
        graduationThreshold: log.args.graduationThreshold.toString(),
        description: log.args.description || null,
        logoUrl: log.args.imageUrl || null,
        websiteUrl: log.args.websiteUrl || null,
        xUrl: log.args.xUrl || null,
        telegramUrl: log.args.telegramUrl || null,
        creationBlockNumber: log.blockNumber,
        creationTxHash: log.transactionHash.toLowerCase(),
        createdAt: log.blockTimestamp,
      },
    });
    await tx.liquidityPool.create({
      data: {
        address: pair,
        tokenAddress: token,
        quoteTokenAddress: ZERO_ADDRESS,
        dex: "pumpnow-bonding-curve",
        status: LiquidityPoolStatus.PENDING,
        tokenReserve: log.args.initialSupply.toString(),
        createdAt: log.blockTimestamp,
      },
    });
    await tx.platformStats.upsert({
      where: { chainId },
      create: { chainId, totalTokens: 1, bondingTokens: 1 },
      update: {
        totalTokens: { increment: 1 },
        bondingTokens: { increment: 1 },
      },
    });
  }

  private async trade(
    tx: Prisma.TransactionClient,
    log: Extract<IndexedLog, { eventName: "Buy" | "Sell" }>,
    chainId: bigint,
    side: TradeSide,
  ): Promise<void> {
    const walletAddress = (
      log.eventName === "Buy" ? log.args.buyer : log.args.seller
    ).toLowerCase();
    const tokenAddress = log.args.token.toLowerCase();
    const tokenAmount = log.args.tokenAmount;
    const quoteAmount =
      log.eventName === "Buy" ? log.args.curveCost : log.args.nativeOutput;
    const feeAmount = log.args.fee;
    const price =
      tokenAmount === 0n
        ? new Prisma.Decimal(0)
        : new Prisma.Decimal(quoteAmount.toString()).div(
            tokenAmount.toString(),
          );
    const pool = await tx.liquidityPool.findUniqueOrThrow({
      where: { tokenAddress },
      select: { address: true },
    });
    if (pool.address.toLowerCase() !== log.address.toLowerCase())
      throw new Error(
        `Event source is not the registered pair for ${tokenAddress}`,
      );
    await this.wallet(tx, walletAddress);
    const token = await tx.token.findUniqueOrThrow({
      where: { address: tokenAddress },
      select: { totalSupply: true, graduationThreshold: true },
    });
    const existing = await tx.holder.findUnique({
      where: { tokenAddress_walletAddress: { tokenAddress, walletAddress } },
    });
    const previous = existing ? BigInt(existing.balance.toFixed(0)) : 0n;
    const next =
      side === TradeSide.BUY ? previous + tokenAmount : previous - tokenAmount;
    if (next < 0n)
      throw new Error(`Negative holder balance for ${walletAddress}`);
    const holderDelta =
      previous === 0n && next > 0n ? 1 : previous > 0n && next === 0n ? -1 : 0;
    const supply = BigInt(token.totalSupply.toFixed(0));
    const ownershipBps = supply === 0n ? 0 : Number((next * 10_000n) / supply);
    await tx.holder.upsert({
      where: { tokenAddress_walletAddress: { tokenAddress, walletAddress } },
      create: {
        tokenAddress,
        walletAddress,
        balance: next.toString(),
        ownershipBps,
        firstSeenAt: log.blockTimestamp,
      },
      update: { balance: next.toString(), ownershipBps },
    });
    const marketCap = price.mul(token.totalSupply);
    const progress = Prisma.Decimal.min(
      new Prisma.Decimal(100),
      new Prisma.Decimal(log.args.nativeReserve.toString())
        .mul(100)
        .div(token.graduationThreshold),
    );
    await tx.trade.create({
      data: {
        transactionHash: log.transactionHash.toLowerCase(),
        logIndex: log.logIndex,
        tokenAddress,
        walletAddress,
        side,
        tokenAmount: tokenAmount.toString(),
        quoteAmount: quoteAmount.toString(),
        feeAmount: feeAmount.toString(),
        price,
        marketCap,
        blockNumber: log.blockNumber,
        blockTimestamp: log.blockTimestamp,
      },
    });
    await this.upsertCandles(
      tx,
      tokenAddress,
      log.blockTimestamp,
      price,
      new Prisma.Decimal(quoteAmount.toString()),
    );
    await tx.token.update({
      where: { address: tokenAddress },
      data: {
        price,
        marketCap,
        totalVolume: { increment: quoteAmount.toString() },
        tradeCount: { increment: 1 },
        holderCount: { increment: holderDelta },
        bondingCurveProgress: progress,
        circulatingSupply: {
          increment:
            side === TradeSide.BUY ? tokenAmount.toString() : `-${tokenAmount}`,
        },
      },
    });
    await tx.liquidityPool.update({
      where: { tokenAddress },
      data: {
        quoteReserve: log.args.nativeReserve.toString(),
        tokenReserve: {
          increment:
            side === TradeSide.BUY ? `-${tokenAmount}` : tokenAmount.toString(),
        },
      },
    });
    const priorTrades = await tx.trade.count({
      where: {
        walletAddress,
        NOT: {
          transactionHash: log.transactionHash.toLowerCase(),
          logIndex: log.logIndex,
        },
      },
    });
    await tx.platformStats.upsert({
      where: { chainId },
      create: {
        chainId,
        totalTrades: 1n,
        totalVolume: quoteAmount.toString(),
        uniqueTraders: 1,
      },
      update: {
        totalTrades: { increment: 1 },
        totalVolume: { increment: quoteAmount.toString() },
        uniqueTraders: { increment: priorTrades === 0 ? 1 : 0 },
      },
    });
  }

  private async upsertCandles(
    tx: Prisma.TransactionClient,
    tokenAddress: string,
    timestamp: Date,
    price: Prisma.Decimal,
    volume: Prisma.Decimal,
  ): Promise<void> {
    const definitions = [
      ["candles_1m", 60_000],
      ["candles_5m", 300_000],
      ["candles_1h", 3_600_000],
    ] as const;
    for (const [table, intervalMs] of definitions) {
      const openTime = candleOpenTime(timestamp, intervalMs);
      await tx.$executeRaw`
        INSERT INTO ${Prisma.raw(table)}
          (token_address, open_time, open, high, low, close, volume, trade_count)
        VALUES (${tokenAddress}, ${openTime}, ${price}, ${price}, ${price}, ${price}, ${volume}, 1)
        ON CONFLICT (token_address, open_time) DO UPDATE SET
          high = GREATEST(${Prisma.raw(table)}.high, EXCLUDED.high),
          low = LEAST(${Prisma.raw(table)}.low, EXCLUDED.low),
          close = EXCLUDED.close,
          volume = ${Prisma.raw(table)}.volume + EXCLUDED.volume,
          trade_count = ${Prisma.raw(table)}.trade_count + 1
      `;
    }
  }

  private async feeCollected(
    tx: Prisma.TransactionClient,
    log: Extract<IndexedLog, { eventName: "FeeCollected" }>,
    chainId: bigint,
  ): Promise<void> {
    const payer = log.args.payer.toLowerCase();
    const token = log.args.token.toLowerCase();
    await this.wallet(tx, payer);
    await tx.feeHistory.create({
      data: {
        transactionHash: log.transactionHash.toLowerCase(),
        logIndex: log.logIndex,
        tokenAddress: token === ZERO_ADDRESS ? null : token,
        payerAddress: payer,
        type: FeeType.TRADE,
        amount: log.args.amount.toString(),
        blockNumber: log.blockNumber,
        blockTimestamp: log.blockTimestamp,
      },
    });
    await tx.platformStats.upsert({
      where: { chainId },
      create: { chainId, totalFees: log.args.amount.toString() },
      update: { totalFees: { increment: log.args.amount.toString() } },
    });
  }

  private async graduated(
    tx: Prisma.TransactionClient,
    log: Extract<IndexedLog, { eventName: "Graduated" }>,
    chainId: bigint,
  ): Promise<void> {
    const token = log.args.token.toLowerCase();
    const pool = await tx.liquidityPool.findUniqueOrThrow({
      where: { tokenAddress: token },
      select: { address: true },
    });
    if (pool.address.toLowerCase() !== log.address.toLowerCase())
      throw new Error(`Event source is not the registered pair for ${token}`);
    await tx.token.update({
      where: { address: token },
      data: {
        status: TokenStatus.GRADUATED,
        bondingCurveProgress: 100,
        graduatedAt: log.blockTimestamp,
      },
    });
    await tx.liquidityPool.update({
      where: { tokenAddress: token },
      data: {
        address: log.args.pair.toLowerCase(),
        dex: log.args.adapter.toLowerCase(),
        status: LiquidityPoolStatus.ACTIVE,
        tokenReserve: log.args.tokenLiquidity.toString(),
        quoteReserve: log.args.nativeLiquidity.toString(),
        liquidity: log.args.nativeLiquidity.toString(),
        graduationTxHash: log.transactionHash.toLowerCase(),
        graduationBlockNumber: log.blockNumber,
      },
    });
    await tx.platformStats.upsert({
      where: { chainId },
      create: { chainId, graduatedTokens: 1 },
      update: {
        bondingTokens: { decrement: 1 },
        graduatedTokens: { increment: 1 },
      },
    });
  }
}
