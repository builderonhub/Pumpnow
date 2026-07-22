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
forge script script/DeployPumpDexTestnet.s.sol:DeployPumpDexTestnet \
  --rpc-url "$ARC_TESTNET_RPC_URL" \
  --broadcast

cd "$ROOT_DIR"
if command -v node >/dev/null; then
  NODE_BIN=node
elif command -v node.exe >/dev/null; then
  NODE_BIN=node.exe
else
  printf 'Deployment succeeded, but Node.js is unavailable in WSL. Run the sync and preflight scripts from Windows.\n' >&2
  exit 2
fi
"$NODE_BIN" scripts/sync-testnet-deployment.mjs
"$NODE_BIN" --env-file=.env.testnet scripts/testnet-preflight.mjs
