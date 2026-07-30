"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { formatUnits, isAddress, parseUnits, type Address, type Hash } from "viem";
import { useAccount, useBalance, useChainId, usePublicClient, useSwitchChain, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { erc20Abi, pumpDexPoolAbi, pumpNowChain } from "@/lib/contracts";
import { TransactionStatus } from "./transaction-status";

type Side = "native-to-token" | "token-to-native";

export function DexSwapPanel({ tokenAddress, poolAddress, decimals }: { tokenAddress: string; poolAddress: string; decimals: number }) {
  const [side, setSide] = useState<Side>("native-to-token");
  const [amount, setAmount] = useState("");
  const [slippageBps, setSlippageBps] = useState(100);
  const [error, setError] = useState<string>();
  const [quote, setQuote] = useState<string>();
  const [hash, setHash] = useState<Hash>();
  const [maxLoading, setMaxLoading] = useState(false);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const { address, isConnected } = useAccount();
  const nativeBalance = useBalance({ address, chainId: pumpNowChain.id, query: { enabled: Boolean(address) } });
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const publicClient = usePublicClient({ chainId: pumpNowChain.id });
  const write = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash });
  const queryClient = useQueryClient();
  const valid = isAddress(tokenAddress) && isAddress(poolAddress);

  useEffect(() => {
    if (!publicClient || !valid || !amount.trim()) {
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        setQuoteLoading(true);
        const pool = poolAddress as Address;
        if (side === "native-to-token") {
          const input = parseUnits(amount, 18);
          if (input <= 0n) return;
          const output = await publicClient.readContract({ address: pool, abi: pumpDexPoolAbi, functionName: "quoteNativeForToken", args: [input] });
          if (!cancelled) setQuote(`≈ ${Number(formatUnits(output, decimals)).toLocaleString(undefined, { maximumFractionDigits: 6 })} TOKEN`);
        } else {
          const input = parseUnits(amount, decimals);
          if (input <= 0n) return;
          const output = await publicClient.readContract({ address: pool, abi: pumpDexPoolAbi, functionName: "quoteTokenForNative", args: [input] });
          if (!cancelled) setQuote(`≈ ${Number(formatUnits(output, 18)).toLocaleString(undefined, { maximumFractionDigits: 6 })} ${pumpNowChain.nativeCurrency.symbol}`);
        }
      } catch {
        if (!cancelled) setQuote(undefined);
      } finally {
        if (!cancelled) setQuoteLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [amount, decimals, poolAddress, publicClient, side, valid]);

  async function setMaximum(): Promise<void> {
    setError(undefined); setQuote(undefined);
    if (!isConnected || !address) return setError("Connect your wallet first.");
    if (chainId !== pumpNowChain.id) return switchChain({ chainId: pumpNowChain.id });
    if (!publicClient || !valid) return setError("DEX pool address is unavailable.");
    setMaxLoading(true);
    try {
      if (side === "native-to-token") {
        const balance = await publicClient.getBalance({ address });
        const spendable = balance - balance / 100n;
        if (spendable <= 0n) throw new Error(`Insufficient ${pumpNowChain.nativeCurrency.symbol} balance after reserving gas.`);
        setAmount(formatUnits(spendable, 18));
      } else {
        const balance = await publicClient.readContract({ address: tokenAddress as Address, abi: erc20Abi, functionName: "balanceOf", args: [address] });
        setAmount(formatUnits(balance, decimals));
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message.split("\n")[0] : "Unable to read wallet balance.");
    } finally {
      setMaxLoading(false);
    }
  }

  async function swap(): Promise<void> {
    setError(undefined); setQuote(undefined); setHash(undefined);
    if (!isConnected || !address) return setError("Connect your wallet first.");
    if (chainId !== pumpNowChain.id) return switchChain({ chainId: pumpNowChain.id });
    if (!publicClient || !valid) return setError("DEX pool address is unavailable.");
    const pool = poolAddress as Address;
    const token = tokenAddress as Address;
    try {
      if (side === "native-to-token") {
        const input = parseUnits(amount, 18);
        if (input <= 0n) throw new Error("Enter a positive amount.");
        const balance = await publicClient.getBalance({ address });
        if (balance <= input) throw new Error(`Insufficient ${pumpNowChain.nativeCurrency.symbol} balance. Keep a small amount for gas.`);
        const output = await publicClient.readContract({ address: pool, abi: pumpDexPoolAbi, functionName: "quoteNativeForToken", args: [input] });
        if (output <= 0n) throw new Error("This amount cannot be quoted by the DEX pool.");
        const minOutput = output - (output * BigInt(slippageBps)) / 10_000n;
        setQuote(`${formatUnits(output, decimals)} tokens`);
        const simulation = await publicClient.simulateContract({ account: address, address: pool, abi: pumpDexPoolAbi, functionName: "swapNativeForToken", args: [minOutput, address], value: input });
        setHash(await write.writeContractAsync(simulation.request));
      } else {
        const input = parseUnits(amount, decimals);
        if (input <= 0n) throw new Error("Enter a positive amount.");
        const balance = await publicClient.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [address] });
        if (balance < input) throw new Error("Insufficient token balance.");
        const output = await publicClient.readContract({ address: pool, abi: pumpDexPoolAbi, functionName: "quoteTokenForNative", args: [input] });
        if (output <= 0n) throw new Error("This amount cannot be quoted by the DEX pool.");
        const minOutput = output - (output * BigInt(slippageBps)) / 10_000n;
        setQuote(`${formatUnits(output, 18)} ${pumpNowChain.nativeCurrency.symbol}`);
        const allowance = await publicClient.readContract({ address: token, abi: erc20Abi, functionName: "allowance", args: [address, pool] });
        if (allowance < input) {
          const approval = await write.writeContractAsync({ address: token, abi: erc20Abi, functionName: "approve", args: [pool, input], chainId: pumpNowChain.id });
          const approvalReceipt = await publicClient.waitForTransactionReceipt({ hash: approval });
          if (approvalReceipt.status !== "success") throw new Error("Token approval failed.");
        }
        const simulation = await publicClient.simulateContract({ account: address, address: pool, abi: pumpDexPoolAbi, functionName: "swapTokenForNative", args: [input, minOutput, address] });
        setHash(await write.writeContractAsync(simulation.request));
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message.split("\n")[0] : "Swap failed.");
    }
  }

  useEffect(() => {
    if (!receipt.isSuccess) return;
    void Promise.all([
      queryClient.invalidateQueries({ queryKey: ["token", tokenAddress.toLowerCase()] }),
      queryClient.invalidateQueries({ queryKey: ["trades", tokenAddress.toLowerCase()] }),
      queryClient.invalidateQueries({ queryKey: ["holders", tokenAddress.toLowerCase()] }),
      queryClient.invalidateQueries({ queryKey: ["candles", tokenAddress.toLowerCase()] }),
      queryClient.invalidateQueries({ queryKey: ["stats"] }),
    ]);
  }, [queryClient, receipt.isSuccess, tokenAddress]);
  const pending = write.isPending || receipt.isLoading;
  return <aside className="panel trade-panel dex-swap-panel"><div className="dex-panel-heading"><span className="kicker">PUMPNOW DEX</span><span className="dex-live">LIVE MARKET</span></div><h2>Swap graduated token</h2><p>The bonding curve is complete. This token now trades against {pumpNowChain.nativeCurrency.symbol} in its permanent PumpNow DEX pool.</p><div className="trade-tabs"><button type="button" className={side === "native-to-token" ? "active" : ""} onClick={() => { setSide("native-to-token"); setAmount(""); setError(undefined); setQuote(undefined); }}>Buy</button><button type="button" className={side === "token-to-native" ? "active" : ""} onClick={() => { setSide("token-to-native"); setAmount(""); setError(undefined); setQuote(undefined); }}>Sell</button></div><label><span className="amount-label"><span>{side === "native-to-token" ? `${pumpNowChain.nativeCurrency.symbol} amount to spend` : "Token amount to sell"} <b>{side === "native-to-token" ? pumpNowChain.nativeCurrency.symbol : "TOKEN"}</b></span><button type="button" disabled={maxLoading} onClick={() => void setMaximum()}>{maxLoading ? "…" : "MAX"}</button></span><input inputMode="decimal" value={amount} onChange={(event) => { setAmount(event.target.value); setError(undefined); setQuote(undefined); }} placeholder={side === "native-to-token" ? `Enter ${pumpNowChain.nativeCurrency.symbol} amount` : "Enter token quantity"} />{side === "native-to-token" && nativeBalance.data ? <small className="balance-hint">Available: {Number(formatUnits(nativeBalance.data.value, nativeBalance.data.decimals)).toLocaleString(undefined, { maximumFractionDigits: 6 })} {nativeBalance.data.symbol}</small> : null}</label>{amount.trim() ? <div className={`live-quote${quoteLoading ? " loading" : ""}`} aria-live="polite"><span>{side === "native-to-token" ? "You receive" : "You receive"}</span><strong>{quoteLoading ? "Calculating…" : quote ?? "Quote unavailable"}</strong><small>Estimated from the current DEX pool reserves</small></div> : null}<label>Slippage<select value={slippageBps} onChange={(event) => setSlippageBps(Number(event.target.value))}><option value={50}>0.5%</option><option value={100}>1%</option><option value={300}>3%</option></select></label>{error ? <p className="swap-error" role="alert">{error}</p> : null}<button className="primary-button" type="button" disabled={!valid || pending} onClick={() => void swap()}>{!isConnected ? "Connect wallet first" : chainId !== pumpNowChain.id ? "Switch network" : pending ? "Confirming swap…" : side === "native-to-token" ? "Buy on DEX" : "Sell on DEX"}</button><Link className="dex-market-link" href="/dex">View all DEX markets →</Link><TransactionStatus hash={hash} pending={pending} label={receipt.isSuccess ? "Swap confirmed. Waiting for indexed market data." : undefined} error={receipt.error?.message.split("\n")[0]} /></aside>;
}
