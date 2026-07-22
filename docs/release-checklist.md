# PumpNow Testnet Release Checklist

## Contracts and DEX

- [ ] PumpNow DEX contracts pass Foundry unit, fuzz and invariant tests.
- [ ] Deployed PumpNow DEX addresses and bytecode hashes are recorded.
- [ ] Adapter and core contracts receive an external audit; findings closed.
- [ ] Real-DEX testnet E2E and reserve reconciliation pass.
- [ ] Position ownership/locking policy approved and tested.
- [ ] Factory and Treasury ownership transferred to multisig.
- [ ] Pause/unpause and dust sweep executed successfully through multisig.

## Data and application

- [ ] Two managed RPC providers pass failover drill.
- [ ] Indexer checkpoint/idempotency/restart test passes against release build.
- [ ] API/indexer env preflight rejects missing or wrong-chain configuration.
- [ ] Rate-limit, load and abuse tests meet documented targets.
- [ ] Logs are structured, searchable and verified free of secrets.
- [ ] Dashboards and paging alerts are exercised, not merely configured.

## Infrastructure and recovery

- [ ] Secrets loaded from production secret manager and rotated after rehearsal.
- [ ] TLS, Cloudflare and origin access rules reviewed.
- [ ] PostgreSQL PITR enabled; encrypted off-site backup restored successfully.
- [ ] Redis loss is confirmed non-authoritative and recovery is tested.
- [ ] RPO/RTO, rollback and incident runbooks approved.
- [ ] Images are pinned by digest and vulnerability scan has no unaccepted critical findings.

## Release decision

## Latest local regression (2026-07-21)

- [x] npm lint and typecheck pass.
- [x] API/indexer unit tests pass (22 total).
- [x] API e2e tests pass (2 total).
- [x] production builds pass for database, API, indexer and web.
- [x] local smoke checks pass for API, indexer and web.
- [x] persisted stress invariant audit passes with no duplicates or counter drift.
- [ ] Foundry suite passes after the pool authorization fix. (BLOCKED: Forge unavailable in current runner.)
- [x] Current recovery drill passes; the post-recovery audit reports 0 duplicates and 0 candle/counter mismatches.

- [x] Testnet acceptance evidence attached.
- [ ] Known risks and owners recorded.
- [ ] Independent security sign-off complete.
- [ ] Explicit Arc Testnet deployment approval recorded.

Until every release gate is checked, public production use is prohibited.

### Automated Arc acceptance update (2026-07-21)

- [x] Automated Arc Testnet acceptance evidence attached in `docs/testnet-acceptance.md`.
- [x] Graduation pool reserves and locked LP shares reconciled.
- [x] Both DEX swap directions completed successfully.
- [x] Indexer/API/chart/portfolio reconciliation passed.
- [ ] Manual wallet/realtime/mobile/accessibility acceptance completed.
- [ ] Managed RPC failover drill completed; public RPC rate limiting was observed during acceptance.
