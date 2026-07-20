export type TokenStatus = "BONDING" | "GRADUATING" | "GRADUATED";
export type TokenSort = "new" | "trending" | "top-volume";

export type TokenSummary = {
  address: string;
  creatorAddress: string;
  name: string;
  symbol: string;
  status: TokenStatus;
  price: string;
  marketCap: string;
  volume24h: string;
  totalVolume: string;
  holderCount: number;
  tradeCount: number;
  bondingCurveProgress: string;
  logoUrl: string | null;
  createdAt: string;
};

export type TokenDetail = TokenSummary & {
  decimals: number;
  description: string | null;
  websiteUrl: string | null;
  xUrl: string | null;
  telegramUrl: string | null;
  totalSupply: string;
  circulatingSupply: string;
  graduatedAt: string | null;
  liquidityPool: { address: string; pairAddress?: string } | null;
};

export type Trade = {
  id: string;
  transactionHash: string;
  walletAddress: string;
  side: "BUY" | "SELL";
  tokenAmount: string;
  quoteAmount: string;
  price: string;
  blockTimestamp: string;
};

export type Holder = {
  walletAddress: string;
  balance: string;
  ownershipBps: number;
};

export type PlatformStats = {
  totalTokens: number;
  bondingTokens: number;
  graduatedTokens: number;
  totalTrades: string;
  totalVolume: string;
  volume24h: string;
  uniqueTraders: number;
};

export type Paginated<T> = {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};

export type CandleInterval = "1m" | "5m" | "1h";
export type Candle = { tokenAddress: string; openTime: string; open: string; high: string; low: string; close: string; volume: string; tradeCount: number };

export type Portfolio = {
  address: string;
  createdTokens: TokenDetail[];
  holdings: Array<Holder & { tokenAddress: string; token: TokenDetail }>;
  trades: Array<Trade & { tokenAddress: string; token: { name: string; symbol: string; decimals: number } }>;
};
