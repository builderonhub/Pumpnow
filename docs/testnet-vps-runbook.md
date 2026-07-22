# PumpNow Arc Testnet Beta — VPS Runbook

Target: one Ubuntu VPS running Docker Compose behind Cloudflare. This is a beta topology, not a mainnet authorization.

## Prerequisites

- DNS records for `WEB_DOMAIN`, `API_DOMAIN` and `INDEXER_DOMAIN` point to the VPS and are proxied by Cloudflare.
- The host firewall exposes SSH and HTTP to the intended sources. PostgreSQL, Redis, web, API and indexer bind to localhost only.
- `.env.testnet` is copied directly to the host from a secret manager and is never committed.
- Two independent managed Arc RPC endpoints are configured before the public Arc endpoint.
- Deployer, Buyer A and Buyer B are distinct test-only wallets with faucet funds.

## Deploy

```text
npm run testnet:preflight
npm run testnet:stack:start
npm run testnet:stack:status
```

Nginx is the only public application entry point. Configure Cloudflare Full (strict) TLS after installing a Cloudflare Origin certificate or another trusted certificate at the origin; do not treat HTTP-only origin traffic as the final stable setup.

## Verify

```text
npm run testnet:acceptance
npm run testnet:release-gate
docker compose --env-file .env.testnet -f docker-compose.yml -f docker-compose.testnet.yml logs --since=10m api indexer monitor nginx
```

The monitor emits structured JSON, checks web/API/indexer, validates indexer lag and optionally sends state changes to `ALERT_WEBHOOK_URL`. Docker logs rotate at 10 MB with five files per service. Use a separate external uptime monitor as the outside-the-host signal.

## Recovery

```text
npm run recovery:test:testnet
npm run stress:audit:testnet
```

Back up PostgreSQL before any destructive migration. Restore verification and the backup owner must be recorded in `docs/testnet-deployment-manifest.md`.

## Stable decision

Fill the deployment manifest with public URLs, deployment transaction/block, wallet addresses, providers, backup owner, log destination and alert owner. Run the release gate, then observe the public deployment for 72 continuous hours. Any critical/high security issue, duplicate trade, checkpoint divergence or sustained indexer lag resets the observation window.
