import { defineChain, type Address } from "viem";

export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: {
    name: "USDC",
    symbol: "USDC",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://rpc.testnet.arc.network"],
    },
  },
  blockExplorers: {
    default: {
      name: "Arcscan",
      url: "https://testnet.arcscan.app",
    },
  },
});

export const opnTestnet = defineChain({
  id: 984,
  name: "OPN Testnet",
  nativeCurrency: {
    name: "OPN",
    symbol: "OPN",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://testnet-rpc.iopn.tech"],
    },
  },
  blockExplorers: {
    default: {
      name: "OPN Explorer",
      url: "https://testnet.iopn.tech",
    },
  },
});

export const pumpNowChains = {
  [arcTestnet.id]: arcTestnet,
  [opnTestnet.id]: opnTestnet,
} as const;

export const pumpFactoryAddresses = {
  [arcTestnet.id]:
    "0x832c135903f0BbdB4d4ea24170a5AC79F570aB68",
  [opnTestnet.id]:
    "0x6CA6457fcFBcE13f53780e6b38B4BE6F171b7657",
} as const satisfies Record<number, Address>;

export const blockExplorerUrls = {
  [arcTestnet.id]: "https://testnet.arcscan.app",
  [opnTestnet.id]: "https://testnet.iopn.tech",
} as const;

export function getPumpFactoryAddress(
  chainId: number,
): Address | undefined {
  return pumpFactoryAddresses[
    chainId as keyof typeof pumpFactoryAddresses
  ];
}

export function getBlockExplorerUrl(
  chainId: number,
): string | undefined {
  return blockExplorerUrls[
    chainId as keyof typeof blockExplorerUrls
  ];
}

/*
 * Compatibility exports.
 *
 * Tạm giữ để các component cũ không bị lỗi
 * trong quá trình chuyển sang dual-chain.
 */
export const pumpNowChain = arcTestnet;

export const pumpFactoryAddress =
  pumpFactoryAddresses[arcTestnet.id];

export const blockExplorerUrl =
  blockExplorerUrls[arcTestnet.id];

export const chainConfigError = null;

export const pumpFactoryAbi = [
  { type: "function", name: "createToken", stateMutability: "nonpayable", inputs: [{ name: "name", type: "string" }, { name: "symbol", type: "string" }, { name: "initialSupply", type: "uint256" }, { name: "description", type: "string" }, { name: "imageUrl", type: "string" }, { name: "websiteUrl", type: "string" }, { name: "xUrl", type: "string" }, { name: "telegramUrl", type: "string" }], outputs: [{ name: "tokenAddress", type: "address" }, { name: "pairAddress", type: "address" }] },
  { type: "event", name: "TokenCreated", inputs: [{ indexed: true, name: "token", type: "address" }, { indexed: true, name: "pair", type: "address" }, { indexed: true, name: "creator", type: "address" }, { indexed: false, name: "name", type: "string" }, { indexed: false, name: "symbol", type: "string" }, { indexed: false, name: "initialSupply", type: "uint256" }, { indexed: false, name: "graduationTokenAmount", type: "uint256" }, { indexed: false, name: "description", type: "string" }, { indexed: false, name: "imageUrl", type: "string" }, { indexed: false, name: "websiteUrl", type: "string" }, { indexed: false, name: "xUrl", type: "string" }, { indexed: false, name: "telegramUrl", type: "string" }] },
] as const;

export const pumpPairAbi = [
  { type: "function", name: "virtualTokenReserve", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "virtualNativeReserve", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "tokensSold", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "graduationTokenAmount", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "feeBps", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint16" }] },
  { type: "function", name: "quoteBuy", stateMutability: "view", inputs: [{ name: "tokenAmount", type: "uint256" }], outputs: [{ name: "curveCost", type: "uint256" }, { name: "fee", type: "uint256" }, { name: "totalCost", type: "uint256" }] },
  { type: "function", name: "quoteBuyExactNative", stateMutability: "view", inputs: [{ name: "nativeInput", type: "uint256" }], outputs: [{ name: "tokenOutput", type: "uint256" }, { name: "fee", type: "uint256" }, { name: "curveInput", type: "uint256" }] },
  { type: "function", name: "quoteSell", stateMutability: "view", inputs: [{ name: "tokenAmount", type: "uint256" }], outputs: [{ name: "grossOutput", type: "uint256" }, { name: "fee", type: "uint256" }, { name: "netOutput", type: "uint256" }] },
  { type: "function", name: "buy", stateMutability: "payable", inputs: [{ name: "tokenAmount", type: "uint256" }, { name: "maxNativeInput", type: "uint256" }], outputs: [{ name: "totalCost", type: "uint256" }] },
  { type: "function", name: "buyExactNative", stateMutability: "payable", inputs: [{ name: "minTokenOutput", type: "uint256" }], outputs: [{ name: "tokenOutput", type: "uint256" }] },
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
