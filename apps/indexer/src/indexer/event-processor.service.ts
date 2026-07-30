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
const WAD = new Prisma.Decimal("1000000000000000000");
export const candleOpenTime = (timestamp: Date, intervalMs: number): Date =>
  new Date(Math.floor(timestamp.getTime() / intervalMs) * intervalMs);
export const nativeAmount = (rawAmount: bigint): Prisma.Decimal =>
  new Prisma.Decimal(rawAmount.toString()).div(WAD);
export const tokenMarketCap = (
  price: Prisma.Decimal,
  rawSupply: Prisma.Decimal,
): Prisma.Decimal => price.mul(rawSupply).div(WAD);

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
      const relevant = await this.prisma.$transaction(async (tx) => {
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
            return true;
          case "Buy":
            return this.trade(tx, log, chainId, TradeSide.BUY);
          case "Sell":
            return this.trade(tx, log, chainId, TradeSide.SELL);
          case "DexSwap":
            return this.dexTrade(tx, log, chainId);
          case "FeeCollected":
            await this.feeCollected(tx, log, chainId);
            return true;
          case "Graduated":
            return this.graduated(tx, log, chainId);
        }
      });
      if (!relevant) return "processed";
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
    if (
      log.eventName === "Buy" ||
      log.eventName === "Sell" ||
      log.eventName === "DexSwap"
    )
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

  private async dexTrade(
    tx: Prisma.TransactionClient,
    log: Extract<IndexedLog, { eventName: "DexSwap" }>,
    chainId: bigint,
  ): Promise<boolean> {
    const tokenAddress = log.args.token.toLowerCase();
    const walletAddress = log.args.sender.toLowerCase();
    const side = log.args.nativeToToken ? TradeSide.BUY : TradeSide.SELL;
    const tokenAmount = log.args.nativeToToken
      ? log.args.amountOut
      : log.args.amountIn;
    const quoteAmount = log.args.nativeToToken
      ? log.args.amountIn
      : log.args.amountOut;
    const pool = await tx.liquidityPool.findUnique({
      where: { tokenAddress },
    });
    // Arc-wide event queries may encounter the same signature on unrelated
    // contracts. Unknown tokens are not PumpNow events and are ignored.
    if (!pool) return false;
    if (pool.address.toLowerCase() !== log.address.toLowerCase()) {
      throw new Error(
        `DEX swap source is not the registered pool for ${tokenAddress}`,
      );
    }
    await this.wallet(tx, walletAddress);
    const token = await tx.token.findUniqueOrThrow({
      where: { address: tokenAddress },
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
    const price = new Prisma.Decimal(quoteAmount.toString()).div(
      tokenAmount.toString(),
    );
    const marketCap = tokenMarketCap(price, token.totalSupply);
    const volume = nativeAmount(quoteAmount);
    await tx.trade.create({
      data: {
        transactionHash: log.transactionHash.toLowerCase(),
        logIndex: log.logIndex,
        tokenAddress,
        walletAddress,
        side,
        tokenAmount: tokenAmount.toString(),
        quoteAmount: quoteAmount.toString(),
        feeAmount: "0",
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
      volume,
    );
    await tx.token.update({
      where: { address: tokenAddress },
      data: {
        price,
        marketCap,
        volume24h: { increment: volume },
        totalVolume: { increment: volume },
        tradeCount: { increment: 1 },
        holderCount: { increment: holderDelta },
        circulatingSupply: {
          increment:
            side === TradeSide.BUY ? tokenAmount.toString() : `-${tokenAmount}`,
        },
      },
    });
    await tx.liquidityPool.update({
      where: { tokenAddress },
      data: {
        tokenReserve: log.args.tokenReserve.toString(),
        quoteReserve: log.args.nativeReserve.toString(),
      },
    });
    await tx.platformStats.upsert({
      where: { chainId },
      create: {
        chainId,
        totalTrades: 1n,
        totalVolume: volume,
        volume24h: volume,
        uniqueTraders: 1,
      },
      update: {
        totalTrades: { increment: 1 },
        totalVolume: { increment: volume },
        volume24h: { increment: volume },
      },
    });
    return true;
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
        // The existing database column now stores the token-sale target, not a native reserve threshold.
        graduationThreshold: log.args.graduationTokenAmount.toString(),
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
  ): Promise<boolean> {
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
    const pool = await tx.liquidityPool.findUnique({
      where: { tokenAddress },
      select: { address: true },
    });
    if (!pool) return false;
    if (pool.address.toLowerCase() !== log.address.toLowerCase())
      throw new Error(
        `Event source is not the registered pair for ${tokenAddress}`,
      );
    await this.wallet(tx, walletAddress);
    const token = await tx.token.findUniqueOrThrow({
      where: { address: tokenAddress },
      select: {
        totalSupply: true,
        graduationThreshold: true,
        circulatingSupply: true,
      },
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
    const marketCap = tokenMarketCap(price, token.totalSupply);
    const volume = nativeAmount(quoteAmount);
    const previousCirculating = BigInt(token.circulatingSupply.toFixed(0));
    const nextCirculating =
      side === TradeSide.BUY
        ? previousCirculating + tokenAmount
        : previousCirculating - tokenAmount;
    const progress = Prisma.Decimal.min(
      new Prisma.Decimal(100),
      new Prisma.Decimal(nextCirculating.toString())
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
      volume,
    );
    await tx.token.update({
      where: { address: tokenAddress },
      data: {
        price,
        marketCap,
        volume24h: { increment: volume },
        totalVolume: { increment: volume },
        tradeCount: { increment: 1 },
        holderCount: { increment: holderDelta },
        bondingCurveProgress: progress,
        circulatingSupply: nextCirculating.toString(),
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
        totalVolume: volume,
        volume24h: volume,
        uniqueTraders: 1,
      },
      update: {
        totalTrades: { increment: 1 },
        totalVolume: { increment: volume },
        volume24h: { increment: volume },
        uniqueTraders: { increment: priorTrades === 0 ? 1 : 0 },
      },
    });
    return true;
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
    const fee = nativeAmount(log.args.amount);
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
      create: { chainId, totalFees: fee },
      update: { totalFees: { increment: fee } },
    });
  }

  private async graduated(
    tx: Prisma.TransactionClient,
    log: Extract<IndexedLog, { eventName: "Graduated" }>,
    chainId: bigint,
  ): Promise<boolean> {
    const token = log.args.token.toLowerCase();
    const dexPoolAddress = `0x${log.args.positionId.slice(-40)}`.toLowerCase();
    const pool = await tx.liquidityPool.findUnique({
      where: { tokenAddress: token },
      select: { address: true },
    });
    if (!pool) return false;
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
        address: dexPoolAddress,
        dex: log.args.adapter.toLowerCase(),
        status: LiquidityPoolStatus.ACTIVE,
        tokenReserve: log.args.tokenLiquidity.toString(),
        quoteReserve: log.args.nativeLiquidity.toString(),
        liquidity: nativeAmount(log.args.nativeLiquidity),
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
    return true;
  }
}
