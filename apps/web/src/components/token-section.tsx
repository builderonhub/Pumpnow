"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { TokenSort } from "@/lib/types";
import { LoadingGrid, StatePanel } from "./states";
import { TokenCard } from "./token-card";

export function TokenSection({ sort, limit = 8, compact = false }: { sort: TokenSort; limit?: number; compact?: boolean }) {
  const result = useQuery({ queryKey: ["tokens", sort, limit], queryFn: () => api.tokens(sort, limit), placeholderData: (previous) => previous });
  if (result.isPending) return <LoadingGrid />;
  if (result.isError) return <StatePanel title="Market data is reconnecting" message="PumpNow will retry automatically. You can also try again now." action={<button onClick={() => result.refetch()}>Try again</button>} />;
  if (result.data.data.length === 0) return <StatePanel title="No launches yet" message="The first token indexed on Arc will appear here." />;
  return <div className={compact ? "token-list" : "token-grid"}>{result.data.data.map((token, index) => <TokenCard token={token} key={token.address} rank={compact ? index + 1 : undefined} compact={compact} />)}</div>;
}
