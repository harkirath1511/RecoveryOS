"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const navigation = [
  ["Command Center", "/"], ["Payments", "/payments"], ["Recovery", "/recovery"],
  ["Evidence", "/evidence"], ["Lab", "/lab"],
] as const;

export function OperatorShell({ title, eyebrow, children }: { title: string; eyebrow: string; children: ReactNode }) {
  const pathname = usePathname();
  return <div className="operator-app">
    <aside className="operator-nav"><Link className="brand" href="/"><span>RecoveryOS</span><small>operator workflow</small></Link>
      <nav aria-label="Operator navigation">{navigation.map(([label, href]) => { const active = href === "/payments" ? pathname === "/payments" || pathname.startsWith("/journeys") : pathname === href || (href !== "/" && pathname.startsWith(href)); return <Link key={href} href={href} className={active ? "active" : ""}>{label}</Link>; })}</nav>
      <p>Operational evidence is distinct from Lab’s synthetic scenarios and benchmarks.</p>
    </aside>
    <main className="operator-main"><header className="page-header"><div><p className="eyebrow">RecoveryOS / {eyebrow}</p><h1>{title}</h1></div><div className="header-actions"><form className="global-payment-search" action="/payments" method="get"><label htmlFor="global-payment-search">Find a payment</label><input id="global-payment-search" name="q" placeholder="Order ID, payment ID, journey UUID…"/><button type="submit">Search</button></form><form action="/api/auth/logout" method="post"><button className="text-button">Sign out</button></form></div></header>
      <p className="breadcrumbs"><Link href="/">Command Center</Link> <span>/</span> {eyebrow}</p>{children}</main>
  </div>;
}
