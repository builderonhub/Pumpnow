import type { Hash } from "viem";
import { useChainId } from "wagmi";
import { getBlockExplorerUrl } from "@/lib/contracts";
import { formatAddress } from "@/lib/format";

export function TransactionStatus({
  label,
  hash,
  error,
  pending,
}: {
  label?: string;
  hash?: Hash;
  error?: string;
  pending?: boolean;
}) {
  const chainId = useChainId();
  const blockExplorerUrl = getBlockExplorerUrl(chainId);

  if (!label && !hash && !error && !pending) {
    return null;
  }

  const explorerName =
    chainId === 984
      ? "OPN Explorer"
      : "Arcscan";

  return (
    <div
      className={`transaction-status ${
        error ? "error" : ""
      }`}
      role="status"
    >
      <b>
        {error
          ? "Transaction failed"
          : pending
            ? "Waiting for confirmation"
            : label ?? "Confirmed"}
      </b>

      {hash && blockExplorerUrl ? (
        <a
          className="explorer-link"
          href={`${blockExplorerUrl}/tx/${hash}`}
          target="_blank"
          rel="noreferrer"
        >
          View {formatAddress(hash)} on{" "}
          {explorerName}{" "}
          <span aria-hidden="true">↗</span>
        </a>
      ) : hash ? (
        <code>{hash}</code>
      ) : null}

      {error && <span>{error}</span>}
    </div>
  );
}