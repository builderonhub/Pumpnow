# Restart and recovery

## Scope

This runbook verifies recovery of the indexer, Redis realtime path, API/SSE clients, and PostgreSQL. It must be run against the local Docker stack before a testnet release and after changes to persistence, indexing, or realtime code.

## Automated run

Start a configured stack, generate at least one token and trade, then run:

```text
npm run recovery:test
```

For the Arc testnet Docker overlay and `pumpnow_testnet` database, run:

```text
npm run recovery:test:testnet
```

The testnet command loads `.env.testnet`, combines `docker-compose.yml` with `docker-compose.testnet.yml`, and audits the same testnet database after recovery. Redis and PostgreSQL use their fixed names (`pumpnow-redis`, `pumpnow-postgres`) so the runner reuses an existing container even when it was originally created under another Compose project; it never removes either container or volume. After PostgreSQL returns `accepting connections`, Prisma migration deployment runs directly from the checked-in CLI against the selected environment URL instead of creating a temporary Compose service with conflicting dependencies.

The runner preserves database volumes. It does not reset the chain or database. It performs controlled restarts in this order: indexer, Redis, API, PostgreSQL. It finishes with the database invariant audit.

## Expected invariants

- The indexer checkpoint never moves backwards after restart.
- Replayed logs are absorbed by `indexed_events(transaction_hash, log_index)` and never create a second trade.
- A lost Redis lease stops processing before further RPC/database work. The worker reacquires leadership before resuming.
- Redis reconnects with automatic resubscription.
- The recovery runner waits for `redis-cli ping` after restart and repairs an exited Redis service with `compose up -d` before publishing its probe.
- Every newly built API image sends `sync.required` on SSE connection; the web client invalidates its API queries after API/Redis recovery. The restart runner additionally publishes an `api-recovery-probe` after connecting, so it can validate Redis → API → SSE even when testing an older already-built container image.
- Prisma-backed API and indexer processes recover after PostgreSQL becomes healthy.
- `prisma migrate deploy` completes without creating an unexpected migration.

## Transaction-during-restart test

For the release acceptance run, submit Launch/Buy/Sell transactions while `docker compose restart indexer` is in progress. After the indexer health checkpoint reaches the transaction block, run `npm run stress:audit`. Record the pre-restart checkpoint, transaction hashes, final checkpoint, and audit output in the release ticket.

## Failure handling

Do not reset volumes to hide a failure. Capture `docker compose logs --since 10m indexer api redis postgres`, preserve the failing transaction hashes, and reproduce with the same checkpoint. A reorg hash mismatch remains fail-safe and requires a bounded backfill; automatic rollback is not implemented.

## Latest result (2026-07-21)

Status: **PASS**

- Pre-recovery smoke: PASS for API, indexer and web.
- Recovery command completed successfully from the user's Docker-enabled VS Code terminal: `npm run recovery:test`.
- The suite reported `Restart/recovery suite PASS` after its controlled service restarts.
- Post-recovery database invariant audit: PASS with 2 tokens, 29 trades, 3 active holders, 0 duplicate trades, 0 candle mismatches and 0 token-counter mismatches.
