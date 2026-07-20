# PumpNow production readiness

Last reviewed: 2026-07-20. This is a pre-testnet engineering review, not an independent audit.

## Completed controls

- Contract parameters reject zero addresses, zero amounts, invalid curve settings, fee rates above 10%, and invalid graduation thresholds.
- Buy and sell use checks-effects-interactions with a reentrancy guard, pause control, explicit slippage bounds, reserve checks, and checked native transfers.
- Graduation changes state before the external adapter call and reverts atomically if liquidity creation fails.
- Factory and Treasury privileged operations are owner-gated. Pair fee collection is allow-listed.
- Existing Foundry tests cover access control, pause, slippage, accounting restoration, fee limits, graduation and invalid metadata. A fuzz round-trip test checks reserve restoration.
- API startup validates database, Redis and CORS configuration; request DTOs cap pagination at 100; global validation rejects unknown input fields.
- API disables framework disclosure and sets basic browser security headers. Rate limiting and explicit CORS allow-lists are enabled.
- API and indexer enable graceful shutdown. Prisma and Redis providers close connections during shutdown.
- Indexer uses a distributed lock, confirmed block head, event ledger idempotency and checkpoint block hashes.
- Frontend has global loading/error states; transaction flows retain explicit wallet, chain, receipt and slippage states.
- Docker Compose includes Postgres, Redis, API, indexer and web health checks. Root scripts start, stop, reset and smoke-test the stack.

## Release blockers before public testnet

1. Run `forge fmt --check`, `forge build` and `forge test` in a machine with Foundry installed. The current Windows execution environment exposes neither Forge nor a usable WSL distribution.
2. Replace the mock DEX adapter and audit its approval, price bounds, liquidity recipient and position ownership semantics.
3. Implement automatic bounded reorg rollback. Current indexer detects a checkpoint mismatch and stops safely; it does not reverse derived rows automatically.
4. Exercise Docker images and the end-to-end smoke test after setting a deployed local factory address. Indexer intentionally fails fast when `PUMP_FACTORY_ADDRESS` is empty.
5. Add an independent smart-contract review, static analysis (Slither), gas snapshots and invariant campaigns with a high run count.
6. Use a multisig plus delayed/two-step ownership transfer for Factory and Treasury. Current single-step owner authority is an operational centralization risk.
7. Define production secrets, TLS termination, database backups/restore drills, RPC failover, monitoring, alerting and incident runbooks.

## Accounting invariants

- While active, `address(pair).balance >= nativeReserve`.
- `tokensSold + token.balanceOf(pair) == initialSupply` before graduation, excluding unsupported direct token transfers.
- A complete buy/sell round trip returns `tokensSold` and `nativeReserve` to their prior values; fees remain in Treasury.
- After graduation, status never returns to active, trading is blocked, native reserve is zero, and the adapter call must return a non-zero position id.

## Local verification

```text
npm run lint
npm run typecheck
npm run test
npm run build
npm run stack:start
npm run smoke
npm run stack:stop
```

Resetting local state is destructive and removes Postgres/Redis volumes:

```text
npm run stack:reset
```
