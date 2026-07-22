"use client";

import { useQuery } from "@tanstack/react-query";
import { API_URL } from "@/lib/api";

type Health = { status: string; service: string; checks?: Record<string, string | null>; timestamp: string };
const indexerUrl = process.env.NEXT_PUBLIC_INDEXER_URL ?? "http://localhost:3002";

async function health(url: string): Promise<Health> {
  const response = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
  const body = await response.json() as Health;
  if (!response.ok) throw new Error(`${body.service ?? "Service"} is unavailable`);
  return body;
}

export default function StatusPage() {
  const api = useQuery({ queryKey: ["health", "api"], queryFn: () => health(`${API_URL}/api/health`), refetchInterval: 30_000, retry: 2 });
  const indexer = useQuery({ queryKey: ["health", "indexer"], queryFn: () => health(`${indexerUrl}/health`), refetchInterval: 30_000, retry: 2 });
  const services = [{ name: "API", query: api }, { name: "Indexer", query: indexer }];
  return <section className="page shell"><div className="page-intro compact"><span className="kicker">TESTNET BETA</span><h1>System status</h1><p>Live readiness checks refresh every 30 seconds.</p></div><div className="token-grid">{services.map(({ name, query }) => <article className="panel" key={name}><div className="panel-heading"><h2>{name}</h2><span className={`status ${query.isSuccess ? "graduated" : ""}`}>{query.isPending ? "checking" : query.isSuccess ? "operational" : "degraded"}</span></div>{query.data?.checks ? Object.entries(query.data.checks).map(([key, value]) => <div className="progress-label" key={key}><span>{key}</span><b>{value ?? "unknown"}</b></div>) : null}{query.error ? <p className="transaction-status error">{query.error.message}</p> : null}<p className="token-foot">Last checked <span>{query.data ? new Date(query.data.timestamp).toLocaleTimeString() : "—"}</span></p></article>)}</div></section>;
}
