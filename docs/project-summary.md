# PumpNow — Tổng kết dự án

Ngày cập nhật: 2026-07-22

## 1. Mục tiêu sản phẩm

PumpNow là meme-token launchpad xây dựng cho Arc Testnet. Sản phẩm hướng tới vận hành thật, không phải demo ngắn hạn.

Luồng chính của MVP:

```text
Kết nối ví
  → Tạo token
  → Mua/bán trên bonding curve
  → Token đạt ngưỡng graduation
  → Thanh khoản chuyển sang PumpNow DEX
  → Swap trên DEX
```

Các chức năng chính:

- Tạo ERC-20 meme token bằng ví.
- Mua và bán theo bonding curve.
- Thu phí nền tảng.
- Graduation khi đạt ngưỡng.
- Swap token đã graduation qua DEX pool.
- Trang Home, Search, Launch, Token Detail, Portfolio và Network Status.
- Token feed, holders, trades, chart, market cap, volume và realtime updates.

Không thuộc phạm vi MVP: KYC, creator profile, trust score, AI, NFT, DAO, referral, leaderboard, mobile app và multi-chain.

## 2. Kiến trúc hệ thống

```text
Wallet
  │ ký và gửi transaction
  ▼
Arc Testnet smart contracts
  │ phát events
  ▼
Indexer ── Redis Pub/Sub
  │              │
  ▼              ▼
PostgreSQL ← NestJS API
                 │
                 ▼
             Next.js Web
```

Frontend chỉ dùng blockchain cho kết nối ví, đọc quote cần thiết và gửi transaction. Dữ liệu thị trường hiển thị được lấy từ API/indexer, không quét chain trực tiếp từ giao diện.

## 3. Công nghệ

- Frontend: Next.js 16, React 19, TypeScript, Tailwind CSS, Wagmi, Viem, TanStack Query và Lightweight Charts.
- Backend: NestJS, PostgreSQL, Prisma và Redis.
- Indexer: NestJS worker, Viem, checkpoint, event ledger và Redis lock.
- Smart contracts: Solidity, Foundry và OpenZeppelin-style security primitives.
- Hạ tầng local/beta: Docker, Docker Compose, Nginx manifest và health checks.
- Monorepo: npm workspaces và Turborepo.

## 4. Cấu trúc monorepo

```text
pumpnow/
├── apps/
│   ├── web/          Next.js frontend
│   ├── api/          NestJS REST API + realtime
│   └── indexer/      Blockchain event indexer
├── contracts/        Foundry smart contracts, tests và deploy scripts
├── packages/
│   ├── database/     Prisma schema/client
│   ├── config/
│   ├── types/
│   ├── ui/
│   ├── eslint-config/
│   └── tsconfig/
├── docker/           Dockerfiles và Nginx templates
├── docs/             Tài liệu kỹ thuật/acceptance
├── scripts/          Deploy, smoke, recovery và stress scripts
├── docker-compose.yml
├── docker-compose.testnet.yml
└── turbo.json
```

## 5. Smart contracts

Các thành phần chính:

- `PumpFactory`: tạo token/pair và quản lý registry.
- `MemeToken`: ERC-20 của từng token.
- `PumpPair`: bonding curve, buy/sell, reserve và graduation.
- `Treasury`: nhận và quản lý phí nền tảng.
- `IDexAdapter`: giao diện chuyển thanh khoản sau graduation.
- `PumpDexAdapter`: adapter dùng cho PumpNow DEX trên testnet.
- `PumpDexFactory` và `PumpDexPool`: pool/swap cho token đã graduation.
- `MockDexAdapter`: chỉ dùng cho local test, không dùng cho beta public.

Events chính phục vụ indexer:

```text
TokenCreated
Buy
Sell
FeeCollected
Graduated
DEX swap events
```

## 6. Database và indexer

Schema bao phủ các domain chính:

- Wallet
- Token
- Trade
- Holder
- LiquidityPool
- Candle 1m/5m/1h
- FeeHistory
- PlatformStats
- IndexerState
- Event ledger chống xử lý trùng

Indexer hỗ trợ:

- Backfill và live polling.
- Checkpoint block cuối.
- Idempotency theo transaction hash/log index.
- Redis worker lock.
- Retry/backoff và RPC failover.
- Reorg/recovery cơ bản.
- Candle aggregation.
- Realtime publication qua Redis.

## 7. API

Các endpoint quan trọng:

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

API có validation, serialization cho BigInt/Decimal, Redis cache, request logging, rate limit, CORS và health checks.

## 8. Frontend hiện tại

Giao diện dùng nhận diện lime-on-black riêng của PumpNow và bố cục launchpad gồm:

- Sidebar/navigation.
- Search toàn cục và wallet control.
- Featured launches carousel.
- Trending carousel.
- Explore coins theo For you, New và Top volume.
- Artwork tự sinh nếu token không có logo.
- Skeleton, loading, error và empty states.
- Responsive desktop/tablet/mobile.

Các luồng wallet/transaction đã có:

- Connect/disconnect ví.
- Nhận diện sai network và switch sang Arc Testnet.
- Launch token.
- Buy/sell bonding curve.
- Approve khi bán.
- Swap token đã graduation.
- Theo dõi transaction receipt và cập nhật lại dữ liệu API.

Các lỗi UX gần nhất đã sửa:

- Loại bỏ các nút Create trùng lặp; chỉ giữ một mục Create trong navigation.
- Swap hiển thị balance, lỗi quote/balance rõ ràng và simulate trước khi gửi.
- Launch không còn loading vô hạn: receipt được poll qua RPC fallback, có timeout và luôn mở khóa UI.

## 9. Trạng thái chạy thực tế

Full Testnet stack đã chạy thành công trong Docker:

- Web: healthy tại `http://localhost:3000`.
- API: PostgreSQL và Redis `up` tại `http://localhost:3001/api/health`.
- Indexer: worker `running` tại `http://localhost:3002/health`.
- Tại lần kiểm tra gần nhất, `latestIndexedBlock` bằng `latestChainBlock` (độ trễ 0 block).
- Home đã hiển thị token và trades thật được index từ Arc Testnet.

Regression npm gần nhất:

- Lint: pass.
- TypeScript: pass.
- API tests: 10/10 pass.
- Indexer tests: 15/15 pass.
- Next.js production build: pass.

Foundry regression vẫn cần được chạy lại trong môi trường có `forge` trước khi đánh dấu beta stable.

## 10. Khởi động Testnet stack

```cmd
docker compose --env-file .env.testnet -f docker-compose.yml -f docker-compose.testnet.yml up --build -d
```

Kiểm tra services:

```cmd
docker compose --env-file .env.testnet -f docker-compose.yml -f docker-compose.testnet.yml ps
curl http://localhost:3001/api/health
curl http://localhost:3002/health
```

Xem logs:

```cmd
docker compose --env-file .env.testnet -f docker-compose.yml -f docker-compose.testnet.yml logs -f api indexer web
```

Chỉ rebuild web sau thay đổi giao diện:

```cmd
docker compose --env-file .env.testnet -f docker-compose.yml -f docker-compose.testnet.yml up --build -d web
```

## 11. Cấu hình quan trọng

`.env.testnet` phải có tối thiểu:

```env
CHAIN_ID=5042002
RPC_URL=https://managed-primary
RPC_URLS=https://managed-primary,https://managed-failover,https://rpc.testnet.arc.network
PUMP_FACTORY_ADDRESS=0x...

NEXT_PUBLIC_CHAIN_ID=5042002
NEXT_PUBLIC_RPC_URL=https://managed-primary
NEXT_PUBLIC_RPC_URLS=https://managed-primary,https://managed-failover,https://rpc.testnet.arc.network
NEXT_PUBLIC_PUMP_FACTORY_ADDRESS=0x...
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_INDEXER_URL=http://localhost:3002
```

Không commit `.env.testnet`, private keys hoặc managed RPC URLs chứa API key.

## 12. Trạng thái Testnet Beta

Trạng thái hiện tại:

> **Code-ready, local Testnet stack hoạt động, public deployment pending — chưa stable.**

Các blocker trước khi Beta Stable:

1. Chạy fresh Foundry format/build/test trên đúng release source.
2. Kiểm thử thủ công bằng ít nhất hai ví Arc Testnet được funded.
3. Xác nhận toàn bộ Launch → Buy → Sell → Graduation → DEX swap theo cả hai hướng.
4. Xác nhận realtime, chart, holders và portfolio khớp transaction receipts.
5. Deploy public web/API/indexer lên hạ tầng beta đã chọn.
6. Cấu hình domain, TLS, external monitoring, alerts và log retention.
7. Kiểm thử backup/restore PostgreSQL.
8. Chạy public beta ít nhất 72 giờ và theo dõi error/indexer lag.
9. Security review độc lập trước khi sử dụng với giá trị tài chính thật.

Arc chưa có mainnet chính thức. Mục tiêu hiện tại là Beta Stable/Production Ready trên testnet, không deploy mainnet.

## 13. Quy tắc phát triển tiếp theo

- Chưa thêm tính năng ngoài MVP.
- Sửa lỗi và hoàn thiện acceptance trước.
- Mỗi thay đổi phải qua lint, typecheck, tests và build.
- Không dùng `any`; ưu tiên types rõ ràng hoặc `unknown`.
- Frontend hiển thị market data từ API/indexer.
- Không commit/push cho đến khi vòng Testnet Beta hiện tại được xác nhận ổn định.

## 14. Tài liệu liên quan

- `docs/testnet-beta.md`: release record và beta exit criteria.
- `docs/testnet-acceptance.md`: bằng chứng acceptance.
- `docs/security-review.md`: rà soát bảo mật.
- `docs/restart-recovery.md`: kiểm thử restart/recovery.
- `docs/stress-test.md`: stress testing.
- `docs/testnet-deployment-manifest.md`: blocker và cấu hình deployment.
- `docs/testnet-vps-runbook.md`: hướng dẫn vận hành VPS beta.

