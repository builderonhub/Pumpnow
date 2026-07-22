# PumpNow Arc Testnet Deployment Manifest

Complete every value before starting the beta clock. Do not commit secrets or provider API keys.

## Release identity

- Source commit: `PENDING`
- Contract build / Foundry version: `PENDING`
- Deployment operator: `PENDING`
- Deployment time (UTC): `PENDING`

## Public services

- Web URL: `PENDING`
- API URL: `PENDING`
- API health URL: `PENDING/api/health`
- Indexer URL: `PENDING`
- Indexer health URL: `PENDING/health`
- Feedback URL: `PENDING`

## Arc deployment

- Chain ID: `5042002`
- Factory address: `PENDING`
- Pump DEX factory address: `PENDING`
- Deployment block: `PENDING`
- Explorer transaction: `PENDING`
- Deployer wallet: `PENDING`
- Buyer A wallet: `PENDING`
- Buyer B wallet: `PENDING`

## Managed infrastructure

- Primary RPC provider: `PENDING`
- Failover RPC provider: `PENDING`
- Database host / backup policy: `PENDING`
- Redis host: `PENDING`
- Container or application host: `PENDING`
- Log destination: `PENDING`
- Uptime monitor and alert owner: `PENDING`

## Required verification

```text
npm run testnet:preflight
npm run db:migrate:deploy
npm run testnet:stack:start
npm run testnet:stack:status
npm run testnet:acceptance
npm run testnet:release-gate
```

The VPS procedure is documented in `docs/testnet-vps-runbook.md`.

Record transaction hashes for Launch, Buy, Sell, Graduation, DEX swap in both directions, and the final portfolio reconciliation in `docs/testnet-beta.md`.

The deployment is not stable until both health endpoints remain healthy and external monitoring observes the public services for 72 continuous hours.
