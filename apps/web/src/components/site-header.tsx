"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { WalletButton } from "./wallet-button";

export function SiteHeader() {
  const [query, setQuery] = useState("");
  const router = useRouter();
  useEffect(() => { if (query.trim().length < 2) return; const timer = window.setTimeout(() => router.prefetch(`/search?q=${encodeURIComponent(query.trim())}`), 250); return () => window.clearTimeout(timer); }, [query, router]);
  function submit(event: FormEvent) { event.preventDefault(); const value = query.trim(); if (value) router.push(`/search?q=${encodeURIComponent(value)}`); }
  return <><div className="beta-banner">PumpNow beta is live on Arc Testnet. Trade responsibly. <span>→</span></div><header className="site-header"><Link href="/" className="mobile-brand"><span className="brand-mark">P</span>PumpNow</Link><form className="top-search" onSubmit={submit}><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search for tokens and addresses..." aria-label="Search PumpNow" /><kbd>⌘ K</kbd></form><div className="header-actions"><WalletButton /></div></header></>;
}
