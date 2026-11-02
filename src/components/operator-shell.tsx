"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { BrandLogo } from "./brand-logo";
import { Icon } from "./ui-primitives";
import { ThemeToggle } from "./theme-toggle";

const navigation = [
  ["Overview", "/command-center"],
  ["Payments", "/payments"],
  ["Recovery", "/recovery"],
  ["Evidence", "/evidence"],
  ["Assistant", "/assistant"],
  ["Lab", "/lab"],
] as const;

export function OperatorShell({ title, eyebrow, children }: { title: string; eyebrow: string; children: ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const commandCenter = pathname.startsWith("/command-center");

  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);

  const links = navigation.map(([label, href]) => {
    const active = href === "/payments"
      ? pathname === href || pathname.startsWith("/journeys")
      : pathname === href || pathname.startsWith(`${href}/`);
    return <Link key={href} href={href} className={active ? "active" : undefined} aria-current={active ? "page" : undefined} onClick={() => setMobileOpen(false)}>{label}</Link>;
  });

  return <div className="operator-app workspace-layout">
    <a className="skip-link" href="#workspace-content">Skip to workspace</a>
    <header className="workspace-header">
      <div className="workspace-topline">
        <Link className="site-brand" href="/command-center" aria-label="RecoveryOS overview"><BrandLogo /><span>recovery<span className="brand-os">os</span></span></Link>
        <span className="workspace-environment"><span /> Razorpay <i>/</i> Test Mode</span>
        <form className="global-payment-search" action="/payments" method="get" role="search">
          <Icon name="search" /><label className="sr-only" htmlFor="global-payment-search">Find a payment</label>
          <input ref={searchRef} id="global-payment-search" name="q" placeholder="Find a payment" autoComplete="off" /><kbd>Ctrl K</kbd>
        </form>
        <Link className="workspace-guide" href="/guides/razorpay-setup">Guide <span>↗</span></Link>
        <ThemeToggle />
        <form action="/api/auth/logout" method="post"><button className="sign-out" type="submit">Sign out</button></form>
        <button className="workspace-menu" type="button" onClick={() => setMobileOpen(value => !value)} aria-label={mobileOpen ? "Close navigation" : "Open navigation"} aria-expanded={mobileOpen} aria-controls="workspace-mobile-menu"><Icon name={mobileOpen ? "close" : "menu"} /></button>
      </div>
      <nav className="workspace-tabs" aria-label="Primary navigation">{links}</nav>
      {mobileOpen && <nav className="workspace-mobile-nav" id="workspace-mobile-menu" aria-label="Mobile navigation">{links}<Link href="/guides/razorpay-setup">Documentation ↗</Link></nav>}
    </header>
    <main className={`operator-main${commandCenter ? " command-center-main" : ""}`} id="workspace-content">
      <header className="page-header"><div className="page-title"><p className="eyebrow">{eyebrow}</p><h1>{commandCenter ? "Overview" : title}</h1></div><p className="page-context-note"><span />{pathname.startsWith("/lab") ? "Synthetic evidence only" : "Provider-backed operations"}</p></header>
      <div className="page-content">{children}</div>
      <footer className="workspace-footer"><Link href="/">RecoveryOS</Link><span>Every payment has a story.</span><Link href="/evidence">Follow the evidence ↗</Link></footer>
    </main>
  </div>;
}
