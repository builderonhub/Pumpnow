$ErrorActionPreference = "Stop"
if (-not (Test-Path ".env.testnet")) { throw "Create .env.testnet from .env.testnet.example first." }
Get-Content ".env.testnet" | ForEach-Object {
  if ($_ -match '^([^#][^=]*)=(.*)$') { [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), "Process") }
}
if (-not (Get-Command forge -ErrorAction SilentlyContinue)) { throw "Foundry is missing. Install forge/cast before deploying." }
Push-Location contracts
try {
  forge fmt --check
  forge test
  forge script script/DeployTestnet.s.sol:DeployTestnet --rpc-url $env:ARC_TESTNET_RPC_URL --broadcast
} finally { Pop-Location }
node scripts/sync-testnet-deployment.mjs
node --env-file=.env.testnet scripts/testnet-preflight.mjs
