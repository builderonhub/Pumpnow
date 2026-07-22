# Stress test

## Burst profile

Use funded test wallets to submit concurrent Launch/Buy/Sell traffic. Begin with 10 launches and 100 trades over 30 seconds, then increase in steps while respecting the Arc public RPC rate limit. Use separate wallet nonces or a nonce manager per wallet; nonce collisions are invalid load and must not be counted as platform failures.

Configure unique funded keys in `STRESS_WALLET_PRIVATE_KEYS`, set a conservative `STRESS_MAX_TOTAL_NATIVE_WEI`, then run `npm run stress:burst`. If the dedicated stress variable is absent, the runner reuses `PRIVATE_KEY` plus `TEST_WALLET_PRIVATE_KEYS`. Its default concurrency is the smaller of five and the number of configured wallets. Each worker uses one wallet and concurrently executes Launch → Buy → Approve → Sell, avoiding cross-worker nonce collisions. Increase `STRESS_CONCURRENCY` only after adding enough separately funded wallets.

The public Arc RPC profile defaults to a 5-second worker submission stagger, 10-second receipt polling, and bounded exponential retry for RPC limit errors. Tune `STRESS_WORKER_STAGGER_MS`, `STRESS_RECEIPT_POLL_INTERVAL_MS`, `STRESS_RPC_RETRY_COUNT`, and `STRESS_RPC_RETRY_DELAY_MS` only after observing the endpoint's capacity. Every submitted transaction hash is printed before receipt polling so an interrupted run can be reconciled on Arcscan.

Run the invariant audit after each burst:

```text
npm run stress:audit:testnet
```

`stress:audit` reads the local `.env` database. `stress:audit:testnet` reads `.env.testnet`. Never compare a testnet burst against the local development database.

The audit fails on duplicate trade identities, mismatched 1-minute candle counts, token trade/holder counter drift, or platform token/trade counter drift.
It also fails when no token/trade workload exists. `STRESS_ALLOW_EMPTY=true` is reserved for checking audit wiring in a fresh development database and is not a valid stress result.

## Acceptance criteria

- Exactly one `trades` row and one `indexed_events` row per `(transactionHash, logIndex)`.
- Candle `trade_count` equals the number of trades in its token/time bucket.
- Token `tradeCount` and `holderCount` match source rows.
- Platform totals match source rows across indexed chains.
- Checkpoint eventually reaches the confirmed burst block.
- Indexer/API error rates return to zero after the burst and no worker loses leadership without reacquiring it.
- Realtime may coalesce UI refetches, but the final API state must be complete and consistent.

## Arc RPC limits

Throttle and retry RPC calls with exponential backoff. A public RPC rate-limit is an environmental capacity limit, not permission to skip database invariants. For sustained load testing use a dedicated Arc RPC endpoint and record its provider limits with the results.

## DEX boundary

`MockDexAdapter` remains allowed for local acceptance only. Public Arc Testnet uses the PumpNow DEX through `PumpDexAdapter`; verify reserve, slippage and locked-liquidity invariants before deployment.

## Latest result (2026-07-21)

Status: **PARTIAL PASS**

`npm run stress:audit` completed with:

```text
tokens=2
trades=29
activeHolders=3
chains=1
duplicateTrades=0
candleMismatches=0
tokenCounterMismatches=0
```

The persisted workload passes all implemented database invariants. A new public-RPC burst was not submitted in this review, so RPC throughput and rate-limit behavior remain NOT RUN for this release candidate.
