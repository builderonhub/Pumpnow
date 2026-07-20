# Indexer ABI exports

Generate deterministic ABI files after a successful build:

```bash
forge inspect core/PumpFactory.sol:PumpFactory abi --json > abi/PumpFactory.json
forge inspect core/PumpPair.sol:PumpPair abi --json > abi/PumpPair.json
forge inspect core/Treasury.sol:Treasury abi --json > abi/Treasury.json
```

Indexer event ownership:

- `PumpFactory`: `TokenCreated`
- `PumpPair`: `Buy`, `Sell`, `Graduated`
- `Treasury`: `FeeCollected`

The indexer should discover pair and token addresses from `TokenCreated`, then
subscribe to pair events and the factory treasury address.
