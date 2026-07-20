import { createPublicClient, http, isAddress } from "viem";

const expectedChainId = Number(process.env.CHAIN_ID ?? 5042002);
const rpcUrl = process.env.ARC_TESTNET_RPC_URL ?? process.env.RPC_URL ?? "https://rpc.testnet.arc.network";
const factory = process.env.PUMP_FACTORY_ADDRESS;
const privateKeys = [process.env.PRIVATE_KEY, ...(process.env.TEST_WALLET_PRIVATE_KEYS ?? "").split(",")]
  .map((value) => value?.trim())
  .filter(Boolean);
const client = createPublicClient({ transport: http(rpcUrl, { timeout: 15_000 }) });

const actualChainId = await client.getChainId();
if (actualChainId !== expectedChainId) throw new Error(`RPC chain ID ${actualChainId}; expected ${expectedChainId}`);
const block = await client.getBlockNumber();
console.log(`Arc RPC OK: chain=${actualChainId}, latestBlock=${block}`);

if (factory) {
  if (!isAddress(factory)) throw new Error("PUMP_FACTORY_ADDRESS is invalid");
  const code = await client.getCode({ address: factory });
  if (!code || code === "0x") throw new Error(`No contract at PUMP_FACTORY_ADDRESS ${factory}`);
  console.log(`Factory bytecode OK: ${factory}`);
} else {
  console.log("Factory not configured yet (deploy is still required).");
}

if (privateKeys.length === 0) {
  console.log("No test wallet keys configured. Add PRIVATE_KEY and TEST_WALLET_PRIVATE_KEYS to .env.testnet.");
} else {
  const { privateKeyToAccount } = await import("viem/accounts");
  for (const [index, key] of privateKeys.entries()) {
    if (!/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error(`Test wallet key ${index + 1} has an invalid format`);
    const account = privateKeyToAccount(key);
    const balance = await client.getBalance({ address: account.address });
    console.log(`Wallet ${index + 1}: ${account.address} balance=${balance} wei`);
    if (balance === 0n) console.warn(`Wallet ${index + 1} needs Arc Testnet USDC from https://faucet.circle.com`);
  }
}
