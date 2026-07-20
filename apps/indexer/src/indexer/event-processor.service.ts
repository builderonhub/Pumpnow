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

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

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
      select: { totalSupply: true },
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
    await tx.token.update({
      where: { address: tokenAddress },
      data: {
        price,
        marketCap,
        totalVolume: { increment: quoteAmount.toString() },
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
