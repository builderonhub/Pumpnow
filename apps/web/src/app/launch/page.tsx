"use client";

import { useEffect, useState, type FormEvent } from "react";
import { parseUnits } from "viem";
import { useAccount, useChainId, useSwitchChain, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { chainConfigError, pumpFactoryAbi, pumpFactoryAddress, pumpNowChain } from "@/lib/contracts";
import { TransactionStatus } from "@/components/transaction-status";

function messageOf(error: Error | null): string | undefined {
  return error?.message.split("\n")[0];
}

export default function LaunchPage() {
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [supply, setSupply] = useState("1000000000");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [xUrl, setXUrl] = useState("");
  const [telegramUrl, setTelegramUrl] = useState("");
  const [validationError, setValidationError] = useState<string>();
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending: switching } = useSwitchChain();
  const queryClient = useQueryClient();
  const write = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash: write.data });

  useEffect(() => {
    if (receipt.isSuccess) void queryClient.invalidateQueries({ queryKey: ["tokens"] });
  }, [queryClient, receipt.isSuccess]);

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!pumpFactoryAddress || chainConfigError || !isConnected || chainId !== pumpNowChain.id) return;
    setValidationError(undefined);
    const optionalUrls = [imageUrl, websiteUrl, xUrl, telegramUrl].filter(Boolean);
    if (description.trim().length > 1000) return setValidationError("Description must be 1,000 characters or fewer.");
    try { optionalUrls.forEach((value) => { const url = new URL(value); if (url.protocol !== "https:") throw new Error(); }); } catch { return setValidationError("All supplied URLs must be valid HTTPS URLs."); }
    let initialSupply: bigint;
    try { initialSupply = parseUnits(supply, 18); } catch { return; }
    write.writeContract({ address: pumpFactoryAddress, abi: pumpFactoryAbi, functionName: "createToken", args: [name.trim(), symbol.trim().toUpperCase(), initialSupply, description.trim(), imageUrl.trim(), websiteUrl.trim(), xUrl.trim(), telegramUrl.trim()], chainId: pumpNowChain.id });
  }

  const wrongChain = isConnected && chainId !== pumpNowChain.id;
  return <section className="page shell"><div className="page-intro"><span className="kicker">LAUNCH STUDIO</span><h1>Shape your next token.</h1><p>The connected wallet creates the token and its bonding-curve pair onchain.</p></div>
    <form className="launch-form" onSubmit={submit}><div className="form-grid"><label className="logo-field"><span>Image URL</span><input type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" /></label><div className="form-fields"><div className="field-row"><label>Name<input required minLength={1} maxLength={100} value={name} onChange={(e) => setName(e.target.value)} placeholder="Arcade Cats" /></label><label>Symbol<input required pattern="[A-Za-z0-9]{1,20}" minLength={1} maxLength={20} value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="ARCAT" /></label></div><label>Description<textarea maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} /></label><label>Initial supply<input required inputMode="decimal" value={supply} onChange={(e) => setSupply(e.target.value)} /></label><div className="field-row"><label>Website<input type="url" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} /></label><label>X<input type="url" value={xUrl} onChange={(e) => setXUrl(e.target.value)} /></label></div><label>Telegram<input type="url" value={telegramUrl} onChange={(e) => setTelegramUrl(e.target.value)} /></label></div></div>
      <div className="form-note"><span>Onchain</span><p>{chainConfigError ?? (wrongChain ? `Switch to ${pumpNowChain.name} before launching.` : "Your wallet will ask you to confirm the factory transaction.")}</p>{wrongChain ? <button type="button" disabled={switching} onClick={() => switchChain({ chainId: pumpNowChain.id })}>Switch network</button> : <button type="submit" disabled={!isConnected || write.isPending || receipt.isLoading || Boolean(chainConfigError)}>{!isConnected ? "Connect wallet first" : write.isPending ? "Confirm in wallet…" : receipt.isLoading ? "Launching…" : "Launch token"}</button>}</div>
      <TransactionStatus hash={write.data} pending={write.isPending || receipt.isLoading} label={receipt.isSuccess ? "Token launch confirmed. Waiting for the indexer to publish it." : undefined} error={validationError ?? messageOf(write.error ?? receipt.error)} />
    </form></section>;
}
