import type { Hash } from "viem";

export function TransactionStatus({ label, hash, error, pending }: { label?: string; hash?: Hash; error?: string; pending?: boolean }) {
  if (!label && !hash && !error && !pending) return null;
  return <div className={`transaction-status ${error ? "error" : ""}`} role="status">
    <b>{error ? "Transaction failed" : pending ? "Waiting for confirmation" : label ?? "Confirmed"}</b>
    {hash && <code>{hash}</code>}
    {error && <span>{error}</span>}
  </div>;
}
