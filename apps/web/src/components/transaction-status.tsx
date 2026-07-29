import type { Hash } from "viem";
import { blockExplorerUrl } from "@/lib/contracts";
import { formatAddress } from "@/lib/format";

export function TransactionStatus({ label, hash, error, pending }: { label?: string; hash?: Hash; error?: string; pending?: boolean }) {
  if (!label && !hash && !error && !pending) return null;
  return <div className={`transaction-status ${error ? "error" : ""}`} role="status">
    <b>{error ? "Transaction failed" : pending ? "Waiting for confirmation" : label ?? "Confirmed"}</b>
    {hash && blockExplorerUrl ? (
      <a className="explorer-link" href={`${blockExplorerUrl}/tx/${hash}`} target="_blank" rel="noreferrer">
        View {formatAddress(hash)} on Arcscan <span aria-hidden="true">↗</span>
      </a>
    ) : hash ? <code>{hash}</code> : null}
    {error && <span>{error}</span>}
  </div>;
}
