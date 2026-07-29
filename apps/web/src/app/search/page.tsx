"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { TokenSection } from "@/components/token-section";
import { LoadingGrid, StatePanel } from "@/components/states";
import { TokenCard } from "@/components/token-card";
import { api } from "@/lib/api";

function DiscoverySections() {
  return (
    <div className="discovery-grid">
      <section className="discovery-section">
        <div className="discovery-heading">
          <div>
            <span className="kicker">WHAT&apos;S HOT</span>
            <h2>Trending now</h2>
          </div>
          <span className="discovery-dot" aria-hidden="true" />
        </div>
        <TokenSection sort="trending" limit={6} compact />
      </section>

      <section className="discovery-section">
        <div className="discovery-heading">
          <div>
            <span className="kicker">JUST LAUNCHED</span>
            <h2>New tokens</h2>
          </div>
          <span className="discovery-spark" aria-hidden="true">↗</span>
        </div>
        <TokenSection sort="new" limit={6} compact />
      </section>
    </div>
  );
}

function SearchContent() {
  const params = useSearchParams();
  const router = useRouter();
  const query = params.get("q")?.trim() ?? "";
  const [value, setValue] = useState(query);
  const result = useQuery({
    queryKey: ["search", query],
    queryFn: () => api.search(query),
    enabled: query.length > 0,
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    const nextQuery = value.trim();
    router.push(nextQuery ? `/search?q=${encodeURIComponent(nextQuery)}` : "/search");
  }

  return (
    <section className="page shell discover-page">
      <div className="page-intro compact">
        <span className="kicker">DISCOVER</span>
        <h1>Find your next token.</h1>
        <p>Search the market or browse what is moving on Arc right now.</p>
      </div>

      <form className="search search-page" onSubmit={submit}>
        <span aria-hidden="true">⌕</span>
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Name, symbol or contract address"
          aria-label="Search tokens"
        />
        <button>Search</button>
      </form>

      {!query && <DiscoverySections />}
      {query && result.isPending && <LoadingGrid />}
      {result.isError && (
        <StatePanel
          title="Search is unavailable"
          message="Check the API connection and try again."
        />
      )}
      {result.data && result.data.data.length === 0 && (
        <StatePanel title="No matches" message={`Nothing matched “${query}”.`} />
      )}
      {result.data && result.data.data.length > 0 && (
        <section className="search-results">
          <div className="discovery-heading">
            <div>
              <span className="kicker">SEARCH RESULTS</span>
              <h2>{result.data.meta.total} matches for “{query}”</h2>
            </div>
          </div>
          <div className="token-grid">
            {result.data.data.map((token) => (
              <TokenCard token={token} key={token.address} />
            ))}
          </div>
        </section>
      )}
    </section>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<section className="page shell"><LoadingGrid /></section>}>
      <SearchContent />
    </Suspense>
  );
}
