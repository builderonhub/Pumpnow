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
