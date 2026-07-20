# Deployment

Copy `.env.example` to `.env`, provide the target network values, then load the
variables in your shell. The script reads the signer through Foundry's standard
`--private-key`/keystore flow and never embeds a key or network address.

Local dry run:

```bash
forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL"
```

Broadcast to a configured testnet:

```bash
forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL" --broadcast --private-key "$PRIVATE_KEY"
```

## Local Anvil

Start Anvil in one VSCode WSL terminal:

```bash
anvil
```

In another terminal, export one of the funded development keys printed by
Anvil, then run the helper. The helper never writes the private key to disk; it
only writes public addresses to the gitignored `.env.local-chain` file.

```bash
export ANVIL_PRIVATE_KEY='<anvil-funded-development-key>'
bash scripts/deploy-anvil.sh
```

Copy the public values from `.env.local-chain` into the root `.env` before
starting the API, indexer, and web app. Local indexer confirmations should be
`0`; production deployments must use an appropriate confirmation depth.
