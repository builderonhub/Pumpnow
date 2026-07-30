import { defineChain, isAddress, type Address } from "viem";

const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID);
const rpcUrls = (process.env.NEXT_PUBLIC_RPC_URLS ?? process.env.NEXT_PUBLIC_RPC_URL ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const factoryAddressValue = process.env.NEXT_PUBLIC_PUMP_FACTORY_ADDRESS;
export const blockExplorerUrl = process.env.NEXT_PUBLIC_BLOCK_EXPLORER_URL?.replace(/\/$/, "");

export const chainConfigError =
  !Number.isSafeInteger(chainId) || chainId <= 0
    ? "NEXT_PUBLIC_CHAIN_ID must be a positive integer"
    : rpcUrls.length === 0
      ? "NEXT_PUBLIC_RPC_URLS or NEXT_PUBLIC_RPC_URL is missing"
      : !factoryAddressValue || !isAddress(factoryAddressValue)
        ? "NEXT_PUBLIC_PUMP_FACTORY_ADDRESS is invalid"
        : null;

export const pumpFactoryAddress =
  factoryAddressValue && isAddress(factoryAddressValue)
    ? (factoryAddressValue as Address)
    : undefined;

export const pumpNowChain = defineChain({
  id: Number.isSafeInteger(chainId) && chainId > 0 ? chainId : 31337,
  name: process.env.NEXT_PUBLIC_CHAIN_NAME ?? "PumpNow Local",
  nativeCurrency: { name: "Native", symbol: process.env.NEXT_PUBLIC_NATIVE_SYMBOL ?? "ETH", decimals: 18 },
  rpcUrls: { default: { http: rpcUrls.length > 0 ? rpcUrls : ["http://127.0.0.1:8545"] } },
  blockExplorers: process.env.NEXT_PUBLIC_BLOCK_EXPLORER_URL
    ? { default: { name: "Arcscan", url: process.env.NEXT_PUBLIC_BLOCK_EXPLORER_URL } }
    : undefined,
});

export const pumpFactoryAbi = [
  { type: "function", name: "createToken", stateMutability: "nonpayable", inputs: [{ name: "name", type: "string" }, { name: "symbol", type: "string" }, { name: "initialSupply", type: "uint256" }, { name: "description", type: "string" }, { name: "imageUrl", type: "string" }, { name: "websiteUrl", type: "string" }, { name: "xUrl", type: "string" }, { name: "telegramUrl", type: "string" }], outputs: [{ name: "tokenAddress", type: "address" }, { name: "pairAddress", type: "address" }] },
] as const;

export const pumpPairAbi = [
  { type: "function", name: "basePrice", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "slope", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "tokensSold", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "graduationTokenAmount", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "feeBps", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint16" }] },
  { type: "function", name: "quoteBuy", stateMutability: "view", inputs: [{ name: "tokenAmount", type: "uint256" }], outputs: [{ name: "curveCost", type: "uint256" }, { name: "fee", type: "uint256" }, { name: "totalCost", type: "uint256" }] },
  { type: "function", name: "quoteSell", stateMutability: "view", inputs: [{ name: "tokenAmount", type: "uint256" }], outputs: [{ name: "grossOutput", type: "uint256" }, { name: "fee", type: "uint256" }, { name: "netOutput", type: "uint256" }] },
  { type: "function", name: "buy", stateMutability: "payable", inputs: [{ name: "tokenAmount", type: "uint256" }, { name: "maxNativeInput", type: "uint256" }], outputs: [{ name: "totalCost", type: "uint256" }] },
  { type: "function", name: "sell", stateMutability: "nonpayable", inputs: [{ name: "tokenAmount", type: "uint256" }, { name: "minNativeOutput", type: "uint256" }], outputs: [{ name: "netOutput", type: "uint256" }] },
] as const;

export const erc20Abi = [
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "owner", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
] as const;

export const pumpDexPoolAbi = [
  { type: "function", name: "quoteNativeForToken", stateMutability: "view", inputs: [{ name: "nativeInput", type: "uint256" }], outputs: [{ name: "tokenOutput", type: "uint256" }] },
  { type: "function", name: "quoteTokenForNative", stateMutability: "view", inputs: [{ name: "tokenInput", type: "uint256" }], outputs: [{ name: "nativeOutput", type: "uint256" }] },
  { type: "function", name: "swapNativeForToken", stateMutability: "payable", inputs: [{ name: "minTokenOutput", type: "uint256" }, { name: "recipient", type: "address" }], outputs: [{ name: "tokenOutput", type: "uint256" }] },
  { type: "function", name: "swapTokenForNative", stateMutability: "nonpayable", inputs: [{ name: "tokenInput", type: "uint256" }, { name: "minNativeOutput", type: "uint256" }, { name: "recipient", type: "address" }], outputs: [{ name: "nativeOutput", type: "uint256" }] },
] as const;
