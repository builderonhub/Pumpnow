# PumpNow Arc Testnet DEX Readiness

Status: **IN PROGRESS — testnet only**

## What is implemented

- `ArcUniswapV3Adapter` implements the existing `IDexAdapter` boundary for a Uniswap V3-compatible position manager.
- The configured initial square-root price is defined in meme-token/USDC raw units and is inverted automatically when address sorting puts USDC at `token0`.
- Deployment uses verified environment-supplied addresses; no DEX address is guessed or hard-coded.
- The adapter permits only a `PumpPair` whose immutable `factory()` equals the one-time bootstrapped `PumpFactory`.
- Position NFTs are minted to the configured graduation recipient (currently the factory). The adapter cannot withdraw the position.
- Arc native USDC (18-decimal `msg.value`) is converted to its canonical ERC-20 interface (6 decimals) using `1e12`. Sub-micro-USDC dust is explicitly accounted in `nativeDust`, emitted, and can only be swept by the current factory owner.
- Graduation remains atomic: pool creation or mint failure reverts the graduation and restores pair state/reserves.
- The existing `Graduated` event already contains adapter, native amount, token amount and position ID. The indexer/API require no schema change for this adapter. `DexLiquidityCreated` is additional reconciliation evidence.
- Indexer RPC failover accepts an ordered `RPC_URLS` list and health-ranks transports.

## PumpNow DEX path

PumpNow now includes its own constant-product DEX for Arc Testnet: `PumpDexFactory`, `PumpDexPool`, and `PumpDexAdapter`. Graduation creates the pool, transfers both reserves atomically, and permanently locks LP shares at the burn address. This removes the dependency on an external DEX for testnet acceptance.

Before removing this blocker, record:

- protocol/version and official deployment source;
- factory, position manager/router and pool-init semantics;
- deployed bytecode hashes;
- supported fee tier and tick spacing;
- canonical Arc USDC compatibility;
- position NFT ownership/lock policy;
- audited adapter commit and independent review.

This is a PumpNow-owned testnet DEX, not Uniswap, and must be labeled accordingly.

## Reserve and migration invariants

For every graduation transaction verify:

1. Pair status is `GRADUATED`, `nativeReserve == 0`, and buy/sell revert.
2. Adapter event native amount equals the pair `Graduated.nativeLiquidity`.
3. ERC-20 USDC deposited equals `floor(nativeLiquidity / 1e12)`.
4. `nativeDust` delta equals `nativeLiquidity % 1e12`.
5. Meme-token amount consumed equals the pre-graduation pair inventory.
6. Position manager reports the returned token ID, expected tokens, fee tier, ticks, liquidity and owner.
7. Pair and adapter retain no unaccounted meme-token balance or allowance.
8. Indexer records exactly one graduation and API returns the same position ID/status.

## Production controls

- Admin must be a hardware-backed multisig; deployer EOA ownership is forbidden.
- Transfer both `PumpFactory` and `Treasury` ownership, then test the multisig operations before launch.
- Pause is pair-scoped. Maintain a tested batch emergency script and an inventory of every registered pair.
- Adapter and graduation settings are immutable per pair. Changing factory defaults affects only newly created pairs; document this operationally.
- Require two independent managed RPC providers in `RPC_URLS`; public Arc RPC is fallback/diagnostic only.
- Store keys and database/Redis credentials in a secret manager. Never place private keys in compose files, images, CI logs or shell history.
- Production startup must fail on missing/malformed env. Validate chain ID and bytecode at all configured contract addresses during preflight.
- Use structured logs with request/trace ID and redact authorization headers, wallet signatures, URLs containing credentials and RPC keys.
- Alert on API error rate/latency, indexer lag/checkpoint age, RPC failover, Redis lease loss, DB saturation, graduation failures and reserve mismatches.
- Enforce edge and application rate limits separately. Exempt only authenticated internal health/metrics scraping.
- Run encrypted PostgreSQL backups with PITR, off-site retention, restore drills and documented RPO/RTO. Backing up without a successful restore drill does not pass.

## Required testnet acceptance with published DEX

- Deploy via `DeployDexReady.s.sol` with verified addresses.
- Launch at least three tokens using distinct wallets.
- Exercise partial buys/sells and one graduation per token.
- Reconcile all eight reserve/migration invariants above.
- Restart indexer/API/Redis during the run and confirm idempotency.
- Confirm swaps and liquidity visibility through the DEX's official UI/indexing path.
- Attach transaction, pool and NFT-position links to the release evidence.

## Current decision

### Final review delta (2026-07-21)

The review found and fixed a pool pre-seeding/graduation donation risk:

- `PumpDexFactory.createPool` is now restricted to a one-time configured graduation adapter.
- `PumpDexPool.addLiquidity` now permits only the initial graduation seed; a second seed reverts.
- Tests were added for unauthorized pool creation, pool-creator configuration replay and a second liquidity seed.

These changes are source-reviewed but remain **UNVERIFIED BY FOUNDRY IN THIS RUNNER** because Forge is unavailable. They must pass the complete Foundry suite before deployment.

The next gate is Foundry build/test followed by Arc Testnet deployment and full Launch → Buy → Graduation → DEX Swap acceptance. No production release is implied.
