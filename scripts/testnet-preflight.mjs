import { createPublicClient, http, isAddress } from "viem";

const expectedChainId = Number(process.env.CHAIN_ID ?? 5042002);
const publicArcHost = "rpc.testnet.arc.network";
const rpcUrls = (
  process.env.RPC_URLS ??
  process.env.ARC_TESTNET_RPC_URL ??
  process.env.RPC_URL ??
  ""
)
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const factory = process.env.PUMP_FACTORY_ADDRESS;
const privateKeys = [
  process.env.PRIVATE_KEY,
  ...(process.env.TEST_WALLET_PRIVATE_KEYS ?? "").split(","),
]
  .map((value) => value?.trim())
  .filter(Boolean);

if (rpcUrls.length < 2)
  throw new Error("Configure at least two managed endpoints in RPC_URLS");
if (new Set(rpcUrls).size !== rpcUrls.length)
  throw new Error("RPC_URLS contains duplicate endpoints");
if (rpcUrls.slice(0, 2).some((value) => new URL(value).hostname === publicArcHost))
  throw new Error(
    "RPC_URLS entries 1 and 2 must be independent managed providers; keep the public Arc RPC last",
  );

const clients = rpcUrls.map((rpcUrl) =>
  createPublicClient({ transport: http(rpcUrl, { timeout: 15_000, retryCount: 3 }) }),
);
let referenceBlock;
for (const [index, client] of clients.entries()) {
  const actualChainId = await client.getChainId();
  if (actualChainId !== expectedChainId)
    throw new Error(`RPC ${index + 1} chain ID ${actualChainId}; expected ${expectedChainId}`);
  const block = await client.getBlockNumber();
  referenceBlock ??= block;
  const lag = referenceBlock > block ? referenceBlock - block : block - referenceBlock;
  if (lag > 20n) throw new Error(`RPC ${index + 1} is ${lag} blocks away from the reference head`);
  console.log(`RPC ${index + 1} OK: chain=${actualChainId}, latestBlock=${block}`);
  if (factory) {
    if (!isAddress(factory)) throw new Error("PUMP_FACTORY_ADDRESS is invalid");
    const code = await client.getCode({ address: factory });
    if (!code || code === "0x")
      throw new Error(`RPC ${index + 1}: no contract at PUMP_FACTORY_ADDRESS`);
  }
}
if (factory) console.log("Factory bytecode is visible through every RPC endpoint");
else console.log("Factory not configured yet (deploy is still required).");

if (privateKeys.length === 0) {
  console.log("No test wallet keys configured. Add deployer plus two funded test wallets to .env.testnet.");
} else {
  const { privateKeyToAccount } = await import("viem/accounts");
  if (privateKeys.length !== 3)
    throw new Error("Configure exactly three distinct wallets: deployer, Buyer A, and Buyer B");
  const addresses = new Set();
  for (const [index, key] of privateKeys.entries()) {
    if (!/^0x[0-9a-fA-F]{64}$/.test(key))
      throw new Error(`Test wallet key ${index + 1} has an invalid format`);
    const account = privateKeyToAccount(key);
    const normalized = account.address.toLowerCase();
    if (normalized === "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266")
      throw new Error("The public Anvil default account must never be used on Arc Testnet");
    if (addresses.has(normalized))
      throw new Error(`Test wallet ${index + 1} duplicates another configured wallet`);
    addresses.add(normalized);
    const balance = await clients[0].getBalance({ address: account.address });
    console.log(`Wallet ${index + 1}: ${account.address} balance=${balance} wei`);
    if (balance === 0n)
      throw new Error(`Wallet ${index + 1} is not funded`);
  }
}

console.log("Testnet preflight passed: managed RPC failover and funded wallets are ready.");
