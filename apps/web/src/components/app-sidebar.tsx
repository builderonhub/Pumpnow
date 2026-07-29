"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Home", icon: "◆" },
  { href: "/search", label: "Explore", icon: "⌕" },
  { href: "/dex", label: "DEX", icon: "⇄" },
  { href: "/launch", label: "Create", icon: "+" },
  { href: "/portfolio", label: "Portfolio", icon: "◎" },
  { href: "/status", label: "Network status", icon: "●" },
];

export function AppSidebar() {
  const pathname = usePathname();
  const feedbackUrl = process.env.NEXT_PUBLIC_FEEDBACK_URL;
  const activeHref = pathname.startsWith("/token/") ? "/search" : pathname;

  return <aside className="app-sidebar"><Link href="/" className="brand"><span className="brand-mark">P</span><span>PumpNow</span><small>BETA</small></Link><nav aria-label="Primary navigation">{links.map((link) => <Link href={link.href} key={link.href} className={activeHref === link.href ? "active" : undefined} aria-current={activeHref === link.href ? "page" : undefined}><span aria-hidden="true">{link.icon}</span>{link.label}</Link>)}</nav><div className="sidebar-foot"><div className="network-card"><span><i /> Arc Testnet</span><small>Community launchpad beta</small></div>{feedbackUrl ? <a href={feedbackUrl} target="_blank" rel="noreferrer">Send feedback ↗</a> : null}<p>Built for the Arc community.</p></div></aside>;
}
