"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { isAddress, parseUnits, type Address, type Hash } from "viem";
import { useAccount, useChainId, usePublicClient, useSwitchChain, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { erc20Abi, pumpNowChain, pumpPairAbi } from "@/lib/contracts";
import { TransactionStatus } from "@/components/transaction-status";

type Phase = "idle" | "approving" | "selling" | "buying";

export function TradePanel({ tokenAddress, pairAddress, decimals, disabled = false }: { tokenAddress: string; pairAddress?: string; decimals: number; disabled?: boolean }) {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string>();
  const [finalHash, setFinalHash] = useState<Hash>();
  const [slippageBps, setSlippageBps] = useState(100);
  const { address: walletAddress, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const publicClient = usePublicClient({ chainId: pumpNowChain.id });
  const queryClient = useQueryClient();
  const write = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash: finalHash });
  const validAddresses = isAddress(tokenAddress) && Boolean(pairAddress && isAddress(pairAddress));

  useEffect(() => {
    if (!receipt.isSuccess) return;
    void Promise.all([
      queryClient.invalidateQueries({ queryKey: ["token", tokenAddress.toLowerCase()] }),
      queryClient.invalidateQueries({ queryKey: ["trades", tokenAddress.toLowerCase()] }),
      queryClient.invalidateQueries({ queryKey: ["holders", tokenAddress.toLowerCase()] }),
      queryClient.invalidateQueries({ queryKey: ["tokens"] }),
      queryClient.invalidateQueries({ queryKey: ["stats"] }),
    ]);
  }, [queryClient, receipt.isSuccess, tokenAddress]);

  async function trade(): Promise<void> {
    setError(undefined); setFinalHash(undefined);
    if (!isConnected) return setError("Connect your wallet first.");
    if (disabled) return setError("Trading is closed because this token has graduated.");
    if (chainId !== pumpNowChain.id) { switchChain({ chainId: pumpNowChain.id }); return; }
    if (!publicClient || !validAddresses || !pairAddress) return setError("Contract addresses are unavailable or invalid.");
    let tokenAmount: bigint;
    try { tokenAmount = parseUnits(amount, decimals); if (tokenAmount <= 0n) throw new Error(); } catch { return setError("Enter a valid token amount."); }
    const pair = pairAddress as Address;
    const token = tokenAddress as Address;
    try {
      if (side === "buy") {
        setPhase("buying");
        const quote = await publicClient.readContract({ address: pair, abi: pumpPairAbi, functionName: "quoteBuy", args: [tokenAmount] });
        const balance = await publicClient.getBalance({ address: walletAddress! });
        const maxInput = quote[2] + (quote[2] * BigInt(slippageBps)) / 10_000n;
        if (balance < maxInput) throw new Error("Insufficient native balance for this buy and gas.");
        const hash = await write.writeContractAsync({ address: pair, abi: pumpPairAbi, functionName: "buy", args: [tokenAmount, maxInput], value: maxInput, chainId: pumpNowChain.id });
        setFinalHash(hash);
      } else {
        const balance = await publicClient.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [walletAddress!] });
        if (balance < tokenAmount) throw new Error("Insufficient token balance.");
        setPhase("approving");
        const allowance = await publicClient.readContract({ address: token, abi: erc20Abi, functionName: "allowance", args: [walletAddress!, pair] });
        if (allowance < tokenAmount) {
          const approvalHash = await write.writeContractAsync({ address: token, abi: erc20Abi, functionName: "approve", args: [pair, tokenAmount], chainId: pumpNowChain.id });
          const approvalReceipt = await publicClient.waitForTransactionReceipt({ hash: approvalHash });
          if (approvalReceipt.status !== "success") throw new Error("Token approval failed.");
        }
        setPhase("selling");
        const quote = await publicClient.readContract({ address: pair, abi: pumpPairAbi, functionName: "quoteSell", args: [tokenAmount] });
        const minOutput = quote[2] - (quote[2] * BigInt(slippageBps)) / 10_000n;
        const hash = await write.writeContractAsync({ address: pair, abi: pumpPairAbi, functionName: "sell", args: [tokenAmount, minOutput], chainId: pumpNowChain.id });
        setFinalHash(hash);
      }
    } catch (caught) {
      setPhase("idle");
      setError(caught instanceof Error ? caught.message.split("\n")[0] : "Transaction failed");
    }
  }

  const pending = (phase !== "idle" && !receipt.isSuccess) || receipt.isLoading;
  const button = !isConnected ? "Connect wallet first" : chainId !== pumpNowChain.id ? "Switch network" : phase === "approving" ? "Approving token…" : phase === "selling" ? "Confirm sell…" : phase === "buying" ? "Confirm buy…" : side === "buy" ? "Buy token" : "Approve & sell";
  return <aside className="panel trade-panel"><span className="kicker">TRADE</span><h2>{disabled ? "Trading closed" : "Buy or sell"}</h2><p>{disabled ? "This token graduated to its DEX pool. Bonding-curve buy and sell are permanently disabled." : "Quotes prepare the transaction; displayed market data comes from the API."}</p><div className="trade-tabs"><button type="button" className={side === "buy" ? "active" : ""} onClick={() => setSide("buy")}>Buy</button><button type="button" className={side === "sell" ? "active" : ""} onClick={() => setSide("sell")}>Sell</button></div><label>Token amount<input inputMode="decimal" placeholder="0.00" value={amount} onChange={(event) => setAmount(event.target.value)} /></label><label>Slippage<select value={slippageBps} onChange={(event) => setSlippageBps(Number(event.target.value))}><option value={50}>0.5%</option><option value={100}>1%</option><option value={300}>3%</option></select></label><button className="primary-button" type="button" disabled={disabled || pending || !validAddresses} onClick={() => void trade()}>{disabled ? "Graduated" : button}</button><TransactionStatus hash={finalHash} pending={pending} label={receipt.isSuccess ? "Confirmed. Refreshing indexed API data." : undefined} error={error ?? (receipt.error?.message.split("\n")[0])} /></aside>;
}
