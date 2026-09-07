"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { decodeEventLog, parseUnits, type Address, type Hash } from "viem";
import {
  useAccount,
  usePublicClient,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import {
  arcTestnet,
  opnTestnet,
  getPumpFactoryAddress,
  pumpFactoryAbi,
} from "@/lib/contracts";
import { TransactionStatus } from "@/components/transaction-status";
import { api } from "@/lib/api";


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
  const [transactionHash, setTransactionHash] = useState<Hash>();
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [launchedToken, setLaunchedToken] = useState<Address>();
  const [indexed, setIndexed] = useState(false);

  const { isConnected, chainId } = useAccount();
  const { switchChain, isPending: switching } = useSwitchChain();
  const queryClient = useQueryClient();

  const currentChain =
    chainId === arcTestnet.id
      ? arcTestnet
      : chainId === opnTestnet.id
        ? opnTestnet
        : undefined;

  const factoryAddress = chainId
  ? getPumpFactoryAddress(chainId)
  : undefined;

  const publicClient = usePublicClient({
    chainId:
      currentChain?.id ??
      arcTestnet.id,
  });

  const write = useWriteContract();

  useEffect(() => {
    if (confirmed) {
      void queryClient.invalidateQueries({ queryKey: ["tokens"] });
    }
  }, [confirmed, queryClient]);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (!isConnected) {
      setValidationError("Connect your wallet first.");
      return;
    }

    if (!currentChain || !factoryAddress) {
      setValidationError("Please switch to Arc Testnet or OPN Testnet.");
      return;
    }

    setValidationError(undefined);
    setConfirmed(false);
    setTransactionHash(undefined);
    setLaunchedToken(undefined);
    setIndexed(false);

    if (!name.trim()) {
      setValidationError("Name is required.");
      return;
    }

    if (!/^[A-Za-z0-9]{1,20}$/.test(symbol.trim())) {
      setValidationError(
        "Symbol must contain 1–20 letters or numbers.",
      );
      return;
    }

    const optionalUrls = [
      imageUrl,
      websiteUrl,
      xUrl,
      telegramUrl,
    ].filter(Boolean);

    if (description.trim().length > 1000) {
      setValidationError(
        "Description must be 1,000 characters or fewer.",
      );
      return;
    }

    try {
      optionalUrls.forEach((value) => {
        const url = new URL(value);

        if (url.protocol !== "https:") {
          throw new Error();
        }
      });
    } catch {
      setValidationError(
        "All supplied URLs must be valid HTTPS URLs.",
      );
      return;
    }

    let initialSupply: bigint;

    try {
      initialSupply = parseUnits(supply, 18);

      if (initialSupply <= 0n) {
        throw new Error();
      }
    } catch {
      setValidationError(
        "Initial supply must be a positive number.",
      );
      return;
    }

    if (!publicClient) {
      setValidationError(
        `${currentChain.name} RPC is unavailable. Try again in a moment.`,
      );
      return;
    }

    try {
      const hash = await write.writeContractAsync({
        address: factoryAddress,
        abi: pumpFactoryAbi,
        functionName: "createToken",
        args: [
          name.trim(),
          symbol.trim().toUpperCase(),
          initialSupply,
          description.trim(),
          imageUrl.trim(),
          websiteUrl.trim(),
          xUrl.trim(),
          telegramUrl.trim(),
        ],
        chainId: currentChain.id,
      });

      setTransactionHash(hash);
      setConfirming(true);

      const receipt =
        await publicClient.waitForTransactionReceipt({
          hash,
          confirmations: 1,
          pollingInterval: 1_500,
          timeout: 120_000,
        });

      if (receipt.status !== "success") {
        throw new Error(
          "The launch transaction reverted onchain.",
        );
      }

      const created = receipt.logs
        .map((log) => {
          try {
            return decodeEventLog({
              abi: pumpFactoryAbi,
              data: log.data,
              topics: log.topics,
            });
          } catch {
            return undefined;
          }
        })
        .find((log) => log?.eventName === "TokenCreated");

      if (
        !created ||
        created.eventName !== "TokenCreated"
      ) {
        throw new Error(
          "TokenCreated event was not found in the receipt.",
        );
      }

      const tokenAddress = created.args.token;

      setLaunchedToken(tokenAddress);
      setConfirmed(true);

      await queryClient.invalidateQueries({
        queryKey: ["tokens"],
      });

      await queryClient.invalidateQueries({
        queryKey: ["stats"],
      });

      for (let attempt = 0; attempt < 20; attempt += 1) {
        try {
          await api.token(tokenAddress, currentChain.id);

          setIndexed(true);

          await queryClient.invalidateQueries({
            queryKey: [
              "token",
              tokenAddress.toLowerCase(),
              chainId,
            ],
          });

          await queryClient.invalidateQueries({
            queryKey: ["tokens"],
          });

          break;
        } catch {
          await new Promise((resolve) =>
            window.setTimeout(resolve, 1_500),
          );
        }
      }
    } catch (caught) {
      setValidationError(
        caught instanceof Error
          ? caught.message.split("\n")[0]
          : "Token launch failed.",
      );
    } finally {
      setConfirming(false);
    }
  }

  const unsupportedChain =
    isConnected && !currentChain;

  const currentChainName =
    currentChain?.name ?? "supported testnet";

  return (
    <section className="page shell">
      <div className="page-intro">
        <span className="kicker">LAUNCH STUDIO</span>

        <h1>Shape your next token.</h1>

        <p>
          The connected wallet creates the token and its
          bonding-curve pair onchain.
        </p>
      </div>

      <form
        className="launch-form"
        onSubmit={submit}
      >
        <div className="form-grid">
          <label className="logo-field">
            <span>Image URL</span>

            <input
              type="url"
              value={imageUrl}
              onChange={(e) =>
                setImageUrl(e.target.value)
              }
              placeholder="https://…"
            />
          </label>

          <div className="form-fields">
            <div className="field-row">
              <label>
                Name

                <input
                  required
                  minLength={1}
                  maxLength={100}
                  value={name}
                  onChange={(e) =>
                    setName(e.target.value)
                  }
                  placeholder="Arcade Cats"
                />
              </label>

              <label>
                Symbol

                <input
                  required
                  pattern="[A-Za-z0-9]{1,20}"
                  minLength={1}
                  maxLength={20}
                  value={symbol}
                  onChange={(e) =>
                    setSymbol(e.target.value)
                  }
                  placeholder="ARCAT"
                />
              </label>
            </div>

            <label>
              Description

              <textarea
                maxLength={1000}
                value={description}
                onChange={(e) =>
                  setDescription(e.target.value)
                }
              />
            </label>

            <label>
              Initial supply

              <input
                required
                inputMode="decimal"
                value={supply}
                onChange={(e) =>
                  setSupply(e.target.value)
                }
              />
            </label>

            <div className="field-row">
              <label>
                Website

                <input
                  type="url"
                  value={websiteUrl}
                  onChange={(e) =>
                    setWebsiteUrl(e.target.value)
                  }
                />
              </label>

              <label>
                X

                <input
                  type="url"
                  value={xUrl}
                  onChange={(e) =>
                    setXUrl(e.target.value)
                  }
                />
              </label>
            </div>

            <label>
              Telegram

              <input
                type="url"
                value={telegramUrl}
                onChange={(e) =>
                  setTelegramUrl(e.target.value)
                }
              />
            </label>
          </div>
        </div>

        <div className="form-note">
          <span>Onchain</span>

          <p>
            {!isConnected
              ? "Connect your wallet to launch a token."
              : unsupportedChain
                ? "Switch to Arc Testnet or OPN Testnet before launching."
                : `Launching on ${currentChainName}. Your wallet will ask you to confirm the factory transaction.`}
          </p>

          {unsupportedChain ? (
            <div className="field-row">
              <button
                type="button"
                disabled={switching}
                onClick={() =>
                  switchChain({
                    chainId: arcTestnet.id,
                  })
                }
              >
                Switch to Arc
              </button>

              <button
                type="button"
                disabled={switching}
                onClick={() =>
                  switchChain({
                    chainId: opnTestnet.id,
                  })
                }
              >
                Switch to OPN
              </button>
            </div>
          ) : (
            <button
              type="submit"
              disabled={
                !isConnected ||
                write.isPending ||
                confirming
              }
            >
              {!isConnected
                ? "Connect wallet first"
                : write.isPending
                  ? "Confirm in wallet…"
                  : confirming
                    ? "Launching…"
                    : confirmed
                      ? "Launch another token"
                      : `Launch on ${currentChainName}`}
            </button>
          )}
        </div>

        <TransactionStatus
          hash={transactionHash}
          pending={
            write.isPending || confirming
          }
          label={
            confirmed
              ? "Token launch confirmed. Waiting for the indexer to publish it."
              : undefined
          }
          error={
            validationError ??
            messageOf(write.error)
          }
        />

        {launchedToken ? (
          <div className="success-message">
            <b>
              {indexed
                ? "Token is live."
                : "Token created. Indexer is syncing…"}
            </b>

            <Link
              className="primary-button"
              href={`/token/${launchedToken}`}
            >
              Trade token →
            </Link>
          </div>
        ) : null}
      </form>
    </section>
  );
}