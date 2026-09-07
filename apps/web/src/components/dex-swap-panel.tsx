"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import {
  formatUnits,
  isAddress,
  parseUnits,
  type Address,
  type Hash,
} from "viem";
import {
  useAccount,
  useBalance,
  usePublicClient,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import {
  arcTestnet,
  opnTestnet,
  erc20Abi,
  pumpDexPoolAbi,
} from "@/lib/contracts";
import { TransactionStatus } from "./transaction-status";

type Side = "native-to-token" | "token-to-native";

export function DexSwapPanel({
  tokenAddress,
  poolAddress,
  decimals,
}: {
  tokenAddress: string;
  poolAddress: string;
  decimals: number;
}) {
  const [side, setSide] = useState<Side>("native-to-token");
  const [amount, setAmount] = useState("");
  const [slippageBps, setSlippageBps] = useState(100);
  const [error, setError] = useState<string>();
  const [quote, setQuote] = useState<string>();
  const [hash, setHash] = useState<Hash>();
  const [maxLoading, setMaxLoading] = useState(false);
  const [quoteLoading, setQuoteLoading] = useState(false);

  const { address, isConnected, chainId } = useAccount();
  const { switchChain } = useSwitchChain();
  const write = useWriteContract();
  const queryClient = useQueryClient();

  const currentChain =
    chainId === arcTestnet.id
      ? arcTestnet
      : chainId === opnTestnet.id
        ? opnTestnet
        : undefined;

  const supportedChain = Boolean(currentChain);

  const nativeBalance = useBalance({
    address,
    chainId: currentChain?.id ?? arcTestnet.id,
    query: {
      enabled: Boolean(address && currentChain),
    },
  });

  const publicClient = usePublicClient({
    chainId: currentChain?.id ?? arcTestnet.id,
  });

  const receipt = useWaitForTransactionReceipt({ hash });

  const valid =
    isAddress(tokenAddress) && isAddress(poolAddress);

  const nativeSymbol =
    currentChain?.nativeCurrency.symbol ?? "TOKEN";

  useEffect(() => {
    if (
      !publicClient ||
      !valid ||
      !amount.trim() ||
      !supportedChain
    ) {
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

          const output =
            await publicClient.readContract({
              address: pool,
              abi: pumpDexPoolAbi,
              functionName: "quoteNativeForToken",
              args: [input],
            });

          if (!cancelled) {
            setQuote(
              `≈ ${Number(
                formatUnits(output, decimals),
              ).toLocaleString(undefined, {
                maximumFractionDigits: 6,
              })} TOKEN`,
            );
          }
        } else {
          const input = parseUnits(
            amount,
            decimals,
          );

          if (input <= 0n) return;

          const output =
            await publicClient.readContract({
              address: pool,
              abi: pumpDexPoolAbi,
              functionName: "quoteTokenForNative",
              args: [input],
            });

          if (!cancelled) {
            setQuote(
              `≈ ${Number(
                formatUnits(output, 18),
              ).toLocaleString(undefined, {
                maximumFractionDigits: 6,
              })} ${nativeSymbol}`,
            );
          }
        }
      } catch {
        if (!cancelled) {
          setQuote(undefined);
        }
      } finally {
        if (!cancelled) {
          setQuoteLoading(false);
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    amount,
    decimals,
    nativeSymbol,
    poolAddress,
    publicClient,
    side,
    supportedChain,
    valid,
  ]);

  async function setMaximum(): Promise<void> {
    setError(undefined);
    setQuote(undefined);

    if (!isConnected || !address) {
      setError("Connect your wallet first.");
      return;
    }

    if (!currentChain) {
      setError(
        "Switch to Arc Testnet or OPN Testnet.",
      );
      return;
    }

    if (!publicClient || !valid) {
      setError("DEX pool address is unavailable.");
      return;
    }

    setMaxLoading(true);

    try {
      if (side === "native-to-token") {
        const balance =
          await publicClient.getBalance({
            address,
          });

        const spendable =
          balance - balance / 100n;

        if (spendable <= 0n) {
          throw new Error(
            `Insufficient ${nativeSymbol} balance after reserving gas.`,
          );
        }

        setAmount(
          formatUnits(spendable, 18),
        );
      } else {
        const balance =
          await publicClient.readContract({
            address: tokenAddress as Address,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [address],
          });

        setAmount(
          formatUnits(balance, decimals),
        );
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message.split("\n")[0]
          : "Unable to read wallet balance.",
      );
    } finally {
      setMaxLoading(false);
    }
  }

  async function swap(): Promise<void> {
    setError(undefined);
    setQuote(undefined);
    setHash(undefined);

    if (!isConnected || !address) {
      setError("Connect your wallet first.");
      return;
    }

    if (!currentChain) {
      setError(
        "Switch to Arc Testnet or OPN Testnet.",
      );
      return;
    }

    if (!publicClient || !valid) {
      setError("DEX pool address is unavailable.");
      return;
    }

    const pool = poolAddress as Address;
    const token = tokenAddress as Address;

    try {
      if (side === "native-to-token") {
        const input = parseUnits(
          amount,
          18,
        );

        if (input <= 0n) {
          throw new Error(
            "Enter a positive amount.",
          );
        }

        const balance =
          await publicClient.getBalance({
            address,
          });

        if (balance <= input) {
          throw new Error(
            `Insufficient ${nativeSymbol} balance. Keep a small amount for gas.`,
          );
        }

        const output =
          await publicClient.readContract({
            address: pool,
            abi: pumpDexPoolAbi,
            functionName:
              "quoteNativeForToken",
            args: [input],
          });

        if (output <= 0n) {
          throw new Error(
            "This amount cannot be quoted by the DEX pool.",
          );
        }

        const minOutput =
          output -
          (output * BigInt(slippageBps)) /
            10_000n;

        setQuote(
          `${formatUnits(
            output,
            decimals,
          )} tokens`,
        );

        const simulation =
          await publicClient.simulateContract({
            account: address,
            address: pool,
            abi: pumpDexPoolAbi,
            functionName:
              "swapNativeForToken",
            args: [
              minOutput,
              address,
            ],
            value: input,
          });

        const txHash =
          await write.writeContractAsync({
            ...simulation.request,
            chainId: currentChain.id,
          });

        setHash(txHash);
      } else {
        const input = parseUnits(
          amount,
          decimals,
        );

        if (input <= 0n) {
          throw new Error(
            "Enter a positive amount.",
          );
        }

        const balance =
          await publicClient.readContract({
            address: token,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [address],
          });

        if (balance < input) {
          throw new Error(
            "Insufficient token balance.",
          );
        }

        const output =
          await publicClient.readContract({
            address: pool,
            abi: pumpDexPoolAbi,
            functionName:
              "quoteTokenForNative",
            args: [input],
          });

        if (output <= 0n) {
          throw new Error(
            "This amount cannot be quoted by the DEX pool.",
          );
        }

        const minOutput =
          output -
          (output * BigInt(slippageBps)) /
            10_000n;

        setQuote(
          `${formatUnits(
            output,
            18,
          )} ${nativeSymbol}`,
        );

        const allowance =
          await publicClient.readContract({
            address: token,
            abi: erc20Abi,
            functionName: "allowance",
            args: [address, pool],
          });

        if (allowance < input) {
          const approval =
            await write.writeContractAsync({
              address: token,
              abi: erc20Abi,
              functionName: "approve",
              args: [pool, input],
              chainId: currentChain.id,
            });

          const approvalReceipt =
            await publicClient.waitForTransactionReceipt(
              {
                hash: approval,
              },
            );

          if (
            approvalReceipt.status !==
            "success"
          ) {
            throw new Error(
              "Token approval failed.",
            );
          }
        }

        const simulation =
          await publicClient.simulateContract({
            account: address,
            address: pool,
            abi: pumpDexPoolAbi,
            functionName:
              "swapTokenForNative",
            args: [
              input,
              minOutput,
              address,
            ],
          });

          const txHash =
            await write.writeContractAsync({
              ...simulation.request,
              chainId: currentChain.id,
            });

        setHash(txHash);
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message.split("\n")[0]
          : "Swap failed.",
      );
    }
  }

  useEffect(() => {
    if (!receipt.isSuccess) {
      return;
    }

    void Promise.all([
      queryClient.invalidateQueries({
        queryKey: [
          "token",
          tokenAddress.toLowerCase(),
        ],
      }),
      queryClient.invalidateQueries({
        queryKey: [
          "trades",
          tokenAddress.toLowerCase(),
        ],
      }),
      queryClient.invalidateQueries({
        queryKey: [
          "holders",
          tokenAddress.toLowerCase(),
        ],
      }),
      queryClient.invalidateQueries({
        queryKey: [
          "candles",
          tokenAddress.toLowerCase(),
        ],
      }),
      queryClient.invalidateQueries({
        queryKey: ["stats"],
      }),
    ]);
  }, [
    queryClient,
    receipt.isSuccess,
    tokenAddress,
  ]);

  const pending =
    write.isPending || receipt.isLoading;

  return (
    <aside className="panel trade-panel dex-swap-panel">
      <div className="dex-panel-heading">
        <span className="kicker">
          PUMPNOW DEX
        </span>

        <span className="dex-live">
          LIVE MARKET
        </span>
      </div>

      <h2>Swap graduated token</h2>

      <p>
        The bonding curve is complete. This
        token now trades against {nativeSymbol}{" "}
        in its permanent PumpNow DEX pool.
      </p>

      <div className="trade-tabs">
        <button
          type="button"
          className={
            side === "native-to-token"
              ? "active"
              : ""
          }
          onClick={() => {
            setSide("native-to-token");
            setAmount("");
            setError(undefined);
            setQuote(undefined);
          }}
        >
          Buy
        </button>

        <button
          type="button"
          className={
            side === "token-to-native"
              ? "active"
              : ""
          }
          onClick={() => {
            setSide("token-to-native");
            setAmount("");
            setError(undefined);
            setQuote(undefined);
          }}
        >
          Sell
        </button>
      </div>

      <label>
        <span className="amount-label">
          <span>
            {side === "native-to-token"
              ? `${nativeSymbol} amount to spend`
              : "Token amount to sell"}{" "}
            <b>
              {side === "native-to-token"
                ? nativeSymbol
                : "TOKEN"}
            </b>
          </span>

          <button
            type="button"
            disabled={
              maxLoading ||
              !supportedChain
            }
            onClick={() =>
              void setMaximum()
            }
          >
            {maxLoading ? "…" : "MAX"}
          </button>
        </span>

        <input
          inputMode="decimal"
          value={amount}
          onChange={(event) => {
            setAmount(event.target.value);
            setError(undefined);
            setQuote(undefined);
          }}
          placeholder={
            side === "native-to-token"
              ? `Enter ${nativeSymbol} amount`
              : "Enter token quantity"
          }
        />

        {side === "native-to-token" &&
        nativeBalance.data ? (
          <small className="balance-hint">
            Available:{" "}
            {Number(
              formatUnits(
                nativeBalance.data.value,
                nativeBalance.data.decimals,
              ),
            ).toLocaleString(
              undefined,
              {
                maximumFractionDigits: 6,
              },
            )}{" "}
            {nativeBalance.data.symbol}
          </small>
        ) : null}
      </label>

      {amount.trim() ? (
        <div
          className={`live-quote${
            quoteLoading
              ? " loading"
              : ""
          }`}
          aria-live="polite"
        >
          <span>You receive</span>

          <strong>
            {quoteLoading
              ? "Calculating…"
              : quote ?? "Quote unavailable"}
          </strong>

          <small>
            Estimated from the current DEX pool
            reserves
          </small>
        </div>
      ) : null}

      <label>
        Slippage

        <select
          value={slippageBps}
          onChange={(event) =>
            setSlippageBps(
              Number(
                event.target.value,
              ),
            )
          }
        >
          <option value={50}>
            0.5%
          </option>
          <option value={100}>
            1%
          </option>
          <option value={300}>
            3%
          </option>
        </select>
      </label>

      {error ? (
        <p
          className="swap-error"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <button
        className="primary-button"
        type="button"
        disabled={
          !valid ||
          pending ||
          !supportedChain
        }
        onClick={() =>
          void swap()
        }
      >
        {!isConnected
          ? "Connect wallet first"
          : !supportedChain
            ? "Switch network"
            : pending
              ? "Confirming swap…"
              : side ===
                  "native-to-token"
                ? "Buy on DEX"
                : "Sell on DEX"}
      </button>

      {!supportedChain && isConnected ? (
        <div className="field-row">
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              switchChain({
                chainId:
                  arcTestnet.id,
              })
            }
          >
            Switch to Arc
          </button>

          <button
            type="button"
            disabled={pending}
            onClick={() =>
              switchChain({
                chainId:
                  opnTestnet.id,
              })
            }
          >
            Switch to OPN
          </button>
        </div>
      ) : null}

      <Link
        className="dex-market-link"
        href="/dex"
      >
        View all DEX markets →
      </Link>

      <TransactionStatus
        hash={hash}
        pending={pending}
        label={
          receipt.isSuccess
            ? "Swap confirmed. Waiting for indexed market data."
            : undefined
        }
        error={
          receipt.error?.message.split(
            "\n",
          )[0]
        }
      />
    </aside>
  );
}
