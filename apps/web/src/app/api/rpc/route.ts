import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const allowedMethods = new Set([
  "eth_blockNumber",
  "eth_call",
  "eth_chainId",
  "eth_estimateGas",
  "eth_feeHistory",
  "eth_gasPrice",
  "eth_getBalance",
  "eth_getBlockByNumber",
  "eth_getCode",
  "eth_getTransactionByHash",
  "eth_getTransactionCount",
  "eth_getTransactionReceipt",
  "eth_maxPriorityFeePerGas",
]);

export async function POST(request: NextRequest) {
  let payload: { method?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON-RPC request" }, { status: 400 });
  }
  if (!payload.method || !allowedMethods.has(payload.method)) {
    return NextResponse.json({ error: "JSON-RPC method is not allowed" }, { status: 403 });
  }

  const upstream = process.env.NEXT_PUBLIC_RPC_URLS?.split(",")[0]?.trim() || process.env.NEXT_PUBLIC_RPC_URL;
  if (!upstream) return NextResponse.json({ error: "RPC upstream is unavailable" }, { status: 503 });

  let lastStatus = 502;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(upstream, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      });
      lastStatus = response.status;
      if (response.ok) {
        return new NextResponse(await response.text(), {
          status: 200,
          headers: { "content-type": "application/json", "cache-control": "no-store" },
        });
      }
    } catch {
      lastStatus = 502;
    }
  }
  return NextResponse.json({ error: "RPC upstream failed after retries" }, { status: lastStatus });
}
