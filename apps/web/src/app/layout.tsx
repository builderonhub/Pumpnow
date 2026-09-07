import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { SiteHeader } from "@/components/site-header";
import { AppSidebar } from "@/components/app-sidebar";

export const metadata: Metadata = { title: "PumpNow — Launch Your meme", description: "Discover and launch tokens on Arc Testnet and OPN Testnet." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><Providers><div className="app-frame"><AppSidebar /><div className="app-content"><SiteHeader /><main>{children}</main><footer className="footer"><span>PumpNow</span><span>Built on Arc · API-first market data</span></footer></div></div></Providers></body></html>;
}
