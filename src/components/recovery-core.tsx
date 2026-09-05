"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "./ui-primitives";

type RecoveryCoreProps = {
  states: Record<string, number>;
  pendingWorkflows: number;
  protectedValue: string;
};

const nodes = [
  { key: "failure", label: "Failure", description: "Awaiting verification", href: "/payments?state=FAILED_PENDING_VERIFICATION", count: (states: Record<string, number>) => states.FAILED_PENDING_VERIFICATION ?? 0 },
  { key: "verification", label: "Verification", description: "Provider evidence", href: "/payments?state=ATTEMPTED", count: (states: Record<string, number>) => states.ATTEMPTED ?? 0 },
  { key: "safety", label: "Safety", description: "Eligible or review", href: "/payments?state=RETRY_ELIGIBLE", count: (states: Record<string, number>) => (states.RETRY_ELIGIBLE ?? 0) + (states.MANUAL_REVIEW ?? 0) },
  { key: "recovery", label: "Recovery", description: "Controlled workflow", href: "/recovery", count: (_states: Record<string, number>, pending: number) => pending },
  { key: "outcome", label: "Outcome", description: "Verified capture", href: "/payments?state=CAPTURED", count: (states: Record<string, number>) => states.CAPTURED ?? 0 },
] as const;

export function RecoveryCore({ states, pendingWorkflows, protectedValue }: RecoveryCoreProps) {
  const [active, setActive] = useState<string>();
  const [interactive, setInteractive] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => { setInteractive(!media.matches); setHidden(document.hidden); };
    sync();
    media.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    return () => { media.removeEventListener("change", sync); document.removeEventListener("visibilitychange", sync); };
  }, []);

  return <section className={`recovery-core ${hidden ? "core-paused" : ""}`} aria-labelledby="recovery-core-title">
    <div className="core-heading"><div><p className="card-label">Protected value network</p><h2 id="recovery-core-title">Recovery Core</h2></div><span>{interactive ? "Explore stages" : "Static overview"}</span></div>
    <div className="core-scene" aria-label="Recovery lifecycle network">
      <svg className="core-paths" viewBox="0 0 500 360" aria-hidden="true"><path d="M92 110 C135 36 213 48 250 94 S352 45 409 110" /><path d="M92 110 C48 170 92 274 170 274 S293 321 409 250" /><path d="M92 110 C166 157 198 176 250 180 S343 147 409 110" /><path d="M170 274 C210 226 223 207 250 180 S344 234 409 250" /></svg>
      <div className="core-value"><span>Protected value</span><strong>{protectedValue}</strong><small>provider-verified</small></div>
      {nodes.map(node => { const count = node.count(states, pendingWorkflows); const isActive = active === node.key; return <Link onFocus={() => setActive(node.key)} onBlur={() => setActive(undefined)} onMouseEnter={() => setActive(node.key)} onMouseLeave={() => setActive(undefined)} className={`core-node core-node-${node.key} ${isActive ? "is-active" : ""}`} href={node.href} key={node.key} aria-label={`${node.label}: ${count} ${node.description.toLowerCase()} journeys`}><span className="core-node-icon"><Icon name={node.key === "safety" ? "shield" : node.key === "recovery" ? "recovery" : node.key === "outcome" ? "check" : node.key === "verification" ? "evidence" : "warning"} /></span><strong>{node.label}</strong><small>{count} · {node.description}</small></Link>; })}
    </div>
    <p className="core-footnote">Counts use persisted operational evidence. Select a stage to inspect its matching journeys.</p>
  </section>;
}
