#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env.testnet"
if [[ ! -f "$ENV_FILE" ]]; then
  printf 'Create .env.testnet from .env.testnet.example first.\n' >&2
  exit 1
fi

while IFS='=' read -r key value; do
  key="${key%$'\r'}"
  value="${value%$'\r'}"
  [[ -z "$key" || "$key" == \#* ]] && continue
  export "$key=$value"
done < "$ENV_FILE"

command -v forge >/dev/null || {
  printf 'Foundry is missing in this WSL terminal.\n' >&2
  exit 1
}

cd "$ROOT_DIR/contracts"
forge fmt --check
forge test
forge script script/DeployTestnet.s.sol:DeployTestnet \
  --rpc-url "$ARC_TESTNET_RPC_URL" \
  --broadcast

cd "$ROOT_DIR"
node scripts/sync-testnet-deployment.mjs
node --env-file=.env.testnet scripts/testnet-preflight.mjs
