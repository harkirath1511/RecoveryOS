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
  return <div className="operator-app royal-workspace">
    <a className="skip-link" href="#workspace-content">Skip to workspace</a>
    <aside className="workspace-sidebar"><Link className="brand" href="/command-center" aria-label="RecoveryOS Command Center"><span className="brand-mark"><BrandLogo /></span><span className="brand-copy"><strong>Recovery<span className="brand-os">OS</span></strong><small>PAYMENT OPERATIONS</small></span></Link><div className="workspace-account"><span className="account-monogram">R</span><div><strong>Operator workspace</strong><small><span /> Razorpay · Test Mode</small></div><Icon name="chevron" /></div><p className="sidebar-label">WORKSPACE</p><nav className="workspace-navigation" aria-label="Primary navigation">{links}</nav><div className="sidebar-bottom"><div className="sidebar-assurance"><Icon name="shield" /><strong>Confidence in every action.</strong><p>Provider evidence and safety checks guide your recovery.</p></div><Link href="/guides/razorpay-setup"><Icon name="evidence" /> Documentation <Icon name="arrow" /></Link><Link href="/"><Icon name="chevron" /> Back to website</Link></div></aside>
    <div className="workspace-body"><header className="operator-topbar"><div className="workspace-breadcrumb"><span>Workspace</span><Icon name="chevron" /><strong>{title}</strong></div><form className="global-payment-search" action="/payments" method="get" role="search"><Icon name="search" /><label className="sr-only" htmlFor="global-payment-search">Find a payment</label><input ref={searchRef} id="global-payment-search" name="q" placeholder="Find a payment…" autoComplete="off" /><kbd>Ctrl K</kbd></form><div className="topbar-actions"><span className="workspace-mode">Test Mode</span><form action="/api/auth/logout" method="post"><button className="sign-out" title="Sign out">Sign out</button></form><button type="button" className="topbar-menu icon-button" onClick={() => setMobileOpen(value => !value)} aria-label={mobileOpen ? "Close navigation" : "Open navigation"} aria-expanded={mobileOpen} aria-controls="workspace-mobile-menu"><Icon name={mobileOpen ? "close" : "menu"} /></button></div></header>
    {mobileOpen && <nav className="mobile-top-nav" id="workspace-mobile-menu" aria-label="Mobile navigation" onClick={() => setMobileOpen(false)}><p>WORKSPACE</p>{links}<Link href="/guides/razorpay-setup">Documentation <Icon name="arrow" /></Link></nav>}
    <main id="workspace-content" className={`operator-main${commandCenter ? " command-center-main" : ""}`}><header className="page-header"><div className="page-title"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1></div><p className="page-context-note"><Icon name={pathname.startsWith("/lab") ? "flask" : "shield"} />{pathname.startsWith("/lab") ? "Synthetic evidence only" : "Evidence-backed operations"}</p></header><div className="page-content">{children}</div><footer className="workspace-footer"><strong>RecoveryOS</strong><span>Clarity. Control. Confidence.</span><Link href="/evidence">View evidence trail <Icon name="arrow" /></Link></footer></main></div>
  </div>;
}
