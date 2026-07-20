export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type TokenSummaryResponse = {
  address: string;
  creatorAddress: string;
  name: string;
  symbol: string;
  status: string;
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

export type PaginatedResponse<T> = { data: T[]; meta: PaginationMeta };
