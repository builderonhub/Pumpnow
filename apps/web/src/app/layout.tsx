import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = { title: "PumpNow — Launch on Arc", description: "Discover and launch community tokens on Arc." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><Providers><SiteHeader /><main>{children}</main><footer className="footer shell"><span>PumpNow</span><span>Built on Arc · API-first market data</span></footer></Providers></body></html>;
}
