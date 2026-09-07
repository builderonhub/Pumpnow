"use client";

import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { arcTestnet, opnTestnet } from "@/lib/contracts";

const CHAINS = [arcTestnet, opnTestnet] as const;

export function NetworkSwitcher({
  variant = "header",
}: {
  variant?: "header" | "sidebar";
}) {
  const chainId = useChainId();
  const { isConnected } = useAccount();
  const { switchChain, isPending, error } = useSwitchChain();
  const current = CHAINS.find((c) => c.id === chainId);

  const select = (
    <select
      className="network-select"
      value={current ? String(chainId) : ""}
      disabled={!isConnected || isPending}
      onChange={(e) => {
        const next = Number(e.target.value);
        if (!next || next === chainId) return;
        switchChain({ chainId: next as (typeof CHAINS)[number]["id"] });
      }}
      aria-label="Select network"
    >
      {!current ? (
        <option value="" disabled>
          Select Arc or OPN
        </option>
      ) : null}
      {CHAINS.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );

  if (variant === "header") {
    return (
      <div className="network-switcher-header">
        {select}
        {error ? <span className="network-error">{error.message}</span> : null}
      </div>
    );
  }

  return (
    <div className="network-card">
      <span>
        <i />
        {current?.name ?? "Unsupported network"}
      </span>
      {select}
      <small>
        {!isConnected
          ? "Connect wallet to switch"
          : isPending
            ? "Confirm in wallet…"
            : current
              ? "Wallet follows this network"
              : "Switch wallet to Arc or OPN"}
      </small>
    </div>
  );
}