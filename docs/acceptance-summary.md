# PumpNow acceptance summary

Updated: 2026-07-21

| Gate | Status | Latest evidence |
| --- | --- | --- |
| Testnet acceptance | PASS (automated) | Public Arc flow passed Launch, Buy, Sell, Graduation, locked LP, two-way DEX swaps, indexer/API/chart and portfolio checks. Manual UI checks remain open. |
| Restart/recovery | PASS | User-run Docker recovery suite completed; post-recovery audit found 0 duplicates and 0 candle/counter mismatches. |
| Stress/data invariants | PASS | 29 persisted trades; zero duplicates, candle mismatches or token counter mismatches. |
| npm regression | PASS | Lint, typecheck, 22 unit tests, 2 e2e tests and all production builds pass. |
| Local smoke | PASS | API, indexer and web health checks pass. |
| Foundry regression | BLOCKED | Forge unavailable and no WSL distribution accessible. |
| DEX/graduation source review | CONDITIONAL PASS | Pool pre-seeding/repeat-liquidity issue fixed; contract tests still must run. |
| Mainnet release | FAIL / NOT APPROVED | Independent audit, Arc DEX validation, operational controls and full testnet evidence remain open. |

No commit, push or mainnet deployment was performed by this review.
