"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { api } from "@/lib/api";
import { formatAddress, formatTokenAmount } from "@/lib/format";
import { WalletButton } from "@/components/wallet-button";
import { StatePanel } from "@/components/states";

export default function PortfolioPage() {
  const { address, isConnected } = useAccount();
  const portfolio = useQuery({
    queryKey: ["portfolio", address?.toLowerCase()],
    queryFn: () => api.portfolio(address!.toLowerCase()),
    enabled: Boolean(address),
  });
  if (!isConnected) return <section className="page shell"><div className="portfolio-empty"><h1>Connect your wallet</h1><p>Your indexed holdings, launches and trades will appear here.</p><WalletButton /></div></section>;
  if (portfolio.isPending) return <section className="page shell"><div className="detail-skeleton skeleton" /></section>;
  if (portfolio.isError) return <section className="page shell"><StatePanel title="Portfolio unavailable" message="The API could not load this wallet yet." /></section>;
  const data = portfolio.data;
  return <section className="page shell"><div className="page-intro"><span className="kicker">PORTFOLIO</span><h1>{formatAddress(data.address)}</h1><p>All balances and history below come from the PumpNow indexer API.</p></div>
    <div className="tables-grid"><section className="panel"><div className="panel-heading"><h2>Holdings</h2><span>{data.holdings.length}</span></div>{data.holdings.length ? <div className="data-table">{data.holdings.map((holding) => <Link className="table-row" href={`/token/${holding.tokenAddress}`} key={holding.tokenAddress}><b>{holding.token.symbol}</b><span>{holding.token.name}</span><b>{formatTokenAmount(holding.balance, holding.token.decimals)}</b><time>{(holding.ownershipBps / 100).toFixed(2)}%</time></Link>)}</div> : <p className="table-empty">No current holdings.</p>}</section>
    <section className="panel"><div className="panel-heading"><h2>Created tokens</h2><span>{data.createdTokens.length}</span></div>{data.createdTokens.length ? <div className="data-table">{data.createdTokens.map((token) => <Link className="table-row" href={`/token/${token.address}`} key={token.address}><b>{token.symbol}</b><span>{token.name}</span><span>{token.status}</span><time>{new Date(token.createdAt).toLocaleDateString()}</time></Link>)}</div> : <p className="table-empty">No tokens created yet.</p>}</section></div>
    <section className="panel"><div className="panel-heading"><h2>Trade history</h2><span>{data.trades.length}</span></div>{data.trades.length ? <div className="data-table">{data.trades.map((trade) => <Link className="table-row" href={`/token/${trade.tokenAddress}`} key={trade.id}><span className={trade.side === "BUY" ? "buy" : "sell"}>{trade.side}</span><b>{trade.token.symbol}</b><span>{formatTokenAmount(trade.tokenAmount, trade.token.decimals)}</span><time>{new Date(trade.blockTimestamp).toLocaleString()}</time></Link>)}</div> : <p className="table-empty">No indexed trades yet.</p>}</section>
  </section>;
}
