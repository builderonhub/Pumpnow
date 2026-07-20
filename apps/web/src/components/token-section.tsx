"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { TokenSort } from "@/lib/types";
import { LoadingGrid, StatePanel } from "./states";
import { TokenCard } from "./token-card";

export function TokenSection({ sort }: { sort: TokenSort }) {
  const result = useQuery({ queryKey: ["tokens", sort], queryFn: () => api.tokens(sort, 6) });
  if (result.isPending) return <LoadingGrid />;
  if (result.isError) return <StatePanel title="Market data is offline" message="Start the PumpNow API, then try again." action={<button onClick={() => result.refetch()}>Try again</button>} />;
  if (result.data.data.length === 0) return <StatePanel title="No launches yet" message="The first token indexed on Arc will appear here." />;
  return <div className="token-grid">{result.data.data.map((token) => <TokenCard token={token} key={token.address} />)}</div>;
}
