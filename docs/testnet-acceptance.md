# PumpNow Testnet Acceptance

## Target environment

- Network: Arc Testnet
- Chain ID: `5042002`
- HTTP RPC: `https://rpc.testnet.arc.network`
- WebSocket RPC: `wss://rpc.testnet.arc.network`
- Native gas token: USDC (18 decimals)
- Explorer: `https://testnet.arcscan.app`
- Faucet: `https://faucet.circle.com`
- Mainnet deployment: explicitly out of scope

Arc Testnet has deterministic finality, so the indexer uses zero additional confirmations. Testnet can still experience upgrades or downtime; retry and checkpoint behavior must remain enabled.

## Safety rules

- Use fresh test-only wallets. Never use a wallet that holds mainnet assets.
- Never commit `.env.testnet`, private keys, or faucet credentials.
- `MockDexAdapter` is permitted only for acceptance testing. It is not a production DEX integration.
- Do not reuse these deployment parameters for mainnet.

## Account and faucet checklist

- [ ] Deployer wallet created and address recorded privately.
- [ ] Buyer A wallet created and address recorded privately.
- [ ] Buyer B wallet created and address recorded privately.
- [ ] All three wallets added to Arc Testnet (chain ID `5042002`).
- [ ] All three wallets funded with testnet USDC from the Circle Faucet.
- [ ] `PRIVATE_KEY` contains the deployer test key.
- [ ] `TEST_WALLET_PRIVATE_KEYS` contains Buyer A and Buyer B keys, comma-separated.
- [ ] `ACCEPTANCE_MAX_TOTAL_NATIVE_WEI` is reviewed; the runner aborts before exceeding this spend cap.
- [ ] `npm run testnet:preflight` reports the expected chain and non-zero balances.

## Deployment checklist

1. Copy `.env.testnet.example` to `.env.testnet` and fill only the missing secret values.
2. Install Foundry (`forge`, `cast`) in the terminal environment used by VS Code.
3. Run `powershell -ExecutionPolicy Bypass -File scripts/deploy-testnet.ps1` from the repository root.
4. Confirm `PumpFactory` and `MockDexAdapter` deployment transactions on Arcscan.
5. Confirm `.env.testnet` was updated with factory, adapter, and start block.
6. Run `npm run testnet:preflight` again; factory bytecode must be present.

Arcscan currently supports transaction and bytecode inspection. Official Arc deployment documentation does not publish a Foundry source-verification API contract, so automated source verification is not claimed here. If Arcscan exposes Blockscout verification for this deployment, verify interactively and record the verified URL below.

## Stack startup

```text
docker compose --env-file .env.testnet -f docker-compose.yml -f docker-compose.testnet.yml up --build -d
```

Then verify:

- [ ] PostgreSQL healthy.
- [ ] Redis healthy.
- [ ] API healthy at `http://localhost:3001/api/health`.
- [ ] Indexer healthy at `http://localhost:3002/health` and advancing.
- [ ] Web opens at `http://localhost:3000` and shows Arc Testnet.
- [ ] Browser wallet rejects or prompts on a wrong chain.

## Automated acceptance flow

Run `npm run testnet:acceptance`. The script uses three wallets and checks:

- [ ] Launch Token emits `TokenCreated`.
- [ ] Indexer writes the token and API returns it.
- [ ] Buyer A buys.
- [ ] Buyer A approves and sells part of the position.
- [ ] Buyer B buys until the acceptance graduation threshold is reached.
- [ ] Pair becomes `GRADUATED` and rejects further curve trading.
- [ ] API exposes graduated status and trades.
- [ ] At least one 1-minute candle exists.
- [ ] Buyer A portfolio endpoint responds.

Manual UI checks:

- [ ] New token appears without a page refresh (SSE).
- [ ] Trade feed updates after buy/sell (SSE).
- [ ] Chart and volume update after indexed trades.
- [ ] Transaction links open on Arcscan.
- [ ] Mobile launch, trade, chart, and portfolio screens are usable.

## Results

Status: **BLOCKED — external testnet credentials/tooling required**

Local verification completed on 2026-07-20:

- [x] Monorepo production build succeeds.
- [x] Arc Testnet network parameters checked against official Arc documentation.
- [x] Testnet env template added for API, indexer, web, and contracts.
- [x] Acceptance-only deployment script added.
- [x] Deployment output sync and RPC/wallet preflight added.
- [x] Multi-wallet acceptance runner added.
- [x] Next.js Docker build now receives `NEXT_PUBLIC_*` values at build time.
- [ ] Contracts deployed to Arc Testnet.
- [ ] Automated multi-wallet acceptance executed on Arc Testnet.
- [ ] Manual realtime/UI acceptance completed.

## Defects found and fixed

### TA-001 — Testnet web image silently used local/public defaults

`NEXT_PUBLIC_*` values were supplied only as container runtime environment variables. Next.js embeds these values during `next build`, so the generated image could point at the wrong chain, RPC, API, or factory. Fixed by adding explicit Docker build arguments and testnet compose mappings.

### TA-002 — Explorer links unavailable in chain configuration

The Viem chain definition omitted the Arcscan explorer. Fixed by adding `NEXT_PUBLIC_BLOCK_EXPLORER_URL` to the chain configuration and environment templates.

### TA-003 — No reproducible acceptance deployment

The generic deployment expected an already deployed DEX adapter. Added an acceptance-only deployer that creates `MockDexAdapter` and `PumpFactory` together. The mock is clearly prohibited for mainnet.

### TA-004 — No guard against wrong RPC, empty wallets, or stale factory address

Added a preflight that checks chain ID, latest block, wallet balances, factory address format, and deployed bytecode before acceptance traffic is sent.

## Remaining risks and follow-up

- A real Arc-compatible DEX adapter is required before any production deployment.
- Testnet keys and faucet funding must be supplied by the project owner; they are intentionally not generated or stored in Git.
- Source verification depends on Arcscan exposing a supported verification flow/API.
- Public RPC rate limits may require a managed Arc RPC endpoint for stress testing.
- Acceptance must be rerun after every contract deployment because indexer start block and factory address change.
- Mainnet remains blocked pending contract audit, real DEX integration, operational secrets management, and a separate approval.
