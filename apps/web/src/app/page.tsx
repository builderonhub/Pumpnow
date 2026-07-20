"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { TokenSection } from "@/components/token-section";
import type { TokenSort } from "@/lib/types";

const tabs: { label: string; value: TokenSort }[] = [{ label: "New launches", value: "new" }, { label: "Trending", value: "trending" }, { label: "Top volume", value: "top-volume" }];

export default function Home() {
  const [sort, setSort] = useState<TokenSort>("new");
  const [query, setQuery] = useState("");
  const router = useRouter();
  function search(event: FormEvent) { event.preventDefault(); if (query.trim()) router.push(`/search?q=${encodeURIComponent(query.trim())}`); }
  return <>
    <section className="hero shell"><div className="eyebrow"><span /> LIVE ON ARC</div><h1>Launch now.<br /><em>Move the market.</em></h1><p>Discover community tokens as they launch. Transparent pricing, live market data and no gatekeepers.</p><form className="search" onSubmit={search}><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, symbol or address" aria-label="Search tokens" /><button>Search</button></form><div className="hero-stats"><span><b>Instant</b> launches</span><span><b>API-first</b> market data</span><span><b>Fair</b> pricing</span></div></section>
    <section className="market shell"><div className="section-heading"><div><span className="kicker">EXPLORE</span><h2>The market, right now</h2></div><Link href="/search">View all →</Link></div><div className="tabs" role="tablist">{tabs.map((tab) => <button key={tab.value} className={sort === tab.value ? "active" : ""} onClick={() => setSort(tab.value)} role="tab" aria-selected={sort === tab.value}>{tab.label}</button>)}</div><TokenSection sort={sort} /></section>
    <section className="cta shell"><div><span className="kicker">YOUR TURN</span><h2>Got the next big idea?</h2><p>Prepare your launch now. Onchain creation is coming next.</p></div><Link href="/launch">Create a draft <span>→</span></Link></section>
  </>;
}
