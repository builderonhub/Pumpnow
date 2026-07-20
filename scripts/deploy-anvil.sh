#!/usr/bin/env bash
set -euo pipefail
: "${ANVIL_PRIVATE_KEY:?Set ANVIL_PRIVATE_KEY to an Anvil-funded development key}"
ANVIL_RPC_URL="${ANVIL_RPC_URL:-http://127.0.0.1:8545}"
DOCKER_RPC_URL="${DOCKER_RPC_URL:-http://anvil:8545}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR/contracts"
forge script script/DeployLocal.s.sol:DeployLocal --rpc-url "$ANVIL_RPC_URL" --broadcast
RUN_FILE="$(find broadcast/DeployLocal.s.sol/31337 -name run-latest.json -print -quit)"
FACTORY="$(python3 -c 'import json, sys; data=json.load(open(sys.argv[1])); print(next(tx["contractAddress"] for tx in data["transactions"] if tx.get("contractName") == "PumpFactory"))' "$RUN_FILE")"
ADAPTER="$(python3 -c 'import json, sys; data=json.load(open(sys.argv[1])); print(next(tx["contractAddress"] for tx in data["transactions"] if tx.get("contractName") == "MockDexAdapter"))' "$RUN_FILE")"
test -n "$FACTORY" && test "$FACTORY" != "null"
OUTPUT="$ROOT_DIR/.env.local-chain"
umask 077
{
  printf 'RPC_URL=%s\nCHAIN_ID=31337\nPUMP_FACTORY_ADDRESS=%s\nINDEXER_START_BLOCK=0\n' "$DOCKER_RPC_URL" "$FACTORY"
  printf 'NEXT_PUBLIC_API_URL=http://localhost:3001\nNEXT_PUBLIC_CHAIN_ID=31337\nNEXT_PUBLIC_CHAIN_NAME=Anvil Local\n'
  printf 'NEXT_PUBLIC_NATIVE_SYMBOL=ETH\nNEXT_PUBLIC_RPC_URL=%s\nNEXT_PUBLIC_BLOCK_EXPLORER_URL=\n' "$ANVIL_RPC_URL"
  printf 'NEXT_PUBLIC_PUMP_FACTORY_ADDRESS=%s\n' "$FACTORY"
  printf 'DEX_ADAPTER_ADDRESS=%s\n' "$ADAPTER"
} > "$OUTPUT"
printf 'Local addresses written to %s (no private key stored).\n' "$OUTPUT"
