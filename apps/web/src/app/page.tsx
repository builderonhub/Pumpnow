"use client";

import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { TokenSort } from "@/lib/types";
import { TokenSection } from "@/components/token-section";
import { TokenCard } from "@/components/token-card";
import { StatePanel } from "@/components/states";

const tabs: Array<{ label: string; value: TokenSort }> = [
  { label: "For you", value: "trending" },
  { label: "New", value: "new" },
  { label: "Top volume", value: "top-volume" },
];

function Carousel({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  const rail = useRef<HTMLDivElement>(null);
  const scroll = (direction: -1 | 1) => rail.current?.scrollBy({ left: direction * Math.max(280, rail.current.clientWidth * 0.72), behavior: "smooth" });

  return <div className="carousel-shell">
    <div className="carousel-actions" aria-label={`${label} controls`}>
      <button type="button" aria-label={`Previous ${label}`} onClick={() => scroll(-1)}>←</button>
      <button type="button" aria-label={`Next ${label}`} onClick={() => scroll(1)}>→</button>
    </div>
    <div ref={rail} className={`horizontal-rail ${className}`} aria-label={label}>{children}</div>
  </div>;
}

export default function Home() {
  const [sort, setSort] = useState<TokenSort>("trending");
  const featured = useQuery({ queryKey: ["tokens", "top-volume", "featured"], queryFn: () => api.tokens("top-volume", 6) });
  const trending = useQuery({ queryKey: ["tokens", "trending", "rail"], queryFn: () => api.tokens("trending", 8) });

  return <div className="feed-home">
    <section className="feed-section featured-launches">
      <div className="feed-heading"><div><span className="feed-icon" aria-hidden="true">↗</span><h1>Featured launches</h1></div><Link href="/search">View all</Link></div>
      {featured.isPending ? <Carousel label="Loading featured launches"><div className="feature-placeholder skeleton" /><div className="feature-placeholder skeleton" /><div className="feature-placeholder skeleton" /></Carousel> : featured.isError ? <StatePanel title="Featured launches unavailable" message="The market feed is reconnecting." /> : <Carousel label="Featured launches" className="featured-rail">{featured.data.data.map((token, index) => <TokenCard token={token} key={token.address} rank={index + 1} featured />)}</Carousel>}
    </section>

    <section className="feed-section">
      <div className="feed-heading"><div><h2>Trending now</h2></div><Link href="/search">View all</Link></div>
      {trending.isPending ? <Carousel label="Loading trending tokens"><div className="trend-placeholder skeleton" /><div className="trend-placeholder skeleton" /><div className="trend-placeholder skeleton" /><div className="trend-placeholder skeleton" /></Carousel> : trending.isError ? <StatePanel title="Trending is reconnecting" message="Live Arc data will return automatically." /> : <Carousel label="Trending tokens" className="trending-rail">{trending.data.data.map((token, index) => <TokenCard token={token} key={token.address} rank={index + 1} spotlight />)}</Carousel>}
    </section>

    <section className="feed-section explore-section">
      <div className="feed-heading explore-heading"><div><h2>Explore coins</h2></div></div>
      <div className="explore-tabs" role="tablist">{tabs.map((tab) => <button type="button" key={tab.value} className={sort === tab.value ? "active" : ""} onClick={() => setSort(tab.value)} role="tab" aria-selected={sort === tab.value}>{tab.label}</button>)}</div>
      <TokenSection sort={sort} limit={12} />
    </section>
  </div>;
}
