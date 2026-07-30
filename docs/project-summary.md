# PumpNow — Project Summary

Last updated: 2026-07-30

## 1. Product goals

PumpNow is a meme-token launchpad built for Arc Testnet. It is designed as an operational product rather than a short-lived demo.

The primary MVP flow is:

```text
Connect wallet
  → Create token
  → Buy or sell on the bonding curve
  → Token reaches the graduation threshold
  → Liquidity moves to PumpNow DEX
  → Swap on the DEX
```

Core features:

- Create ERC-20 meme tokens with a connected wallet.
- Buy and sell through a constant-product bonding curve.
- Collect platform trading fees.
- Graduate tokens when the configured threshold is reached.
- Swap graduated tokens through a permanent DEX pool.
- Home, Search, Launch, Token Detail, Portfolio, DEX, and Network Status pages.
- Token feeds, holders, trades, charts, market capitalization, volume, and real-time updates.

Outside the MVP scope: KYC, creator profiles, trust scores, AI, NFTs, DAOs, referrals, leaderboards, native mobile applications, and multichain support.

## 2. System architecture

```text
Wallet
  │ signs and submits transactions
  ▼
Arc Testnet smart contracts
  │ emit events
  ▼
Indexer ── Redis Pub/Sub
  │              │
  ▼              ▼
PostgreSQL ← NestJS API
                 │
                 ▼
             Next.js Web
```

The frontend uses the blockchain for wallet connectivity, required quotes, allowances, and transaction submission. Displayed market data comes from the API and indexer instead of scanning the chain directly from the browser. A same-origin RPC proxy retries public RPC reads used by the web application.

## 3. Technology

- Frontend: Next.js 16, React 19, TypeScript, Wagmi, Viem, TanStack Query, and Lightweight Charts.
- Backend: NestJS, PostgreSQL, Prisma, and Redis.
- Indexer: NestJS worker, Viem, checkpoints, an event ledger, and Redis locking.
- Smart contracts: Solidity, Foundry, and OpenZeppelin-style security primitives.
- Local and beta infrastructure: Docker, Docker Compose, Nginx templates, tunnels, and health checks.
- Monorepo: npm workspaces and Turborepo.

## 4. Monorepo structure

```text
pumpnow/
├── apps/
│   ├── web/          Next.js frontend
│   ├── api/          NestJS REST API and real-time endpoints
│   └── indexer/      Blockchain event indexer
├── contracts/        Foundry smart contracts, tests, and deployment scripts
├── packages/
│   ├── database/     Prisma schema and client
│   ├── config/
│   ├── types/
│   ├── ui/
│   ├── eslint-config/
│   └── tsconfig/
├── docker/           Dockerfiles and Nginx templates
├── docs/             Technical and acceptance documentation
├── scripts/          Deployment, smoke, recovery, and stress scripts
├── docker-compose.yml
├── docker-compose.testnet.yml
└── turbo.json
```

## 5. Smart contracts

Main components:

- `PumpFactory`: creates token/pair contracts and maintains the registry.
- `MemeToken`: the ERC-20 contract for each launched token.
- `PumpPair`: bonding-curve pricing, buy/sell accounting, reserves, and graduation.
- `Treasury`: receives and manages platform fees.
- `IDexAdapter`: interface used to transfer liquidity after graduation.
- `PumpDexAdapter`: Arc Testnet adapter for PumpNow DEX.
- `PumpDexFactory` and `PumpDexPool`: permanent pools and swaps for graduated tokens.
- `MockDexAdapter`: local-test adapter that must not be used for public beta deployments.

The factory mints the complete token supply to its bonding pair. Up to 79.31% of the supply is sold through the curve. At graduation, the remaining 20.69% and all real native liquidity move into a permanent DEX pool. The resulting liquidity position is permanently locked.

The bonding curve uses a 107.30% virtual token reserve and a configured initial virtual native reserve. Virtual reserves determine pricing; real native reserves determine solvency. Sell quotes are capped at the real native reserve to prevent a one-wei rounding excess during a complete curve unwind.

Primary indexer events:

```text
TokenCreated
Buy
Sell
FeeCollected
Graduated
DEX swap events
```

## 6. Database and indexer

The schema covers these primary domains:

- Wallet
- Token
- Trade
- Holder
- LiquidityPool
- Candles for 1m, 5m, and 1h intervals
- FeeHistory
- PlatformStats
- IndexerState
- Event ledger for idempotent processing

Indexer capabilities:

- Historical backfill and live polling.
- Last-processed-block checkpoints.
- Idempotency by transaction hash and log index.
- Redis worker locking.
- Retry, backoff, and RPC fallback.
- Basic reorganization recovery.
- Candle aggregation.
- Real-time publication through Redis.

## 7. API

Important endpoints:

```text
GET /api/health
GET /api/tokens
GET /api/tokens/:address
GET /api/tokens/:address/trades
GET /api/tokens/:address/holders
GET /api/tokens/:address/candles
GET /api/wallets/:address/portfolio
GET /api/stats/platform
GET /api/search?q=
GET /api/realtime/events
```

The API includes validation, BigInt/Decimal serialization, Redis caching, request logging, rate limiting, CORS, and health checks.

## 8. Frontend

The interface uses PumpNow's lime-on-black visual identity and includes:

- Responsive sidebar navigation.
- Global search and wallet controls.
- Featured-launch and trending carousels.
- Token discovery views for personalized, new, and top-volume listings.
- Generated artwork when a token has no logo.
- Skeleton, loading, error, and empty states.
- Responsive desktop, tablet, and mobile layouts.

Implemented wallet and transaction flows:

- Connect and disconnect a wallet.
- Detect the wrong network and switch to Arc Testnet.
- Launch a token and navigate directly to its trading page.
- Buy and sell on the bonding curve.
- Display live buy and sell quotes, fees, slippage, balances, and maximum amounts.
- Approve ERC-20 transfers before selling.
- Swap graduated tokens in either direction on PumpNow DEX.
- Track transaction receipts and refresh API/indexer data after confirmation.
- Retry RPC reads through a same-origin production proxy.

Recent transaction UX corrections:

- Sell approval is explicit and confirmed from on-chain allowance state.
- Maximum sells retain one indivisible token unit for legacy pairs affected by the previous one-wei rounding bug.
- New pairs cap gross sell output at their real native reserve.
- Confirmed transactions trigger trade, holder, token, statistics, and portfolio refreshes.

## 9. Runtime status

The Arc Testnet stack runs through Docker:

- Web: `http://localhost:3000` for local deployments and `https://www.pumnow.xyz` for production.
- API: PostgreSQL and Redis health at `http://localhost:3001/api/health`.
- Indexer: worker health and chain lag at `http://localhost:3002/health`.
- Production frontend: Vercel.
- Public API and indexer access: managed background tunnels during the current testnet phase.

Current regression coverage includes:

- ESLint.
- TypeScript type checking.
- API tests.
- Indexer tests.
- Next.js production builds.
- Foundry unit, fuzz, invariant, graduation, DEX, and full-unwind tests.

## 10. Starting the Testnet stack

```cmd
docker compose --env-file .env.testnet -f docker-compose.yml -f docker-compose.testnet.yml up --build -d
```

Check services:

```cmd
docker compose --env-file .env.testnet -f docker-compose.yml -f docker-compose.testnet.yml ps
curl http://localhost:3001/api/health
curl http://localhost:3002/health
```

View logs:

```cmd
docker compose --env-file .env.testnet -f docker-compose.yml -f docker-compose.testnet.yml logs -f api indexer web
```

Rebuild only the web application after a frontend change:

```cmd
docker compose --env-file .env.testnet -f docker-compose.yml -f docker-compose.testnet.yml up --build -d web
```

## 11. Important configuration

`.env.testnet` requires at least:

```env
CHAIN_ID=5042002
RPC_URL=https://rpc.testnet.arc.network
RPC_URLS=https://rpc.testnet.arc.network
PUMP_FACTORY_ADDRESS=0x...

NEXT_PUBLIC_CHAIN_ID=5042002
NEXT_PUBLIC_RPC_URL=https://rpc.testnet.arc.network
NEXT_PUBLIC_RPC_URLS=https://rpc.testnet.arc.network
NEXT_PUBLIC_PUMP_FACTORY_ADDRESS=0x...
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_INDEXER_URL=http://localhost:3002
```

Never commit `.env.testnet`, private keys, secrets, or managed RPC URLs containing API keys.

## 12. Testnet beta status

Current status:

> **Code-ready testnet beta with a deployed public frontend; continued acceptance, monitoring, and independent security review are required before any production-value use.**

Requirements before declaring the beta stable:

1. Run fresh Foundry formatting, build, and tests from the exact release source.
2. Test manually with at least two funded Arc Testnet wallets.
3. Validate the complete Launch → Buy → Sell → Graduation → DEX flow in both swap directions.
4. Confirm that real-time data, charts, holders, and portfolios match transaction receipts.
5. Move the API and indexer from temporary tunnels to durable managed infrastructure.
6. Configure permanent domains, TLS, external monitoring, alerts, and log retention.
7. Test PostgreSQL backup and restore procedures.
8. Run a public beta for at least 72 hours while monitoring errors and indexer lag.
9. Complete an independent security review before handling real financial value.

Arc does not currently have an official mainnet deployment in this project. The target is a stable, production-ready beta on testnet, not a mainnet release.

## 13. Development rules

- Do not add features outside the agreed roadmap without review.
- Prioritize correctness, security, and acceptance testing.
- Every change must pass appropriate lint, type checks, tests, and builds.
- Avoid `any`; prefer explicit types or `unknown`.
- Display indexed market data from the API/indexer.
- Never commit secrets or private keys.
- Perform an independent contract security review before production-value deployment.

## 14. Related documentation

- `docs/testnet-beta.md`: release record and beta exit criteria.
- `docs/testnet-acceptance.md`: acceptance evidence.
- `docs/security-review.md`: security review.
- `docs/restart-recovery.md`: restart and recovery testing.
- `docs/stress-test.md`: stress testing.
- `docs/testnet-deployment-manifest.md`: deployment configuration and blockers.
- `docs/testnet-vps-runbook.md`: beta VPS operations guide.
