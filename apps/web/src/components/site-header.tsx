import Link from "next/link";
import { WalletButton } from "./wallet-button";

export function SiteHeader() {
  return <header className="site-header"><div className="shell nav"><Link href="/" className="brand"><span className="brand-mark">P</span>PumpNow</Link><nav className="nav-links" aria-label="Primary"><Link href="/search">Explore</Link><Link href="/portfolio">Portfolio</Link><Link href="/launch">Launch</Link></nav><WalletButton /></div></header>;
}
