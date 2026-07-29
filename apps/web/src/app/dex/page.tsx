"use client";

import Link from "next/link";
import { TokenSection } from "@/components/token-section";

export default function DexMarketsPage() {
  return (
    <section className="page shell dex-markets-page">
      <div className="dex-hero">
        <div>
          <span className="kicker">PUMPNOW DEX</span>
          <h1>Graduated markets.</h1>
          <p>
            Bonding-curve graduates trade here in permanent onchain liquidity
            pools. Choose a token to buy or sell directly from your wallet.
          </p>
        </div>
        <div className="dex-explainer">
          <span>HOW IT WORKS</span>
          <ol>
            <li><b>01</b> Token completes its bonding curve</li>
            <li><b>02</b> Liquidity migrates automatically</li>
            <li><b>03</b> Trading continues on PumpNow DEX</li>
          </ol>
        </div>
      </div>

      <div className="dex-market-heading">
        <div>
          <span className="kicker">LIVE POOLS</span>
          <h2>Trade graduated tokens</h2>
        </div>
        <Link href="/search">Explore all launches →</Link>
      </div>

      <TokenSection
        sort="top-volume"
        limit={24}
        status="GRADUATED"
      />
    </section>
  );
}
