"use client";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { compactNumber, formatAddress, formatPrice, formatTokenAmount } from "@/lib/format";
import { StatePanel } from "@/components/states";
import { TradePanel } from "@/components/trade-panel";
import { PriceChart } from "@/components/price-chart";
import { DexSwapPanel } from "@/components/dex-swap-panel";
import { blockExplorerUrl } from "@/lib/contracts";
export default function TokenPage() {
  const address = String(useParams<{ address: string }>().address).toLowerCase();
  const token = useQuery({ queryKey: ["token", address], queryFn: () => api.token(address) });
  const trades = useQuery({ queryKey: ["trades", address], queryFn: () => api.trades(address) });
  const holders = useQuery({ queryKey: ["holders", address], queryFn: () => api.holders(address) });
  if (token.isPending) return <section className="page shell"><div className="detail-skeleton skeleton" /></section>;
  if (token.isError) return <section className="page shell"><StatePanel title="Token not found" message="It may not be indexed yet, or the address is invalid." /></section>;
  const item = token.data; const progress = Math.min(100, Number(item.bondingCurveProgress) || 0);
  return <section className="page shell">
    <div className="token-hero"><div className="token-avatar large">{item.logoUrl ? <span className="token-image" style={{ backgroundImage: `url(${item.logoUrl})` }} /> : item.symbol.slice(0, 2)}</div><div><div className="token-title"><h1>{item.name}</h1><span>${item.symbol}</span><span className={`status ${item.status.toLowerCase()}`}>{item.status.toLowerCase()}</span></div><p>{item.description ?? "Community token launching on PumpNow."}</p>{blockExplorerUrl ? <a className="contract-link" href={`${blockExplorerUrl}/address/${item.address}`} target="_blank" rel="noreferrer"><code>{formatAddress(item.address)}</code> <span aria-hidden="true">↗</span></a> : <code>{formatAddress(item.address)}</code>}{item.status === "GRADUATED" && item.liquidityPool?.address && blockExplorerUrl ? <a className="pool-link" href={`${blockExplorerUrl}/address/${item.liquidityPool.address}`} target="_blank" rel="noreferrer">DEX pool {formatAddress(item.liquidityPool.address)} ↗</a> : null}</div></div>
    <div className="stat-grid"><div><span>Price</span><b>{formatPrice(item.price)}</b></div><div><span>Market cap</span><b>{compactNumber(item.marketCap, "$ ")}</b></div><div><span>24h volume</span><b>{compactNumber(item.volume24h, "$ ")}</b></div><div><span>Holders</span><b>{item.holderCount.toLocaleString()}</b></div></div>
    <div className="detail-grid"><div className="panel chart-panel"><PriceChart tokenAddress={item.address} /></div>{item.status === "GRADUATED" && item.liquidityPool?.address ? <DexSwapPanel tokenAddress={item.address} poolAddress={item.liquidityPool.address} decimals={item.decimals} /> : <TradePanel tokenAddress={item.address} pairAddress={item.liquidityPool?.address ?? item.liquidityPool?.pairAddress} decimals={item.decimals} />}</div>
    <div className="curve-card"><div><span>Bonding curve progress</span><b>{progress.toFixed(1)}%</b></div><div className="progress"><i style={{ width: `${progress}%` }} /></div></div>
    <div className="tables-grid"><section className="panel"><div className="panel-heading"><h2>Recent trades</h2><span>{trades.data?.meta.total ?? 0} total</span></div>{trades.isPending ? <div className="table-loading skeleton" /> : trades.data?.data.length ? <div className="data-table">{trades.data.data.map((trade) => <div className="table-row" key={trade.id}><span className={trade.side === "BUY" ? "buy" : "sell"}>{trade.side}</span><span>{formatAddress(trade.walletAddress)}</span><b>{formatTokenAmount(trade.tokenAmount, item.decimals)} {item.symbol}</b>{blockExplorerUrl ? <a className="trade-tx-link" href={`${blockExplorerUrl}/tx/${trade.transactionHash}`} target="_blank" rel="noreferrer">{new Date(trade.blockTimestamp).toLocaleDateString()} ↗</a> : <time>{new Date(trade.blockTimestamp).toLocaleDateString()}</time>}</div>)}</div> : <p className="table-empty">No trades indexed yet.</p>}</section><section className="panel"><div className="panel-heading"><h2>Top holders</h2><span>{holders.data?.meta.total ?? 0} total</span></div>{holders.isPending ? <div className="table-loading skeleton" /> : holders.data?.data.length ? <div className="data-table">{holders.data.data.map((holder, index) => <div className="table-row holder-row" key={holder.walletAddress}><span>#{index + 1}</span><span>{formatAddress(holder.walletAddress)}</span><b>{formatTokenAmount(holder.balance, item.decimals)}</b><time>{(holder.ownershipBps / 100).toFixed(2)}%</time></div>)}</div> : <p className="table-empty">No holders indexed yet.</p>}</section></div>
  </section>;
}
