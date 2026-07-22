import { PrismaClient } from "@pumpnow/database";

const prisma = new PrismaClient();
const fail = (message) => {
  throw new Error(`INVARIANT FAILED: ${message}`);
};

try {
  const [tokens, trades, activeHolders, stats, duplicateTrades, candleMismatches] =
    await Promise.all([
      prisma.token.count(),
      prisma.trade.count(),
      prisma.holder.count({ where: { balance: { gt: 0 } } }),
      prisma.platformStats.findMany(),
      prisma.$queryRaw`
        SELECT transaction_hash, log_index, COUNT(*)::int AS count
        FROM trades
        GROUP BY transaction_hash, log_index
        HAVING COUNT(*) > 1
      `,
      prisma.$queryRaw`
        WITH expected AS (
          SELECT token_address,
                 date_trunc('minute', block_timestamp) AS open_time,
                 COUNT(*)::int AS trade_count
          FROM trades
          GROUP BY token_address, date_trunc('minute', block_timestamp)
        )
        SELECT COALESCE(e.token_address, c.token_address) AS token_address,
               COALESCE(e.open_time, c.open_time) AS open_time,
               e.trade_count AS expected_count,
               c.trade_count AS actual_count
        FROM expected e
        FULL OUTER JOIN candles_1m c
          ON c.token_address = e.token_address AND c.open_time = e.open_time
        WHERE e.trade_count IS DISTINCT FROM c.trade_count
      `,
    ]);

  if (duplicateTrades.length) fail(`${duplicateTrades.length} duplicate trades`);
  if (candleMismatches.length)
    fail(`${candleMismatches.length} one-minute candle count mismatches`);

  const tokenCounters = await prisma.$queryRaw`
    SELECT t.address, t.trade_count, t.holder_count,
           COUNT(DISTINCT tr.id)::int AS actual_trades,
           COUNT(DISTINCT CASE WHEN h.balance > 0 THEN h.wallet_address END)::int AS actual_holders
    FROM tokens t
    LEFT JOIN trades tr ON tr.token_address = t.address
    LEFT JOIN holders h ON h.token_address = t.address
    GROUP BY t.address, t.trade_count, t.holder_count
    HAVING t.trade_count <> COUNT(DISTINCT tr.id)::int
        OR t.holder_count <> COUNT(DISTINCT CASE WHEN h.balance > 0 THEN h.wallet_address END)::int
  `;
  if (tokenCounters.length)
    fail(`${tokenCounters.length} token counter mismatches`);

  const totalStatsTrades = stats.reduce(
    (sum, row) => sum + row.totalTrades,
    0n,
  );
  const totalStatsTokens = stats.reduce((sum, row) => sum + row.totalTokens, 0);
  if (totalStatsTrades !== BigInt(trades))
    fail(`platform totalTrades=${totalStatsTrades} but trades=${trades}`);
  if (totalStatsTokens !== tokens)
    fail(`platform totalTokens=${totalStatsTokens} but tokens=${tokens}`);
  if ((tokens === 0 || trades === 0) && process.env.STRESS_ALLOW_EMPTY !== "true")
    fail("no Launch/Buy/Sell workload was found; run a burst before auditing");

  console.log(
    JSON.stringify(
      {
        status: "PASS",
        tokens,
        trades,
        activeHolders,
        chains: stats.length,
        duplicateTrades: 0,
        candleMismatches: 0,
        tokenCounterMismatches: 0,
      },
      null,
      2,
    ),
  );
} finally {
  await prisma.$disconnect();
}
