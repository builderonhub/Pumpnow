import Link from "next/link";
import type { TokenSummary } from "@/lib/types";
import { compactNumber, formatPrice } from "@/lib/format";

export function TokenCard({ token }: { token: TokenSummary }) {
  const progress = Math.min(100, Number(token.bondingCurveProgress) || 0);
  return <Link className="token-card" href={`/token/${token.address}`}>
    <div className="token-top"><div className="token-avatar">{token.logoUrl ? <span className="token-image" style={{ backgroundImage: `url(${token.logoUrl})` }} /> : token.symbol.slice(0, 2)}</div><div><h3>{token.name}</h3><span>${token.symbol}</span></div><span className={`status ${token.status.toLowerCase()}`}>{token.status.toLowerCase()}</span></div>
    <div className="metrics"><div><span>Price</span><b>{formatPrice(token.price)}</b></div><div><span>24h volume</span><b>{compactNumber(token.volume24h, "$ ")}</b></div></div>
    <div className="progress-label"><span>Bonding curve</span><b>{progress.toFixed(1)}%</b></div><div className="progress"><i style={{ width: `${progress}%` }} /></div>
    <div className="token-foot"><span>{token.holderCount} holders</span><span>MC {compactNumber(token.marketCap, "$ ")}</span></div>
  </Link>;
}
