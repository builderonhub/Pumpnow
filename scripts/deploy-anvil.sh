#!/usr/bin/env bash
set -euo pipefail
: "${ANVIL_PRIVATE_KEY:?Set ANVIL_PRIVATE_KEY to an Anvil-funded development key}"
RPC_URL="${RPC_URL:-http://127.0.0.1:8545}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR/contracts"
forge script script/DeployLocal.s.sol:DeployLocal --rpc-url "$RPC_URL" --broadcast
RUN_FILE="$(find broadcast/DeployLocal.s.sol/31337 -name run-latest.json -print -quit)"
FACTORY="$(jq -r '.transactions[] | select(.contractName == "PumpFactory") | .contractAddress' "$RUN_FILE")"
ADAPTER="$(jq -r '.transactions[] | select(.contractName == "MockDexAdapter") | .contractAddress' "$RUN_FILE")"
test -n "$FACTORY" && test "$FACTORY" != "null"
OUTPUT="$ROOT_DIR/.env.local-chain"
umask 077
{
  printf 'CHAIN_ID=31337\nRPC_URL=%s\nPUMP_FACTORY_ADDRESS=%s\n' "$RPC_URL" "$FACTORY"
  printf 'NEXT_PUBLIC_CHAIN_ID=31337\nNEXT_PUBLIC_RPC_URL=%s\nNEXT_PUBLIC_PUMP_FACTORY_ADDRESS=%s\n' "$RPC_URL" "$FACTORY"
  printf 'DEX_ADAPTER_ADDRESS=%s\n' "$ADAPTER"
} > "$OUTPUT"
printf 'Local addresses written to %s (no private key stored).\n' "$OUTPUT"
