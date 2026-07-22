# PumpNow DEX and graduation security review

Review date: 2026-07-21  
Scope: `PumpPair`, `PumpFactory`, `Treasury`, `PumpDexAdapter`, `PumpDexFactory`, `PumpDexPool`, and `ArcUniswapV3Adapter`.  
This is an internal engineering review, not an independent audit.

## Executive result

Status: **CONDITIONAL PASS FOR CONTINUED TESTNET WORK; FAIL FOR MAINNET RELEASE**

One high-impact design issue was found and fixed: permissionless pool creation plus repeat liquidity additions allowed a third party to pre-seed a token pool before graduation and distort or donate the migration amounts. Pool creation is now adapter-only and the pool accepts exactly one graduation seed.

The application regression is green. Contract changes still require Foundry execution and an independent review. Mainnet deployment remains prohibited.

## Control checklist

| Area | Status | Evidence / disposition |
| --- | --- | --- |
| Bonding-curve accounting | PASS (source + existing tests) | Buy increases `tokensSold/nativeReserve`; sell reverses gross reserve; fees go to Treasury. |
| Active-pair solvency | PASS (existing invariant) | `address(pair).balance >= nativeReserve`; inventory plus sold supply remains constant before graduation. |
| Graduation atomicity | PASS | State, approval, transfer and adapter call are one transaction; any adapter failure reverts all changes. |
| Graduation replay | PASS | Status becomes `GRADUATED`; curve buy/sell are blocked and adapter is called once. |
| Pool pre-seeding/race | FIXED, PENDING TEST | Only the one-time configured adapter may call `createPool`. |
| Repeat/misaligned liquidity | FIXED, PENDING TEST | `PumpDexPool` rejects a second `addLiquidity` call. |
| Swap slippage | PASS | Both swap directions require caller-provided minimum output. |
| Curve slippage/refunds | PASS | Buy caps total input; sell floors output; excess native input is refunded. |
| Reentrancy/external calls | PASS (source review) | Pair, adapters and pool guard state-changing external-call paths; failures revert atomically. |
| Adapter caller authentication | PASS | Adapter verifies registered pair/token against the configured launch factory. |
| Factory/treasury access control | PASS WITH RISK | Owner gates configuration, pause and withdrawal; ownership is still single-step and EOA-capable. |
| Pause/emergency | PARTIAL | Active bonding pairs can be paused individually. Graduated PumpDex pools have no emergency pause or batch pause. |
| Approval hygiene | PASS FOR CURRENT TOKENS | Exact amounts are approved and consumed atomically; only standard PumpNow tokens are supported. |
| Arc native/canonical USDC conversion | BLOCKED | The `1e12` shared-balance assumption and position-manager semantics require validation against the selected official Arc DEX deployment. |
| DEX price/tick configuration | BLOCKED | Fee tier, tick spacing, initial price and token ordering require protocol-specific integration tests. |
| LP custody | PASS FOR PUMPNOW TESTNET DEX | LP shares are minted to the burn address. External V3 NFT custody/lock policy is not yet proven. |

## Regression evidence

- `npm run lint`: PASS (3/3 tasks).
- `npm run typecheck`: PASS (3/3 tasks).
- `npm run test`: PASS (API 10/10, indexer 12/12).
- `npm run test:e2e --workspace=@pumpnow/api`: PASS (2/2).
- `npm run build`: PASS (database, API, indexer and web).
- `npm run smoke`: PASS (API, indexer and web).
- `npm run stress:audit`: PASS (29 trades, 0 duplicates, 0 candle/counter mismatches).
- Foundry regression: BLOCKED because Forge and a WSL distribution are unavailable in this runner.
- Recovery drill: PASS in the user's Docker-enabled terminal; post-recovery invariant audit also PASS.

## Required before mainnet

1. Run the complete Foundry suite after the pool authorization change, including release-level fuzz/invariant campaigns.
2. Add Slither and an independent contract audit; close all high/medium findings.
3. Validate `ArcUniswapV3Adapter` against exact official Arc DEX addresses and bytecode, including native-USDC/ERC-20 balance semantics.
4. Replace single-step ownership with an approved multisig/timelock or two-step flow and rehearse transfer, pause and withdrawal.
5. Decide and implement an emergency policy for graduated pools.
6. Run public testnet Launch -> Buy -> Sell -> Graduation -> DEX Swap with transaction/pool evidence and reconcile reserves.
7. Preserve the recovery output and checkpoint/idempotency/SSE evidence with the release record.

## Residual risks

- Public Arc RPC rate limits can delay indexing; production requires provider failover and monitoring.
- Automatic bounded reorg rollback is not implemented; the indexer stops safely on checkpoint mismatch.
- The PumpNow DEX is a testnet implementation and has not received an external audit.
- The external Arc V3 adapter remains an unverified integration boundary and must not be selected for mainnet yet.

## Public testnet security evidence update (2026-07-21)

The PumpNow-owned testnet DEX path passed Launch -> Buy -> Sell -> Graduation -> two-way DEX Swap. The graduation pool reported reconciled reserves and `713817105465048378732` LP shares locked. Indexer/API/chart/portfolio reconciliation also passed.

This closes required-before-mainnet item 6 for the PumpNow testnet DEX path only. It does not validate `ArcUniswapV3Adapter`, replace Foundry/static-analysis results, or constitute an independent audit. Public RPC rate limiting occurred during read calls and recovered through bounded retry.
