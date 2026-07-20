#!/usr/bin/env bash
set -euo pipefail

mkdir -p abi
forge inspect core/PumpFactory.sol:PumpFactory abi --json > abi/PumpFactory.json
forge inspect core/PumpPair.sol:PumpPair abi --json > abi/PumpPair.json
forge inspect core/Treasury.sol:Treasury abi --json > abi/Treasury.json
