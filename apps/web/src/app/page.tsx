"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

type Token = {
  address: string;
  name: string;
  symbol: string;
  status: "BONDING" | "GRADUATING" | "GRADUATED";
  price: string;
  marketCap: string;
  volume24h: string;
  holderCount: number;
  bondingCurveProgress: string;
  logoUrl: string | null;
  createdAt: string;
};

type TokenPage = { data: Token[]; meta: { total: number } };
type Sort = "new" | "trending" | "top-volume";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const tabs: { label: string; value: Sort }[] = [
  { label: "New launches", value: "new" },
  { label: "Trending", value: "trending" },
  { label: "Top volume", value: "top-volume" },
];

function compact(value: string): string {
  const number = Number(value);
  if (!Number.isFinite(number)) return "0";
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 2 }).format(number);
}

export default function Home() {
  const [sort, setSort] = useState<Sort>("new");
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_URL}/api/tokens?sort=${sort}&page=1&limit=12`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("API is unavailable");
        return response.json() as Promise<TokenPage>;
      })
      .then((result) => setTokens(result.data))
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(reason instanceof Error ? reason.message : "Could not load tokens");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [sort]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = query.trim();
    if (value) window.location.href = `/search?q=${encodeURIComponent(value)}`;
  }

  function selectSort(value: Sort) {
    setLoading(true);
    setError(null);
    setSort(value);
  }

  return (
    <main>
      <nav className="nav shell">
        <Link href="/" className="brand"><span className="brand-mark">P</span>PumpNow</Link>
        <div className="nav-actions">
          <Link href="/launch" className="nav-link">Launch</Link>
          <button className="wallet-button" type="button">Connect wallet</button>
        </div>
      </nav>

      <section className="hero shell">
        <div className="eyebrow"><span /> LIVE ON ARC</div>
        <h1>Launch now.<br /><em>Move the market.</em></h1>
        <p>Create, discover and trade community tokens on a transparent bonding curve.</p>
        <form className="search" onSubmit={submitSearch}>
          <span aria-hidden="true">⌕</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search token name, symbol or address" aria-label="Search tokens" />
          <button type="submit">Search</button>
        </form>
        <div className="hero-stats"><span><b>Instant</b> launches</span><span><b>Onchain</b> liquidity</span><span><b>Fair</b> pricing</span></div>
      </section>

      <section className="market shell">
        <div className="section-heading">
          <div><span className="kicker">EXPLORE</span><h2>The market, right now</h2></div>
          <Link href={`/tokens?sort=${sort}`}>View all →</Link>
        </div>
        <div className="tabs" role="tablist">
          {tabs.map((tab) => <button key={tab.value} className={sort === tab.value ? "active" : ""} onClick={() => selectSort(tab.value)} role="tab" aria-selected={sort === tab.value}>{tab.label}</button>)}
        </div>

        {loading && <div className="token-grid">{Array.from({ length: 6 }, (_, index) => <div className="token-card skeleton" key={index} />)}</div>}
        {error && <div className="notice"><b>Couldn&apos;t reach the PumpNow API.</b><span>Start the API with <code>npm run start:api</code>, then refresh this page.</span></div>}
        {!loading && !error && tokens.length === 0 && <div className="notice"><b>No tokens yet.</b><span>The first launch on Arc will appear here.</span></div>}
        {!loading && !error && tokens.length > 0 && (
          <div className="token-grid">
            {tokens.map((token) => (
              <Link className="token-card" href={`/token/${token.address}`} key={token.address}>
                <div className="token-top">
                  <div className="token-avatar">{token.logoUrl ? <span className="token-image" style={{ backgroundImage: `url(${token.logoUrl})` }} /> : token.symbol.slice(0, 2)}</div>
                  <div><h3>{token.name}</h3><span>${token.symbol}</span></div>
                  <span className={`status ${token.status.toLowerCase()}`}>{token.status === "BONDING" ? "Bonding" : token.status === "GRADUATED" ? "Graduated" : "Graduating"}</span>
                </div>
                <div className="metrics"><div><span>Market cap</span><b>${compact(token.marketCap)}</b></div><div><span>24h volume</span><b>${compact(token.volume24h)}</b></div></div>
                <div className="progress-label"><span>Bonding curve</span><b>{Number(token.bondingCurveProgress).toFixed(1)}%</b></div>
                <div className="progress"><i style={{ width: `${Math.min(100, Number(token.bondingCurveProgress))}%` }} /></div>
                <div className="token-foot"><span>{token.holderCount} holders</span><span>{new Date(token.createdAt).toLocaleDateString()}</span></div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="cta shell"><div><span className="kicker">YOUR TURN</span><h2>Got the next big idea?</h2><p>Launch your token in minutes. No presale. No gatekeepers.</p></div><Link href="/launch">Launch a token <span>→</span></Link></section>
      <footer className="footer shell"><Link href="/" className="brand"><span className="brand-mark">P</span>PumpNow</Link><span>Built on Arc · Fully onchain</span></footer>
    </main>
  );
}
