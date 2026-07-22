"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { formatAddress } from "@/lib/format";

export function WalletButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  if (isConnected && address) return <button className="wallet-button" type="button" onClick={() => disconnect()}>{formatAddress(address)}</button>;
  return <div className="wallet-control"><button className="wallet-button" type="button" disabled={isPending || connectors.length === 0} onClick={() => connectors[0] && connect({ connector: connectors[0] })}>{isPending ? "Connecting…" : "Connect wallet"}</button>{error ? <span className="wallet-error" role="status">Wallet connection failed. Check that your wallet extension is unlocked.</span> : null}</div>;
}
