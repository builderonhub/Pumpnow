"use client";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import { LoadingGrid, StatePanel } from "@/components/states";
import { TokenCard } from "@/components/token-card";
function SearchContent() {
  const params = useSearchParams(); const router = useRouter(); const query = params.get("q")?.trim() ?? ""; const [value, setValue] = useState(query);
  const result = useQuery({ queryKey: ["search", query], queryFn: () => api.search(query), enabled: query.length > 0 });
  function submit(event: FormEvent) { event.preventDefault(); if (value.trim()) router.push(`/search?q=${encodeURIComponent(value.trim())}`); }
  return <section className="page shell"><div className="page-intro compact"><span className="kicker">DISCOVER</span><h1>Find your next token.</h1></div><form className="search search-page" onSubmit={submit}><span aria-hidden="true">⌕</span><input value={value} onChange={(event) => setValue(event.target.value)} placeholder="Name, symbol or contract address" aria-label="Search tokens" /><button>Search</button></form>{!query && <StatePanel title="Search PumpNow" message="Enter a token name, ticker or Arc contract address." />}{query && result.isPending && <LoadingGrid />}{result.isError && <StatePanel title="Search is unavailable" message="Check the API connection and try again." />}{result.data && result.data.data.length === 0 && <StatePanel title="No matches" message={`Nothing matched “${query}”.`} />}{result.data && result.data.data.length > 0 && <><p className="result-count">{result.data.meta.total} results for “{query}”</p><div className="token-grid">{result.data.data.map((token) => <TokenCard token={token} key={token.address} />)}</div></>}</section>;
}

export default function SearchPage() {
  return <Suspense fallback={<section className="page shell"><LoadingGrid /></section>}><SearchContent /></Suspense>;
}
