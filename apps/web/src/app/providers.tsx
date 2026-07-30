"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, fallback, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { useState, type ReactNode } from "react";
import { pumpNowChain } from "@/lib/contracts";
import { RealtimeSync } from "@/components/realtime-sync";

const wagmiConfig = createConfig({
  chains: [pumpNowChain],
  connectors: [injected()],
  transports: {
    [pumpNowChain.id]: fallback(
      [http("/api/rpc", { retryCount: 3, retryDelay: 500 }), ...pumpNowChain.rpcUrls.default.http.map((url) => http(url, { retryCount: 3, retryDelay: 500 }))],
      { rank: true },
    ),
  },
  ssr: true,
});

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, gcTime: 10 * 60_000, retry: 2, retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 8_000), refetchOnWindowFocus: false, refetchOnReconnect: true } } }));
  return <WagmiProvider config={wagmiConfig}><QueryClientProvider client={queryClient}><RealtimeSync />{children}</QueryClientProvider></WagmiProvider>;
}
