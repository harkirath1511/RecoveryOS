"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { BrandLogo } from "./brand-logo";
import { Icon } from "./ui-primitives";

const items = [
  ["Platform", "/#platform"],
  ["How it works", "/#how-it-works"],
  ["Safety & evidence", "/#evidence"],
  ["Documentation", "/guides/razorpay-setup"],
] as const;

export function SiteNavbar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, []);

  return <header className="site-header">
    <div className="site-nav">
      <Link href="/" className="site-brand" aria-label="RecoveryOS home"><BrandLogo /><span>recovery<span className="brand-os">os</span></span></Link>
      <nav className="site-nav-links" aria-label="Main navigation">{items.map(([name, href]) => <Link key={name} href={href} aria-current={pathname === href ? "page" : undefined}>{name}</Link>)}</nav>
      <div className="site-nav-actions"><Link href="/login" className="nav-signin">Sign in</Link><Link href="/login" className="button-ink nav-workspace">Open workspace <Icon name="arrow" /></Link><button type="button" className="site-menu-button" onClick={() => setOpen(value => !value)} aria-label={open ? "Close navigation" : "Open navigation"} aria-expanded={open} aria-controls="site-mobile-menu"><Icon name={open ? "close" : "menu"} /></button></div>
    </div>
    {open && <nav className="site-mobile-menu" id="site-mobile-menu" aria-label="Mobile navigation">{items.map(([name, href]) => <Link key={name} href={href} onClick={() => setOpen(false)}>{name}<Icon name="chevron" /></Link>)}<Link href="/login" onClick={() => setOpen(false)}>Open workspace <Icon name="arrow" /></Link></nav>}
  </header>;
}
