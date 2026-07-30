import { createPublicClient, createWalletClient, decodeEventLog, fallback, http, isAddress, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const rpcUrls = (process.env.RPC_URLS ?? process.env.RPC_URL ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
if (rpcUrls.length < 2) throw new Error("Acceptance requires managed primary and failover endpoints in RPC_URLS");
const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001").replace(/\/$/, "");
const indexerUrl = (process.env.INDEXER_URL ?? process.env.NEXT_PUBLIC_INDEXER_URL ?? "http://localhost:3002").replace(/\/$/, "");
const factory = process.env.PUMP_FACTORY_ADDRESS;
if (!factory || !isAddress(factory)) throw new Error("PUMP_FACTORY_ADDRESS is missing or invalid");
const keys = [process.env.PRIVATE_KEY, ...(process.env.TEST_WALLET_PRIVATE_KEYS ?? "").split(",")].filter(Boolean);
if (keys.length < 3) throw new Error("Acceptance requires PRIVATE_KEY plus at least two TEST_WALLET_PRIVATE_KEYS");
const accounts = keys.slice(0, 3).map((key) => privateKeyToAccount(key.trim()));
const rpcTransport = () =>
  fallback(
    rpcUrls.map((url) => http(url, { retryCount: 4, retryDelay: 1_000, timeout: 15_000 })),
    { rank: true },
  );
const publicClient = createPublicClient({ transport: rpcTransport() });
const wallets = accounts.map((account) => createWalletClient({ account, transport: rpcTransport() }));
const maxAcceptanceSpend = BigInt(process.env.ACCEPTANCE_MAX_TOTAL_NATIVE_WEI ?? "2000000000000000000");
let acceptanceSpend = 0n;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const isRateLimit = (error) => {
  let current = error;
  for (let depth = 0; current && depth < 8; depth += 1) {
    if (current?.code === -32011) return true;
    const text = `${current?.details ?? ""} ${current?.message ?? ""}`.toLowerCase();
    if (text.includes("request limit reached") || text.includes("rate limit")) return true;
    current = current?.cause;
  }
  return false;
};
const withRpcRetry = async (label, operation) => {
  let lastError;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isRateLimit(error) || attempt === 19) throw error;
      const delay = Math.min(60_000, 5_000 * (attempt + 1));
      console.warn(`${label}: Arc RPC limited request; retrying in ${delay / 1000}s (${attempt + 1}/20)`);
      await sleep(delay);
    }
  }
  throw lastError;
};
const readContract = (request) => withRpcRetry(`eth_call ${request.functionName}`, () => publicClient.readContract(request));

const factoryAbi = [
  { type: "function", name: "pairFor", stateMutability: "view", inputs: [{ name: "token", type: "address" }], outputs: [{ type: "address" }] },
  { type: "function", name: "createToken", stateMutability: "nonpayable", inputs: [
    { name: "name", type: "string" }, { name: "symbol", type: "string" }, { name: "initialSupply", type: "uint256" },
    { name: "description", type: "string" }, { name: "imageUrl", type: "string" }, { name: "websiteUrl", type: "string" },
    { name: "xUrl", type: "string" }, { name: "telegramUrl", type: "string" }], outputs: [{ name: "tokenAddress", type: "address" }, { name: "pairAddress", type: "address" }] },
  { type: "event", name: "TokenCreated", inputs: [
    { indexed: true, name: "token", type: "address" }, { indexed: true, name: "pair", type: "address" }, { indexed: true, name: "creator", type: "address" },
    { indexed: false, name: "name", type: "string" }, { indexed: false, name: "symbol", type: "string" }, { indexed: false, name: "initialSupply", type: "uint256" },
    { indexed: false, name: "graduationTokenAmount", type: "uint256" }, { indexed: false, name: "description", type: "string" }, { indexed: false, name: "imageUrl", type: "string" },
    { indexed: false, name: "websiteUrl", type: "string" }, { indexed: false, name: "xUrl", type: "string" }, { indexed: false, name: "telegramUrl", type: "string" }] },
];
const pairAbi = [
  { type: "function", name: "quoteBuy", stateMutability: "view", inputs: [{ name: "tokenAmount", type: "uint256" }], outputs: [{ type: "uint256" }, { type: "uint256" }, { type: "uint256" }] },
  { type: "function", name: "quoteSell", stateMutability: "view", inputs: [{ name: "tokenAmount", type: "uint256" }], outputs: [{ type: "uint256" }, { type: "uint256" }, { type: "uint256" }] },
  { type: "function", name: "buy", stateMutability: "payable", inputs: [{ name: "tokenAmount", type: "uint256" }, { name: "maxNativeInput", type: "uint256" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "sell", stateMutability: "nonpayable", inputs: [{ name: "tokenAmount", type: "uint256" }, { name: "minNativeOutput", type: "uint256" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "status", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "dexPositionId", stateMutability: "view", inputs: [], outputs: [{ type: "bytes32" }] },
];
const tokenAbi = [{ type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [{ type: "bool" }] }];
const dexPoolAbi = [
  { type: "function", name: "tokenReserve", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "nativeReserve", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "liquidityOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "quoteNativeForToken", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "quoteTokenForNative", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "swapNativeForToken", stateMutability: "payable", inputs: [{ type: "uint256" }, { type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "swapTokenForNative", stateMutability: "nonpayable", inputs: [{ type: "uint256" }, { type: "uint256" }, { type: "address" }], outputs: [{ type: "uint256" }] },
];
const liquidityLock = "0x000000000000000000000000000000000000dEaD";
const waitApi = async (path, predicate, timeoutMs = 600_000) => {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    try { const response = await fetch(`${apiUrl}${path}`); if (response.ok) { const body = await response.json(); if (predicate(body)) return body; } } catch {}
    await sleep(1_000);
  }
  throw new Error(`Timed out waiting for API ${path}`);
};
const waitForIndexer = async (timeoutMs = 900_000) => {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    try {
      const response = await fetch(`${indexerUrl}/health`);
      if (response.ok) {
        const body = await response.json();
        const indexed = BigInt(body?.checks?.latestIndexedBlock ?? "0");
        const chain = BigInt(body?.checks?.latestChainBlock ?? "0");
        const lag = chain > indexed ? chain - indexed : 0n;
        console.log(`Indexer lag: ${lag} blocks`);
        if (body?.checks?.worker === "running" && lag <= 20n) {
          console.log("Indexer caught up");
          return;
        }
      }
    } catch {}
    await sleep(5_000);
  }
  throw new Error("Timed out waiting for indexer to catch up");
};
const send = async (wallet, request) => {
  const hash = await withRpcRetry(`send ${request.functionName}`, () => wallet.writeContract(request));
  console.log(`Submitted ${hash}`);
  const receipt = await withRpcRetry(`receipt ${hash}`, () =>
    publicClient.waitForTransactionReceipt({ hash, pollingInterval: 10_000, retryCount: 12 }),
  );
  await sleep(3_000);
  return receipt;
};

await waitForIndexer();
const tokenArgumentIndex = process.argv.indexOf("--token");
const resumeToken = tokenArgumentIndex >= 0 ? process.argv[tokenArgumentIndex + 1] : undefined;
let token;
let pair;
let launch;
if (resumeToken) {
  if (!isAddress(resumeToken)) throw new Error("--token must be a valid address");
  token = resumeToken;
  pair = await readContract({ address: factory, abi: factoryAbi, functionName: "pairFor", args: [token] });
  if (!isAddress(pair) || /^0x0{40}$/i.test(pair)) throw new Error("Resume token is not registered by this factory");
  console.log(`Resume token=${token} pair=${pair}`);
} else {
  const suffix = Date.now().toString().slice(-6);
  launch = await send(wallets[0], { address: factory, abi: factoryAbi, functionName: "createToken", args: [`Acceptance ${suffix}`, `A${suffix}`, parseUnits("1000000", 18), "Arc acceptance token", "", "", "", ""] });
  const createdLog = launch.logs.map((log) => { try { return decodeEventLog({ abi: factoryAbi, ...log }); } catch { return undefined; } }).find((log) => log?.eventName === "TokenCreated");
  if (!createdLog) throw new Error("TokenCreated event missing");
  ({ token, pair } = createdLog.args);
  console.log(`Launch OK token=${token} pair=${pair}`);
}
await waitApi(`/api/tokens/${token}`, (body) => body?.address?.toLowerCase() === token.toLowerCase());

let status = await readContract({ address: pair, abi: pairAbi, functionName: "status" });
if (status === 0) {
  const firstBuy = parseUnits("10", 18);
  const [, , firstCost] = await readContract({ address: pair, abi: pairAbi, functionName: "quoteBuy", args: [firstBuy] });
  acceptanceSpend += firstCost;
  if (acceptanceSpend > maxAcceptanceSpend) throw new Error("Acceptance spend cap exceeded before first buy");
  await send(wallets[1], { address: pair, abi: pairAbi, functionName: "buy", args: [firstBuy, firstCost], value: firstCost });
  console.log("Buy OK");
  const sellAmount = parseUnits("1", 18);
  await send(wallets[1], { address: token, abi: tokenAbi, functionName: "approve", args: [pair, sellAmount] });
  const [, , minOutput] = await readContract({ address: pair, abi: pairAbi, functionName: "quoteSell", args: [sellAmount] });
  await send(wallets[1], { address: pair, abi: pairAbi, functionName: "sell", args: [sellAmount, minOutput] });
  console.log("Sell OK");

  for (let i = 0; status === 0 && i < 20; i++) {
    const amount = parseUnits("1000", 18);
    const [, , cost] = await readContract({ address: pair, abi: pairAbi, functionName: "quoteBuy", args: [amount] });
    acceptanceSpend += cost;
    if (acceptanceSpend > maxAcceptanceSpend) throw new Error(`Acceptance spend cap exceeded (${acceptanceSpend} > ${maxAcceptanceSpend})`);
    await send(wallets[2], { address: pair, abi: pairAbi, functionName: "buy", args: [amount, cost], value: cost });
    status = await readContract({ address: pair, abi: pairAbi, functionName: "status" });
  }
} else {
  console.log("Bonding pair already graduated; continuing with DEX acceptance");
}
if (status !== 1) throw new Error("Graduation threshold was not reached within the acceptance budget");
console.log("Graduation OK");

await waitApi(`/api/tokens/${token}`, (body) => body?.status === "GRADUATED");
const tradesBefore = await waitApi(`/api/tokens/${token}/trades`, (body) => Array.isArray(body?.items) || Array.isArray(body?.data));
const tradeCountBefore = tradesBefore?.items?.length ?? tradesBefore?.data?.length ?? 0;
const positionId = await readContract({ address: pair, abi: pairAbi, functionName: "dexPositionId" });
const dexPool = `0x${positionId.slice(-40)}`;
const poolCode = await withRpcRetry("get DEX pool bytecode", () => publicClient.getCode({ address: dexPool }));
if (!poolCode || poolCode === "0x") throw new Error(`DEX pool has no bytecode: ${dexPool}`);
const [tokenReserve, nativeReserve, lockedLiquidity] = await Promise.all([
  readContract({ address: dexPool, abi: dexPoolAbi, functionName: "tokenReserve" }),
  readContract({ address: dexPool, abi: dexPoolAbi, functionName: "nativeReserve" }),
  readContract({ address: dexPool, abi: dexPoolAbi, functionName: "liquidityOf", args: [liquidityLock] }),
]);
if (tokenReserve === 0n || nativeReserve === 0n || lockedLiquidity === 0n) throw new Error("DEX reserves or locked liquidity are zero");
console.log(`DEX pool=${dexPool} reserves OK; LP locked=${lockedLiquidity}`);

const dexNativeInput = parseUnits("0.01", 18);
acceptanceSpend += dexNativeInput;
if (acceptanceSpend > maxAcceptanceSpend) throw new Error("Acceptance spend cap exceeded before DEX swap");
const tokenOutput = await readContract({ address: dexPool, abi: dexPoolAbi, functionName: "quoteNativeForToken", args: [dexNativeInput] });
await send(wallets[1], { address: dexPool, abi: dexPoolAbi, functionName: "swapNativeForToken", args: [tokenOutput, accounts[1].address], value: dexNativeInput });
console.log("DEX native-to-token swap OK");
await send(wallets[1], { address: token, abi: tokenAbi, functionName: "approve", args: [dexPool, tokenOutput] });
const nativeOutput = await readContract({ address: dexPool, abi: dexPoolAbi, functionName: "quoteTokenForNative", args: [tokenOutput] });
await send(wallets[1], { address: dexPool, abi: dexPoolAbi, functionName: "swapTokenForNative", args: [tokenOutput, nativeOutput, accounts[1].address] });
console.log("DEX token-to-native swap OK");

await waitApi(`/api/tokens/${token}/trades`, (body) => (body?.items?.length ?? body?.data?.length ?? 0) >= tradeCountBefore + 2);
await waitApi(`/api/tokens/${token}/candles?interval=1m`, (body) => Array.isArray(body) && body.length >= 1);
await waitApi(`/api/wallets/${accounts[1].address}/portfolio`, (body) => Boolean(body));
console.log("Indexer/API/Chart/Portfolio OK");
console.log(JSON.stringify({ token, pair, dexPool, launchTx: launch?.transactionHash ?? null }, null, 2));
