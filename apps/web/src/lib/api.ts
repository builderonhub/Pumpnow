import type { Candle, CandleInterval, Holder, Paginated, PlatformStats, Portfolio, TokenDetail, TokenSort, TokenStatus, TokenSummary, Trade } from "./types";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    const message = response.status === 404 ? "Resource not found" : "PumpNow API is unavailable";
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export const api = {
  tokens: (sort: TokenSort, limit = 12, status?: TokenStatus) => request<Paginated<TokenSummary>>(`/api/tokens?sort=${sort}&page=1&limit=${limit}${status ? `&status=${status}` : ""}`),
  token: (address: string) => request<TokenDetail>(`/api/tokens/${address}`),
  trades: (address: string) => request<Paginated<Trade>>(`/api/tokens/${address}/trades?page=1&limit=20`),
  holders: (address: string) => request<Paginated<Holder>>(`/api/tokens/${address}/holders?page=1&limit=20`),
  search: (query: string) => request<Paginated<TokenSummary>>(`/api/search?q=${encodeURIComponent(query)}&page=1&limit=24`),
  stats: () => request<PlatformStats>("/api/stats/platform"),
  candles: (address: string, interval: CandleInterval, limit = 500) => request<Candle[]>(`/api/tokens/${address}/candles?interval=${interval}&limit=${limit}`),
  portfolio: (address: string) => request<Portfolio>(`/api/wallets/${address}/portfolio`),
};
