import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import type { TokenSummary } from "@/lib/types";
import { compactNumber, formatPrice } from "@/lib/format";

type Props = { token: TokenSummary; rank?: number; featured?: boolean; spotlight?: boolean; compact?: boolean };

function Artwork({ token, fill = false }: { token: TokenSummary; fill?: boolean }) {
  const hue = [...token.symbol].reduce((total, character) => total + character.charCodeAt(0), 0) % 360;
  const artworkStyle = { "--art-hue": hue } as CSSProperties;
  return <div className={fill ? "card-artwork cover" : "token-avatar"} style={artworkStyle}>{token.logoUrl ? <Image className="token-image" src={token.logoUrl} alt={`${token.name} token artwork`} width={fill ? 420 : 64} height={fill ? 250 : 64} unoptimized /> : <div className="generated-art" aria-label={`${token.name} generated artwork`}><i /><b>{token.symbol.slice(0, 2).toUpperCase()}</b><small>${token.symbol.toUpperCase()}</small></div>}</div>;
}

export function TokenCard({ token, rank, featured = false, spotlight = false, compact = false }: Props) {
  const progress = Math.min(100, Number(token.bondingCurveProgress) || 0);
  if (featured) return <Link className="feature-card" href={`/token/${token.address}`}><Artwork token={token} fill /><div className="feature-copy"><div><span className="open-badge">LIVE</span><small>#{rank} featured</small></div><h3>{token.name}</h3><strong>{compactNumber(token.marketCap, "$ ")} <small>MARKET CAP</small></strong><p><span>{token.holderCount} holders</span><span>{token.tradeCount} trades</span></p></div></Link>;
  if (spotlight) return <Link className="trend-card" href={`/token/${token.address}`}><div className="trend-cover"><Artwork token={token} fill /><span>{compactNumber(token.marketCap, "$ ")}</span><b>{token.name} <small>${token.symbol}</small></b></div><p>{progress.toFixed(0)}% through the bonding curve</p></Link>;
  return <Link className={`token-card${compact ? " compact" : ""}`} href={`/token/${token.address}`}>{rank ? <span className="token-rank">#{rank}</span> : null}<div className="token-top"><Artwork token={token} /><div className="token-identity"><h3>{token.name}</h3><span>${token.symbol}</span></div><span className={`status ${token.status.toLowerCase()}`}>{token.status.toLowerCase()}</span></div><div className="metrics"><div><span>Market cap</span><b>{compactNumber(token.marketCap, "$ ")}</b></div><div><span>24h volume</span><b>{compactNumber(token.volume24h, "$ ")}</b></div></div><div className="progress-label"><span>Bonding curve</span><b>{progress.toFixed(1)}%</b></div><div className="progress"><i style={{ width: `${progress}%` }} /></div><div className="token-foot"><span>{token.holderCount} holders</span><span>{token.tradeCount} trades</span><span>{formatPrice(token.price)}</span></div></Link>;
}
