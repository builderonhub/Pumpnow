"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { useState, type ReactNode } from "react";
import { pumpNowChain } from "@/lib/contracts";
import { RealtimeSync } from "@/components/realtime-sync";

const wagmiConfig = createConfig({ chains: [pumpNowChain], connectors: [injected()], transports: { [pumpNowChain.id]: http(pumpNowChain.rpcUrls.default.http[0]) }, ssr: true });

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: false } } }));
  return <WagmiProvider config={wagmiConfig}><QueryClientProvider client={queryClient}><RealtimeSync />{children}</QueryClientProvider></WagmiProvider>;
}
