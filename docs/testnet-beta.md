# PumpNow Testnet Beta

Last updated: 2026-07-21

## Scope

This document is the release record for the Arc Testnet Beta. A checked item means it was reproduced in the current environment; historical claims are not treated as evidence.

## Automated regression

- [x] 2026-07-21 (current pass): npm lint, typecheck, 6 API suites/10 tests, 4 indexer suites/15 tests, and the full production build passed after the Home carousel/artwork/responsive changes.
- [x] 2026-07-21: Full npm regression rerun after the launchpad redesign and RPC batching change: lint, typecheck, 10 API tests, 15 indexer tests and production builds all passed with Turbo cache bypassed.
- [x] 2026-07-21: npm lint passed with Turbo cache bypassed.
- [x] 2026-07-21: npm typecheck passed with Turbo cache bypassed.
- [x] 2026-07-21: API tests passed: 6 suites, 10 tests.
- [x] 2026-07-21: Indexer tests passed: 4 suites, 15 tests, including managed-RPC configuration gates.
- [x] 2026-07-21: Production build passed for web, API, indexer and database packages.
- [ ] Foundry DEX regression rerun in the current session. Blocked because there is no native `forge` binary, WSL reports no installed distribution, Docker daemon access is denied, and downloading the official Windows release failed at the host TLS credential layer. Existing artifacts are not accepted as a fresh pass.

## UI acceptance

- [x] 2026-07-21 (current pass): Live Home was inspected directly at desktop and 390x844 using indexed Arc Testnet data. The API returned two graduated tokens, ten trades and non-zero volume; Home no longer depends on an empty-state-only review.
- [x] 2026-07-21 (current pass): Added accessible previous/next controls to desktop Featured and Trending rails, native touch scrolling on mobile, deterministic generated artwork for tokens without logos, structured card skeletons, and tighter mobile rail/tab overflow rules. The updated source passes lint, typecheck and production build; the running Docker web container still needs rebuild/restart before visual acceptance of this exact revision.
- [x] 2026-07-21: Home information architecture refined against the supplied launchpad reference: compact beta banner, persistent search/actions, horizontal Featured and Trending rails, and a tabbed Explore coins grid. Branding, labels, market content and visual treatment remain original to PumpNow.
- [x] 2026-07-21: Home redesigned as an original PumpNow launchpad shell with desktop sidebar, global search/action bar, Trending, New tokens, Top volume and Graduating surfaces. The layout uses PumpNow's lime-on-ink identity and does not reuse Pump.fun branding or copy.
- [x] 2026-07-21: Responsive navigation now becomes a five-item bottom bar on tablet/mobile, while token grids collapse from four to two to one column.
- [x] 2026-07-21: Token cards now expose market cap, 24h volume, curve progress, holders, trades and price with lazy-loaded, dimensioned token artwork.
- [x] 2026-07-21: Search intent is debounced before route prefetch; TanStack Query uses 30-second freshness, ten-minute garbage collection, reconnect refetch and bounded exponential retry.
- [x] Home, Launch and Status pages render in the latest local web build.
- [x] Mobile launch page verified at 390 x 844 with no horizontal overflow.
- [x] API/indexer failure is surfaced as `degraded` on `/status`.
- [x] Wallet connection failure now provides an actionable message.
- [x] Graduated tokens render a PumpNow DEX swap panel instead of the closed bonding-curve trade panel.
- [ ] Connect and switch between real wallet accounts. The in-app test browser has no usable injected test wallet.
- [ ] Launch token transaction on Arc Testnet.
- [ ] Bonding-curve buy and sell on Arc Testnet.
- [ ] Automatic graduation and DEX liquidity migration.
- [ ] Native-to-token and token-to-native DEX swaps using funded test wallets.
- [ ] Realtime trade, chart and portfolio reconciliation after those transactions.
- [ ] Wrong-network switching with a real wallet. UI path exists; wallet confirmation was not available in this session.

## RPC resilience

- [x] 2026-07-21: Unique block timestamps are fetched in bounded batches of eight, reducing sequential RPC latency without creating an uncontrolled request burst. RPC retries include jitter to avoid synchronized retry storms.
- [x] Indexer accepts ordered `RPC_URLS` endpoints and uses ranked Viem fallback transports.
- [x] Indexer operations use bounded exponential retry with jitter.
- [x] Web accepts `NEXT_PUBLIC_RPC_URLS` and uses ranked fallback transports with bounded retry.
- [x] Testnet Docker Compose forwards both RPC endpoint lists into the built services.
- [x] Testnet indexer startup rejects duplicate endpoints, fewer than two endpoints, or the Arc public RPC in either managed slot.
- [x] Preflight checks chain ID, head lag and factory bytecode independently through every configured endpoint.
- [x] Acceptance transactions, reads and receipt polling use the same ordered Viem fallback transport instead of relying on `RPC_URL` alone.
- [ ] Configure at least two independent managed Arc RPC providers in `.env.testnet`. Current file has no `RPC_URLS` or `NEXT_PUBLIC_RPC_URLS`; the public endpoint must remain last in the list.

Example:

```env
RPC_URLS=https://primary.example,https://secondary.example,https://rpc.testnet.arc.network
NEXT_PUBLIC_RPC_URLS=https://primary.example,https://secondary.example,https://rpc.testnet.arc.network
```

## Operations

- [x] 2026-07-21 (current pass): Live checks succeeded for web (`200`), API health (PostgreSQL and Redis up), and indexer health (worker running). At observation time the indexer was 32 blocks behind the Arc Testnet head.
- [x] API health checks PostgreSQL and Redis.
- [x] Indexer health checks PostgreSQL, Redis, worker lease, latest indexed block and latest chain block.
- [x] `/status` dashboard polls API and indexer health every 30 seconds.
- [x] API request logging and structured indexer event logging are enabled.
- [x] Beta Compose rotates container logs and runs an internal web/API/indexer-lag monitor with optional webhook state-change alerts.
- [x] Nginx is the only public application listener in the VPS manifest; data services and application ports bind to localhost.
- [x] Feedback link can be enabled through `NEXT_PUBLIC_FEEDBACK_URL`.
- [ ] Configure the real feedback destination.
- [ ] Export logs to the selected production log platform.
- [ ] Configure external uptime checks and alerts for API/indexer lag.
- [ ] Verify PostgreSQL backup and restore on the beta host.

## Deployment

- [ ] Stable public web deployment.
- [ ] Stable public API deployment.
- [ ] Stable public indexer deployment.

Deployment was not executed in this session. The repository has no target host/provider configuration available here, Docker daemon access is denied to this execution environment, and the instruction forbids pushing source. Record public URLs and deployment identifiers here only after a real deployment succeeds.

The complete host/provider handoff is in `docs/testnet-deployment-manifest.md`. All `PENDING` values are release blockers.

## Known issues

1. Arc public RPC rate limits make it unsuitable as the only beta RPC.
2. A fresh Foundry run remains required before publishing the beta contracts.
3. Wallet-dependent UI paths still require manual acceptance with at least two funded test wallets.
4. Monitoring is currently an in-product health dashboard plus structured logs; external alert delivery is not configured.
5. `MockDexAdapter` must remain local-only. Arc Testnet Beta must use `PumpDexAdapter`; neither adapter is approved for mainnet without an independent audit.
6. `.env.testnet` contains three configured private keys and contract addresses, but the two managed RPC lists, public indexer URL and feedback URL are missing. Secrets were not printed or modified during this review.
7. The original visual reference attachment was not available to the execution environment. The redesign follows the requested information architecture, not pixel-level visual matching.
8. The Codex execution sandbox cannot access the Docker Desktop named pipe, although the already-running services are reachable over localhost. Rebuild/restart of the web container must be run from the user's VSCode terminal before the latest Home revision can be accepted visually.

## Current decision

**Code-ready, deployment pending — not stable.** Automated npm regression is green and RPC failover enforcement is now regression-tested. Stable status is blocked by a fresh Foundry run, two real managed RPC endpoints, funded-wallet transaction evidence, a selected deployment host, public health/monitoring evidence and the 72-hour beta observation window.

Run `npm run testnet:release-gate` after filling `.env.testnet` and the deployment manifest. It executes Foundry and npm regression, testnet preflight, manifest validation and public API/indexer health checks, then prints every remaining blocker without marking the beta stable prematurely.

Latest gate run (2026-07-21): npm lint, typecheck, tests and production build passed. Six gates remain blocked: Foundry format, Foundry regression, testnet preflight, completed deployment manifest, public API health and public indexer health.

## Beta exit criteria

- Fresh Foundry regression and npm regression pass from the exact release source.
- Two independent RPC providers pass failover drills without duplicate indexed events.
- Two funded wallets complete Launch, Buy, Sell, Graduation and both DEX swap directions.
- Realtime feed, candles, holders and portfolio reconcile with transaction receipts.
- Public web/API/indexer run for at least 72 hours with acceptable error and indexer-lag rates.
- Alerts, backups, feedback ownership and incident response contacts are assigned.
- No critical or high-severity unresolved security finding.

Meeting these criteria makes the beta stable; it does not by itself authorize mainnet deployment.
