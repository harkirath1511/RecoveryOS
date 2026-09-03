"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const navigation = [
  ["Overview", "/"], ["Incidents", "/incidents"], ["Journeys", "/journeys"],
  ["Recovery operations", "/operations"], ["Manual review", "/manual-review"],
  ["Recovery policy", "/policy"], ["Recovery lab", "/lab"], ["Evidence assistant", "/assistant"], ["Evidence & audit", "/audit"],
] as const;

export function OperatorShell({ title, eyebrow, children }: { title: string; eyebrow: string; children: ReactNode }) {
  const pathname = usePathname();
  return <div className="operator-app">
    <aside className="operator-nav"><Link className="brand" href="/"><span>RecoveryOS</span><small>operator console</small></Link>
      <nav aria-label="Operator navigation">{navigation.map(([label, href]) => <Link key={href} href={href} className={pathname === href || (href !== "/" && pathname.startsWith(href)) ? "active" : ""}>{label}</Link>)}</nav>
      <p>Test Mode payment evidence and synthetic evidence are deliberately kept separate.</p>
    </aside>
    <main className="operator-main"><header className="page-header"><div><p className="eyebrow">RecoveryOS / {eyebrow}</p><h1>{title}</h1></div><form action="/api/auth/logout" method="post"><button className="text-button">Sign out</button></form></header>
      <p className="breadcrumbs"><Link href="/">Overview</Link> <span>/</span> {eyebrow}</p>{children}</main>
  </div>;
}
