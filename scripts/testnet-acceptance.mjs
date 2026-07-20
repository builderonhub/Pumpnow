import { createPublicClient, createWalletClient, decodeEventLog, http, isAddress, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const rpcUrl = process.env.RPC_URL ?? "https://rpc.testnet.arc.network";
const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001").replace(/\/$/, "");
const factory = process.env.PUMP_FACTORY_ADDRESS;
if (!factory || !isAddress(factory)) throw new Error("PUMP_FACTORY_ADDRESS is missing or invalid");
const keys = [process.env.PRIVATE_KEY, ...(process.env.TEST_WALLET_PRIVATE_KEYS ?? "").split(",")].filter(Boolean);
if (keys.length < 3) throw new Error("Acceptance requires PRIVATE_KEY plus at least two TEST_WALLET_PRIVATE_KEYS");
const accounts = keys.slice(0, 3).map((key) => privateKeyToAccount(key.trim()));
const publicClient = createPublicClient({ transport: http(rpcUrl) });
const wallets = accounts.map((account) => createWalletClient({ account, transport: http(rpcUrl) }));
const maxAcceptanceSpend = BigInt(process.env.ACCEPTANCE_MAX_TOTAL_NATIVE_WEI ?? "50000000000000000");
let acceptanceSpend = 0n;

const factoryAbi = [
  { type: "function", name: "createToken", stateMutability: "nonpayable", inputs: [
    { name: "name", type: "string" }, { name: "symbol", type: "string" }, { name: "initialSupply", type: "uint256" },
    { name: "description", type: "string" }, { name: "imageUrl", type: "string" }, { name: "websiteUrl", type: "string" },
    { name: "xUrl", type: "string" }, { name: "telegramUrl", type: "string" }], outputs: [{ name: "tokenAddress", type: "address" }, { name: "pairAddress", type: "address" }] },
  { type: "event", name: "TokenCreated", inputs: [
    { indexed: true, name: "token", type: "address" }, { indexed: true, name: "pair", type: "address" }, { indexed: true, name: "creator", type: "address" },
    { indexed: false, name: "name", type: "string" }, { indexed: false, name: "symbol", type: "string" }, { indexed: false, name: "initialSupply", type: "uint256" },
    { indexed: false, name: "graduationThreshold", type: "uint256" }, { indexed: false, name: "description", type: "string" }, { indexed: false, name: "imageUrl", type: "string" },
    { indexed: false, name: "websiteUrl", type: "string" }, { indexed: false, name: "xUrl", type: "string" }, { indexed: false, name: "telegramUrl", type: "string" }] },
];
const pairAbi = [
  { type: "function", name: "quoteBuy", stateMutability: "view", inputs: [{ name: "tokenAmount", type: "uint256" }], outputs: [{ type: "uint256" }, { type: "uint256" }, { type: "uint256" }] },
  { type: "function", name: "quoteSell", stateMutability: "view", inputs: [{ name: "tokenAmount", type: "uint256" }], outputs: [{ type: "uint256" }, { type: "uint256" }, { type: "uint256" }] },
  { type: "function", name: "buy", stateMutability: "payable", inputs: [{ name: "tokenAmount", type: "uint256" }, { name: "maxNativeInput", type: "uint256" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "sell", stateMutability: "nonpayable", inputs: [{ name: "tokenAmount", type: "uint256" }, { name: "minNativeOutput", type: "uint256" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "status", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
];
const tokenAbi = [{ type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [{ type: "bool" }] }];
const waitApi = async (path, predicate, timeoutMs = 60_000) => {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    try { const response = await fetch(`${apiUrl}${path}`); if (response.ok) { const body = await response.json(); if (predicate(body)) return body; } } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`Timed out waiting for API ${path}`);
};
const send = async (wallet, request) => publicClient.waitForTransactionReceipt({ hash: await wallet.writeContract(request) });

const suffix = Date.now().toString().slice(-6);
const launch = await send(wallets[0], { address: factory, abi: factoryAbi, functionName: "createToken", args: [`Acceptance ${suffix}`, `A${suffix}`, parseUnits("1000000", 18), "Arc acceptance token", "", "", "", ""] });
const createdLog = launch.logs.map((log) => { try { return decodeEventLog({ abi: factoryAbi, ...log }); } catch { return undefined; } }).find((log) => log?.eventName === "TokenCreated");
if (!createdLog) throw new Error("TokenCreated event missing");
const { token, pair } = createdLog.args;
console.log(`Launch OK token=${token} pair=${pair}`);
await waitApi(`/api/tokens/${token}`, (body) => body?.address?.toLowerCase() === token.toLowerCase());

const firstBuy = parseUnits("1000", 18);
const [, , firstCost] = await publicClient.readContract({ address: pair, abi: pairAbi, functionName: "quoteBuy", args: [firstBuy] });
acceptanceSpend += firstCost;
if (acceptanceSpend > maxAcceptanceSpend) throw new Error("Acceptance spend cap exceeded before first buy");
await send(wallets[1], { address: pair, abi: pairAbi, functionName: "buy", args: [firstBuy, firstCost], value: firstCost });
console.log("Buy OK");
const sellAmount = parseUnits("100", 18);
await send(wallets[1], { address: token, abi: tokenAbi, functionName: "approve", args: [pair, sellAmount] });
const [, , minOutput] = await publicClient.readContract({ address: pair, abi: pairAbi, functionName: "quoteSell", args: [sellAmount] });
await send(wallets[1], { address: pair, abi: pairAbi, functionName: "sell", args: [sellAmount, minOutput] });
console.log("Sell OK");

let status = await publicClient.readContract({ address: pair, abi: pairAbi, functionName: "status" });
for (let i = 0; status === 0 && i < 20; i++) {
  const amount = parseUnits("1000", 18);
  const [, , cost] = await publicClient.readContract({ address: pair, abi: pairAbi, functionName: "quoteBuy", args: [amount] });
  acceptanceSpend += cost;
  if (acceptanceSpend > maxAcceptanceSpend) throw new Error(`Acceptance spend cap exceeded (${acceptanceSpend} > ${maxAcceptanceSpend})`);
  await send(wallets[2], { address: pair, abi: pairAbi, functionName: "buy", args: [amount, cost], value: cost });
  status = await publicClient.readContract({ address: pair, abi: pairAbi, functionName: "status" });
}
if (status !== 1) throw new Error("Graduation threshold was not reached within the acceptance budget");
console.log("Graduation OK");

await waitApi(`/api/tokens/${token}`, (body) => body?.status === "GRADUATED");
await waitApi(`/api/tokens/${token}/trades`, (body) => (body?.items?.length ?? body?.data?.length ?? 0) >= 3);
await waitApi(`/api/tokens/${token}/candles?interval=1m`, (body) => Array.isArray(body) && body.length >= 1);
await waitApi(`/api/wallets/${accounts[1].address}/portfolio`, (body) => Boolean(body));
console.log("Indexer/API/Chart/Portfolio OK");
console.log(JSON.stringify({ token, pair, launchTx: launch.transactionHash }, null, 2));
