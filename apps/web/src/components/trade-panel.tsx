"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { formatUnits, isAddress, maxUint256, parseUnits, type Address, type Hash } from "viem";
import { useAccount, useChainId, usePublicClient, useSwitchChain, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { erc20Abi, pumpNowChain, pumpPairAbi } from "@/lib/contracts";
import { TransactionStatus } from "@/components/transaction-status";
import { api } from "@/lib/api";

type Phase = "idle" | "approving" | "selling" | "buying";
type LiveQuote = { amount: string; fee: string };

function displayUnits(value: bigint, decimals = 18): string {
  const number = Number(formatUnits(value, decimals));
  return Number.isFinite(number)
    ? number.toLocaleString(undefined, { maximumFractionDigits: 6 })
    : formatUnits(value, decimals);
}

export function TradePanel({ tokenAddress, pairAddress, decimals, disabled = false }: { tokenAddress: string; pairAddress?: string; decimals: number; disabled?: boolean }) {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string>();
  const [finalHash, setFinalHash] = useState<Hash>();
  const [approvalHash, setApprovalHash] = useState<Hash>();
  const [approvalConfirmed, setApprovalConfirmed] = useState(false);
  const [slippageBps, setSlippageBps] = useState(100);
  const [maxLoading, setMaxLoading] = useState(false);
  const [liveQuote, setLiveQuote] = useState<LiveQuote>();
  const [quoteLoading, setQuoteLoading] = useState(false);
  const { address: walletAddress, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const publicClient = usePublicClient({ chainId: pumpNowChain.id });
  const queryClient = useQueryClient();
  const write = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash: finalHash });
  const validAddresses = isAddress(tokenAddress) && Boolean(pairAddress && isAddress(pairAddress));

  useEffect(() => {
    if (side !== "sell" || !publicClient || !walletAddress || !pairAddress || !isAddress(pairAddress) || !amount.trim()) {
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const tokenAmount = parseUnits(amount, decimals);
        const allowance = await publicClient.readContract({ address: tokenAddress as Address, abi: erc20Abi, functionName: "allowance", args: [walletAddress, pairAddress as Address] });
        if (!cancelled) setApprovalConfirmed(allowance >= tokenAmount);
      } catch {
        if (!cancelled) setApprovalConfirmed(false);
      }
    }, 250);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [amount, decimals, pairAddress, publicClient, side, tokenAddress, walletAddress]);

  useEffect(() => {
    if (!publicClient || !pairAddress || !isAddress(pairAddress) || !amount.trim()) {
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const inputAmount = parseUnits(amount, side === "buy" ? 18 : decimals);
        if (inputAmount <= 0n) return;
        setQuoteLoading(true);
        const quote = await publicClient.readContract({
          address: pairAddress as Address,
          abi: pumpPairAbi,
          functionName: side === "buy" ? "quoteBuyExactNative" : "quoteSell",
          args: [inputAmount],
        });
        if (!cancelled) {
          setLiveQuote({
            amount: displayUnits(side === "buy" ? quote[0] : quote[2], side === "buy" ? decimals : 18),
            fee: displayUnits(quote[1], 18),
          });
        }
      } catch {
        if (!cancelled) setLiveQuote(undefined);
      } finally {
        if (!cancelled) setQuoteLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [amount, decimals, pairAddress, publicClient, side]);

  async function setMaximum(): Promise<void> {
    setError(undefined); setLiveQuote(undefined); setApprovalConfirmed(false);
    if (!isConnected || !walletAddress) return setError("Connect your wallet first.");
    if (chainId !== pumpNowChain.id) { switchChain({ chainId: pumpNowChain.id }); return; }
    if (!publicClient || !validAddresses || !pairAddress) return setError("Contract addresses are unavailable or invalid.");
    setMaxLoading(true);
    const token = tokenAddress as Address;
    try {
      if (side === "sell") {
        const balance = await publicClient.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [walletAddress] });
        // Legacy pairs can round a full unwind one wei above their real native
        // reserve. Leaving one indivisible token unit avoids that revert while
        // being economically identical to selling the full wallet balance.
        const safeMaximum = balance > 1n ? balance - 1n : balance;
        setAmount(formatUnits(safeMaximum, decimals));
        return;
      }

      const nativeBalance = await publicClient.getBalance({ address: walletAddress });
      const spendable = nativeBalance - nativeBalance / 100n;
      if (spendable === 0n) throw new Error(`Insufficient ${pumpNowChain.nativeCurrency.symbol} balance.`);
      setAmount(formatUnits(spendable, 18));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message.split("\n")[0] : "Unable to calculate maximum amount.");
    } finally {
      setMaxLoading(false);
    }
  }

  useEffect(() => {
    if (!receipt.isSuccess || !finalHash) return;
    let cancelled = false;
    const address = tokenAddress.toLowerCase();
    const refresh = () => Promise.all([
      queryClient.refetchQueries({ queryKey: ["token", address], type: "active" }),
      queryClient.refetchQueries({ queryKey: ["trades", address], type: "active" }),
      queryClient.refetchQueries({ queryKey: ["holders", address], type: "active" }),
      queryClient.invalidateQueries({ queryKey: ["tokens"] }),
      queryClient.invalidateQueries({ queryKey: ["stats"] }),
      queryClient.invalidateQueries({ queryKey: ["portfolio"] }),
    ]);
    void (async () => {
      await refresh();
      for (let attempt = 0; attempt < 30 && !cancelled; attempt += 1) {
        try {
          const indexedTrades = await api.trades(address);
          const indexed = indexedTrades.data.some(
            (trade) => trade.transactionHash.toLowerCase() === finalHash.toLowerCase(),
          );
          if (indexed) {
            await refresh();
            return;
          }
        } catch {
          // Keep polling while the API/indexer catches up with the confirmed block.
        }
        await new Promise((resolve) => window.setTimeout(resolve, 1_000));
      }
      if (!cancelled) await refresh();
    })();
    return () => { cancelled = true; };
  }, [finalHash, queryClient, receipt.isSuccess, tokenAddress]);

  async function trade(): Promise<void> {
    setError(undefined); setFinalHash(undefined);
    if (!isConnected || !walletAddress) return setError("Connect your wallet first.");
    if (disabled) return setError("Trading is closed because this token has graduated.");
    if (chainId !== pumpNowChain.id) { switchChain({ chainId: pumpNowChain.id }); return; }
    if (!publicClient || !validAddresses || !pairAddress) return setError("Contract addresses are unavailable or invalid.");
    let inputAmount: bigint;
    try { inputAmount = parseUnits(amount, side === "buy" ? 18 : decimals); if (inputAmount <= 0n) throw new Error(); } catch { return setError(side === "buy" ? "Enter a valid USDC amount." : "Enter a valid token amount."); }
    const pair = pairAddress as Address;
    const token = tokenAddress as Address;
    try {
      if (side === "buy") {
        setPhase("buying");
        const quote = await publicClient.readContract({ address: pair, abi: pumpPairAbi, functionName: "quoteBuyExactNative", args: [inputAmount] });
        const balance = await publicClient.getBalance({ address: walletAddress! });
        if (balance < inputAmount) throw new Error("Insufficient native balance for this buy and gas.");
        const minTokenOutput = quote[0] - (quote[0] * BigInt(slippageBps)) / 10_000n;
        const hash = await write.writeContractAsync({ address: pair, abi: pumpPairAbi, functionName: "buyExactNative", args: [minTokenOutput], value: inputAmount, chainId: pumpNowChain.id });
        setFinalHash(hash);
      } else {
        const balance = await publicClient.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [walletAddress!] });
        const tokenAmount = inputAmount;
        if (balance < tokenAmount) throw new Error("Insufficient token balance.");
        setPhase("approving");
        const allowance = await publicClient.readContract({ address: token, abi: erc20Abi, functionName: "allowance", args: [walletAddress!, pair] });
        if (allowance < tokenAmount) {
          const approvalHash = await write.writeContractAsync({ address: token, abi: erc20Abi, functionName: "approve", args: [pair, maxUint256], chainId: pumpNowChain.id, gas: 150_000n });
          setApprovalHash(approvalHash);
          try {
            const approvalReceipt = await publicClient.waitForTransactionReceipt({ hash: approvalHash, confirmations: 1, pollingInterval: 1_500, timeout: 120_000 });
            if (approvalReceipt.status !== "success") throw new Error("Token approval failed.");
          } catch (receiptError) {
            // Arc's public RPC can lose a receipt response after a successful transaction.
            // The onchain allowance is the authoritative result for an ERC-20 approval.
            let confirmedAllowance = 0n;
            for (let attempt = 0; attempt < 10 && confirmedAllowance < tokenAmount; attempt += 1) {
              await new Promise((resolve) => window.setTimeout(resolve, 1_500));
              try {
                confirmedAllowance = await publicClient.readContract({ address: token, abi: erc20Abi, functionName: "allowance", args: [walletAddress!, pair] });
              } catch {
                // Retry while the public RPC recovers.
              }
            }
            if (confirmedAllowance < tokenAmount) throw receiptError;
          }
          setError(undefined);
          setApprovalConfirmed(true);
          setPhase("idle");
          return;
        }
        setApprovalConfirmed(false);
        setPhase("selling");
        const quote = await publicClient.readContract({ address: pair, abi: pumpPairAbi, functionName: "quoteSell", args: [tokenAmount] });
        const minOutput = quote[2] - (quote[2] * BigInt(slippageBps)) / 10_000n;
        const hash = await write.writeContractAsync({ address: pair, abi: pumpPairAbi, functionName: "sell", args: [tokenAmount, minOutput], chainId: pumpNowChain.id, gas: 500_000n });
        setFinalHash(hash);
      }
    } catch (caught) {
      setPhase("idle");
      setError(caught instanceof Error ? caught.message.split("\n")[0] : "Transaction failed");
    }
  }

  const pending = (phase !== "idle" && !receipt.isSuccess) || receipt.isLoading;
  const displayPhase = receipt.isSuccess ? "idle" : phase;
  const button = !isConnected ? "Connect wallet first" : chainId !== pumpNowChain.id ? "Switch network" : displayPhase === "approving" ? "Approving token…" : displayPhase === "selling" ? "Confirm sell…" : displayPhase === "buying" ? "Confirm buy…" : side === "buy" ? "Buy token" : approvalConfirmed ? "Sell token now" : "Approve token";
  return <aside className="panel trade-panel"><span className="kicker">TRADE</span><h2>{disabled ? "Trading closed" : "Buy or sell"}</h2><p>{disabled ? "This token graduated to its DEX pool. Bonding-curve buy and sell are permanently disabled." : side === "buy" ? `Enter how much ${pumpNowChain.nativeCurrency.symbol} to spend. The curve calculates the token output.` : `Enter the token quantity to sell. First approve the pair, then confirm the sell transaction.`}</p><div className="trade-tabs"><button type="button" className={side === "buy" ? "active" : ""} onClick={() => { setSide("buy"); setAmount(""); setLiveQuote(undefined); setError(undefined); setApprovalConfirmed(false); }}>Buy</button><button type="button" className={side === "sell" ? "active" : ""} onClick={() => { setSide("sell"); setAmount(""); setLiveQuote(undefined); setError(undefined); setApprovalConfirmed(false); }}>Sell</button></div><label><span className="amount-label"><span>{side === "buy" ? "Amount to spend" : "Token amount to sell"} <b>{side === "buy" ? pumpNowChain.nativeCurrency.symbol : "TOKEN"}</b></span><button type="button" disabled={disabled || maxLoading} onClick={() => void setMaximum()}>{maxLoading ? "…" : "MAX"}</button></span><input inputMode="decimal" placeholder={side === "buy" ? `Enter ${pumpNowChain.nativeCurrency.symbol} amount` : "Enter token quantity"} value={amount} onChange={(event) => { setAmount(event.target.value); setLiveQuote(undefined); setApprovalConfirmed(false); }} /></label>{amount.trim() ? <div className={`live-quote${quoteLoading ? " loading" : ""}`} aria-live="polite"><span>You receive</span><strong>{quoteLoading ? "Calculating…" : liveQuote ? `≈ ${liveQuote.amount} ${side === "buy" ? "TOKEN" : pumpNowChain.nativeCurrency.symbol}` : "Quote unavailable"}</strong>{liveQuote ? <small>{side === "buy" ? "Fee" : "After deducting fee"}: {liveQuote.fee} {pumpNowChain.nativeCurrency.symbol}</small> : null}</div> : null}{approvalConfirmed ? <div className="approval-ready"><b>Token approved.</b><span>Click “Sell token now” to complete the sale.</span></div> : null}<label>Slippage<select value={slippageBps} onChange={(event) => setSlippageBps(Number(event.target.value))}><option value={50}>0.5%</option><option value={100}>1%</option><option value={300}>3%</option></select></label><button className="primary-button" type="button" disabled={disabled || pending || !validAddresses} onClick={() => void trade()}>{disabled ? "Graduated" : button}</button><TransactionStatus hash={finalHash ?? approvalHash} pending={pending} label={approvalConfirmed ? "Approval confirmed." : receipt.isSuccess ? "Confirmed. Refreshing indexed API data." : undefined} error={error ?? (receipt.error?.message.split("\n")[0])} /></aside>;
}
