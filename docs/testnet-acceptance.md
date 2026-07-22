# PumpNow Testnet Acceptance

## Target environment

- Network: Arc Testnet
- Chain ID: `5042002`
- HTTP RPC: `https://rpc.testnet.arc.network`
- WebSocket RPC: `wss://rpc.testnet.arc.network`
- Native gas token: USDC (18 decimals)
- Explorer: `https://testnet.arcscan.app`
- Faucet: `https://faucet.circle.com`
- Public production deployment: explicitly out of scope

Arc Testnet has deterministic finality, so the indexer uses zero additional confirmations. Testnet can still experience upgrades or downtime; retry and checkpoint behavior must remain enabled.

## Safety rules

- Use fresh test-only wallets. Never use a wallet that holds valuable assets.
- Never commit `.env.testnet`, private keys, or faucet credentials.
- `MockDexAdapter` is permitted only for acceptance testing. It is not a production DEX integration.
- Do not reuse these deployment parameters for public production.

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

Status: **PASS — automated Arc Testnet acceptance completed; manual UI checks remain open**

Local verification completed on 2026-07-20:

- [x] Monorepo production build succeeds.
- [x] Arc Testnet network parameters checked against official Arc documentation.
- [x] Testnet env template added for API, indexer, web, and contracts.
- [x] Acceptance-only deployment script added.
- [x] Deployment output sync and RPC/wallet preflight added.
- [x] Multi-wallet acceptance runner added.
- [x] Next.js Docker build now receives `NEXT_PUBLIC_*` values at build time.
- [x] Contracts deployed to Arc Testnet.
- [x] Automated multi-wallet acceptance executed on Arc Testnet.
- [ ] Manual realtime/UI acceptance completed.

## Defects found and fixed

### TA-001 — Testnet web image silently used local/public defaults

`NEXT_PUBLIC_*` values were supplied only as container runtime environment variables. Next.js embeds these values during `next build`, so the generated image could point at the wrong chain, RPC, API, or factory. Fixed by adding explicit Docker build arguments and testnet compose mappings.

### TA-002 — Explorer links unavailable in chain configuration

The Viem chain definition omitted the Arcscan explorer. Fixed by adding `NEXT_PUBLIC_BLOCK_EXPLORER_URL` to the chain configuration and environment templates.

### TA-003 — No reproducible acceptance deployment

The old acceptance deployer created `MockDexAdapter`. Public Arc Testnet now uses `DeployPumpDexTestnet` and the PumpNow DEX; the mock is local-only.

### TA-004 — No guard against wrong RPC, empty wallets, or stale factory address

Added a preflight that checks chain ID, latest block, wallet balances, factory address format, and deployed bytecode before acceptance traffic is sent.

## Remaining risks and follow-up

- A real Arc-compatible DEX adapter is required before any production deployment.
- Testnet keys and faucet funding must be supplied by the project owner; they are intentionally not generated or stored in Git.
- Source verification depends on Arcscan exposing a supported verification flow/API.
- Public RPC rate limits may require a managed Arc RPC endpoint for stress testing.
- Acceptance must be rerun after every contract deployment because indexer start block and factory address change.
- Public production use remains blocked pending contract audit, operational secrets management, and separate approval.

## Latest evidence (2026-07-21)

| Check | Status | Evidence |
| --- | --- | --- |
| npm lint | PASS | Turbo: 3/3 lint tasks successful |
| npm typecheck | PASS | Turbo: 3/3 typecheck tasks successful |
| npm unit tests | PASS | API 10/10 and indexer 12/12 tests passed |
| API e2e | PASS | 2/2 tests passed |
| npm production build | PASS | Database, API, indexer and Next.js builds successful |
| local smoke | PASS | API health, indexer health and web checks passed |
| database invariant audit | PASS | 2 tokens, 29 trades, 0 duplicate trades, 0 candle/counter mismatches |
| Foundry regression | BLOCKED | `forge` is unavailable and this runner has no installed WSL distribution |
| public Arc multi-wallet acceptance | NOT RUN | Requires funded test wallets and explicit testnet execution |
| manual realtime/mobile acceptance | NOT RUN | Requires an interactive browser/wallet session |

At that intermediate checkpoint the gate was blocked; the subsequent public-chain run below now closes the automated acceptance gate.

## Arc Testnet automated acceptance evidence (2026-07-21)

Status: **PASS**

The complete automated flow finished successfully:

- Indexer caught up from 33 blocks of lag to 0.
- Launch, bonding-curve buy, approve/sell and graduation passed.
- Graduation pool reserves reconciled and LP liquidity was permanently locked.
- Native-to-token and token-to-native DEX swaps passed.
- Indexer, API, candle/chart data and portfolio checks passed.

Release evidence:

| Item | Value |
| --- | --- |
| Token | `0x739Af46EE323C88D554E6CBbF5EC2E8847c2Bb63` |
| Bonding pair | `0x19c675df16cAF4B887eD2CE3CB9Ca6ADd2cF4Bf5` |
| DEX pool | `0x32fd4df49f1946daddcbb8632cc11dda6b50663b` |
| Locked LP shares | `713817105465048378732` |
| Launch transaction | `0x95d2a9964e42eb733b26c817c948f6635838a9d127b769adfc1aa95cab055a85` |
| Curve buy transaction | `0x51e5e523ac689c9086cbdf1384afcbbdc082a4b1f124019da05af4d2edb4ac0b` |
| Approve/sell transactions | `0xb8f84c3fba05bad28cc63838be48985199b9da729f5ad29b97db81e6c70eb104`, `0xf99b21ea0c6295d05f58c9ff6e6e882cd27a5db9f7150e245929090ba68cd2cf` |
| Graduation transaction | `0xa461568bee392cf521ec5580f6cce96f778efcbaff306852f1697392389d57dd` |
| DEX native-to-token transaction | `0xf507d9f7b863f237b6ed86f2bf072fded7bda2e6986932cec7a1b10290a6366e` |
| DEX approve/token-to-native transactions | `0x5e138f7ea3877496cbef379ff06e161c8925fa0aeabdb8adf557f75f8caaecb2`, `0x04ad2d1cd1b0537715cf7a91ce25d7e3bb94d6cabea3bc07ba6bc4e7bab1c85f` |

Observed operational warning: the Arc public RPC rate-limited several `eth_call` requests. Bounded retries recovered on the first retry, so correctness passed; production capacity still requires managed RPC failover and monitoring.

The automated testnet gate is PASS. Manual wallet, realtime UI, responsive/mobile and accessibility checks remain separate release checklist items.
