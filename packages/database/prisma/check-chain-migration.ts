import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const chainId = 5042002n;

  const [
    tokens,
    trades,
    holders,
    events,
    pools,
    candles1m,
    candles5m,
    candles1h,
    fees,
  ] = await Promise.all([
    prisma.token.count({ where: { chainId } }),
    prisma.trade.count({ where: { chainId } }),
    prisma.holder.count({ where: { chainId } }),
    prisma.indexedEvent.count({ where: { chainId } }),
    prisma.liquidityPool.count({ where: { chainId } }),
    prisma.candle1m.count({ where: { chainId } }),
    prisma.candle5m.count({ where: { chainId } }),
    prisma.candle1h.count({ where: { chainId } }),
    prisma.feeHistory.count({ where: { chainId } }),
  ]);

  console.log({
    chainId: chainId.toString(),
    tokens,
    trades,
    holders,
    events,
    pools,
    candles1m,
    candles5m,
    candles1h,
    fees,
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());