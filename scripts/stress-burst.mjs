import { execFileSync } from "node:child_process";
import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  http,
  isAddress,
  parseUnits,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const rpcUrl = process.env.RPC_URL ?? "https://rpc.testnet.arc.network";
const factory = process.env.PUMP_FACTORY_ADDRESS;
if (!factory || !isAddress(factory))
  throw new Error("PUMP_FACTORY_ADDRESS is missing or invalid");
const stressKeys = process.env.STRESS_WALLET_PRIVATE_KEYS?.trim();
const configuredKeys = stressKeys
  ? stressKeys
  : [process.env.PRIVATE_KEY, process.env.TEST_WALLET_PRIVATE_KEYS]
      .filter(Boolean)
      .join(",");
const keys = [...new Set(configuredKeys
  .split(",")
  .map((key) => key.trim())
  .filter(Boolean))];
const requestedConcurrency = process.env.STRESS_CONCURRENCY
  ? Number(process.env.STRESS_CONCURRENCY)
  : undefined;
const concurrency = requestedConcurrency ?? Math.min(5, keys.length);
if (!Number.isInteger(concurrency) || concurrency < 1)
  throw new Error("STRESS_CONCURRENCY must be a positive integer");
if (keys.length < concurrency)
  throw new Error(
    `Need ${concurrency} unique wallets but only ${keys.length} are configured. ` +
      "Add STRESS_WALLET_PRIVATE_KEYS or lower STRESS_CONCURRENCY.",
  );
if (keys.length === 0)
  throw new Error(
    "Configure STRESS_WALLET_PRIVATE_KEYS, or PRIVATE_KEY plus TEST_WALLET_PRIVATE_KEYS",
  );

const rpcRetryCount = Number(process.env.STRESS_RPC_RETRY_COUNT ?? "12");
const rpcRetryDelayMs = Number(process.env.STRESS_RPC_RETRY_DELAY_MS ?? "4000");
const receiptPollingMs = Number(
  process.env.STRESS_RECEIPT_POLL_INTERVAL_MS ?? "10000",
);
const workerStaggerMs = Number(process.env.STRESS_WORKER_STAGGER_MS ?? "5000");
const transport = () =>
  http(rpcUrl, {
    retryCount: rpcRetryCount,
    retryDelay: rpcRetryDelayMs,
    timeout: 30_000,
  });
const publicClient = createPublicClient({
  pollingInterval: receiptPollingMs,
  transport: transport(),
});
const accounts = keys
  .slice(0, concurrency)
  .map((key) => privateKeyToAccount(key));
const wallets = accounts.map((account) =>
  createWalletClient({ account, transport: transport() }),
);
const buyAmount = parseUnits(process.env.STRESS_BUY_TOKEN_AMOUNT ?? "2", 18);
const sellAmount = parseUnits(process.env.STRESS_SELL_TOKEN_AMOUNT ?? "1", 18);
const supply = parseUnits(process.env.STRESS_TOKEN_SUPPLY ?? "1000000", 18);
const totalSpendCap = BigInt(
  process.env.STRESS_MAX_TOTAL_NATIVE_WEI ?? "2000000000000000000",
);
let reservedSpend = 0n;

const factoryAbi = [
  { type: "function", name: "createToken", stateMutability: "nonpayable", inputs: [
    { name: "name", type: "string" }, { name: "symbol", type: "string" }, { name: "initialSupply", type: "uint256" },
    { name: "description", type: "string" }, { name: "imageUrl", type: "string" }, { name: "websiteUrl", type: "string" },
    { name: "xUrl", type: "string" }, { name: "telegramUrl", type: "string" }], outputs: [{ type: "address" }, { type: "address" }] },
  { type: "event", name: "TokenCreated", inputs: [
    { indexed: true, name: "token", type: "address" }, { indexed: true, name: "pair", type: "address" }, { indexed: true, name: "creator", type: "address" },
    { indexed: false, name: "name", type: "string" }, { indexed: false, name: "symbol", type: "string" }, { indexed: false, name: "initialSupply", type: "uint256" },
    { indexed: false, name: "graduationTokenAmount", type: "uint256" }, { indexed: false, name: "description", type: "string" }, { indexed: false, name: "imageUrl", type: "string" },
    { indexed: false, name: "websiteUrl", type: "string" }, { indexed: false, name: "xUrl", type: "string" }, { indexed: false, name: "telegramUrl", type: "string" }] },
];
const pairAbi = [
  { type: "function", name: "quoteBuy", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "uint256" }, { type: "uint256" }, { type: "uint256" }] },
  { type: "function", name: "quoteSell", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "uint256" }, { type: "uint256" }, { type: "uint256" }] },
  { type: "function", name: "buy", stateMutability: "payable", inputs: [{ type: "uint256" }, { type: "uint256" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "sell", stateMutability: "nonpayable", inputs: [{ type: "uint256" }, { type: "uint256" }], outputs: [{ type: "uint256" }] },
];
const tokenAbi = [{ type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [{ type: "bool" }] }];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const send = async (wallet, request, label) => {
  const hash = await wallet.writeContract(request);
  console.log(`${label} submitted: ${hash}`);
  return publicClient.waitForTransactionReceipt({
    hash,
    pollingInterval: receiptPollingMs,
    retryCount: rpcRetryCount,
    retryDelay: ({ count }) =>
      Math.min(30_000, rpcRetryDelayMs * 2 ** Math.min(count, 3)),
  });
};

const suffix = Date.now().toString(36).slice(-5).toUpperCase();
const results = await Promise.all(
  wallets.map(async (wallet, index) => {
    // Arc's shared public RPC has a strict request budget. Stagger only the
    // submission edge; transactions still overlap on-chain and in the indexer.
    await sleep(index * workerStaggerMs);
    const symbol = `S${suffix}${index}`.slice(0, 20);
    const launch = await send(wallet, {
      address: factory,
      abi: factoryAbi,
      functionName: "createToken",
      args: [`Stress ${suffix} ${index}`, symbol, supply, "Concurrent recovery stress token", "", "", "", ""],
    }, `worker ${index} launch`);
    const created = launch.logs
      .map((log) => {
        try { return decodeEventLog({ abi: factoryAbi, ...log }); } catch { return undefined; }
      })
      .find((log) => log?.eventName === "TokenCreated");
    if (!created) throw new Error(`TokenCreated missing for worker ${index}`);
    const { token, pair } = created.args;
    const [, , cost] = await publicClient.readContract({ address: pair, abi: pairAbi, functionName: "quoteBuy", args: [buyAmount] });
    reservedSpend += cost;
    if (reservedSpend > totalSpendCap) throw new Error("STRESS_MAX_TOTAL_NATIVE_WEI exceeded");
    const buy = await send(wallet, { address: pair, abi: pairAbi, functionName: "buy", args: [buyAmount, cost], value: cost }, `worker ${index} buy`);
    await send(wallet, { address: token, abi: tokenAbi, functionName: "approve", args: [pair, sellAmount] }, `worker ${index} approve`);
    const [, , output] = await publicClient.readContract({ address: pair, abi: pairAbi, functionName: "quoteSell", args: [sellAmount] });
    const sell = await send(wallet, { address: pair, abi: pairAbi, functionName: "sell", args: [sellAmount, output] }, `worker ${index} sell`);
    return { token, pair, launch: launch.transactionHash, buy: buy.transactionHash, sell: sell.transactionHash };
  }),
);

console.log(JSON.stringify({ status: "TRAFFIC_SENT", concurrency, reservedSpend: reservedSpend.toString(), results }, null, 2));
const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001").replace(/\/$/, "");
const deadline = Date.now() + Number(process.env.STRESS_INDEX_TIMEOUT_MS ?? "120000");
for (const result of results) {
  let indexed = false;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${apiUrl}/api/tokens/${result.token}/trades?page=1&limit=10`);
      if (response.ok) {
        const body = await response.json();
        if ((body.items?.length ?? body.data?.length ?? 0) >= 2) {
          indexed = true;
          break;
        }
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  if (!indexed) throw new Error(`Indexer did not expose both trades for ${result.token}`);
}
execFileSync(
  process.execPath,
  ["--env-file-if-exists=.env.testnet", "scripts/stress-audit.mjs"],
  { stdio: "inherit" },
);
