"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon, type IconName } from "./ui-primitives";
import { BrandLogo } from "./brand-logo";


const navigation = [
  ["Command center", "/command-center", "command"],
  ["Payments", "/payments", "payments"],
  ["Recovery", "/recovery", "recovery"],
  ["Evidence", "/evidence", "evidence"],
  ["AI assistant", "/assistant", "activity"],
  ["Lab", "/lab", "flask"],
] as const;

export function OperatorShell({ title, eyebrow, children }: { title: string; eyebrow: string; children: ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => { const shortcut = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); searchRef.current?.focus(); } if (event.key === "Escape") setMobileOpen(false); }; window.addEventListener("keydown", shortcut); return () => window.removeEventListener("keydown", shortcut); }, []);
  const links = navigation.map(([label, href, icon]) => { const active = href === "/payments" ? pathname === "/payments" || pathname.startsWith("/journeys") : pathname === href || pathname.startsWith(`${href}/`); return <Link key={href} href={href} className={active ? "active" : ""} aria-current={active ? "page" : undefined}><Icon name={icon as IconName} /><span>{label}</span></Link>; });
  const commandCenter = pathname.startsWith("/command-center");
  return <div className="operator-app slush-workspace">
    <header className="operator-topbar"><Link className="brand" href="/command-center" aria-label="RecoveryOS Command Center"><span className="brand-mark"><BrandLogo /></span><span className="brand-copy"><strong>RecoveryOS</strong><small>Payments, unstuck.</small></span></Link><form className="global-payment-search" action="/payments" method="get" role="search"><Icon name="search" /><label className="sr-only" htmlFor="global-payment-search">Find a payment</label><input ref={searchRef} id="global-payment-search" name="q" placeholder="Find a payment…" autoComplete="off" /><kbd>Ctrl K</kbd></form><nav className="top-nav" aria-label="Primary navigation">{links}</nav><div className="topbar-actions"><Link className="header-recovery-cta" href="/recovery">Recover <Icon name="arrow" /></Link><form action="/api/auth/logout" method="post"><button className="icon-button sign-out" title="Sign out">Sign out</button></form><button className="topbar-menu icon-button" onClick={() => setMobileOpen(value => !value)} aria-label="Toggle navigation" aria-expanded={mobileOpen}><Icon name={mobileOpen ? "close" : "menu"} /></button></div></header>
    {mobileOpen && <nav className="mobile-top-nav" aria-label="Mobile navigation"><p>WHERE TO?</p>{links}<Link className="mobile-recovery-cta" href="/recovery">START RECOVERING <Icon name="arrow" /></Link></nav>}
    <main className={`operator-main${commandCenter ? " command-center-main" : ""}`}><header className="page-header"><div className="page-title"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1></div><p className="page-context-note"><Icon name={pathname.startsWith("/lab") ? "flask" : "shield"} />{pathname.startsWith("/lab") ? "Synthetic evidence only" : "Evidence-backed operations"}</p></header><div className="page-content">{children}</div><footer className="workspace-footer"><strong>RecoveryOS</strong><span>Good things come full circle.</span><span className="spline-footer-credit">R4X Bot by Vlad Kolokolnikov · CC BY 4.0</span><Link className="footer-doc-link" href="/guides/razorpay-setup">Operator guide <Icon name="arrow" /></Link><Link href="/evidence">Every action. On record. ↗</Link></footer></main>
  </div>;
}
