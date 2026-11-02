"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon, StatusBadge } from "./ui-primitives";

type Operations = {
  journeys: number; signedEvents: number; capturedJourneys: number; pendingWorkflows: number;
  outcomeTotals: Record<string, number>; recentOutcome: { category: string; createdAt: string } | null;
  stateTotals: Record<string, number>;
  recentActivity: Array<{ journeyId: string | null; eventType: string; reason: string | null; createdAt: string }>;
};
type Incident = { incident: null | { overallBaseline: { successRate: number }; overallCurrent: { successRate: number }; topSegment: { label: string; zScore: number } }; source: string; revenueAtRisk?: { amount: number; eligibleJourneyCount: number } };
const money = (amount: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount / 100);
const label = (value: string) => value.replaceAll("_", " ").toLowerCase();

export function OverviewScreen() {
  const [operations, setOperations] = useState<Operations>();
  const [incident, setIncident] = useState<Incident>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => { Promise.all([fetch("/api/operations"), fetch("/api/incidents?includeRisk=true")]).then(async responses => { const bodies = await Promise.all(responses.map(response => response.json())); if (responses.some(response => !response.ok)) throw new Error(bodies.find(body => body.error)?.error ?? "Some command-center evidence is unavailable."); setOperations(bodies[0]); setIncident(bodies[1]); }).catch(cause => setError(cause instanceof Error ? cause.message : "Unable to load command center.")).finally(() => setLoading(false)); }, []);
  const totals = operations?.outcomeTotals ?? {};
  const states = operations?.stateTotals ?? {};
  const stages = [
    { name: "Detected", note: "Pending verification", count: operations ? states.FAILED_PENDING_VERIFICATION ?? 0 : "—", href: "/payments?state=FAILED_PENDING_VERIFICATION" },
    { name: "Verification", note: "Provider evidence", count: operations ? states.ATTEMPTED ?? 0 : "—", href: "/payments?state=ATTEMPTED" },
    { name: "Eligible", note: "Safety checks passed", count: operations ? states.RETRY_ELIGIBLE ?? 0 : "—", href: "/payments?state=RETRY_ELIGIBLE" },
    { name: "Recovering", note: "Controlled workflows", count: operations ? operations.pendingWorkflows : "—", href: "/recovery" },
    { name: "Captured", note: "Provider confirmed", count: operations ? states.CAPTURED ?? 0 : "—", href: "/payments?state=CAPTURED" },
  ];

  return <>
    <div className="overview-intro"><p>Your payment operations, at a glance.</p><Link className="button-ink" href="/recovery">Open recovery queue <span>↗</span></Link></div>
    {loading && <p className="dashboard-load-state" role="status"><span className="loading-spinner" /> Connecting payment evidence…</p>}
    {error && <p className="state error-state" role="alert">{error} Some sections may be unavailable; retry when the database connection recovers.</p>}
    <section className="overview-metrics" aria-label="Operational summary">
      <Link href="/recovery" className="overview-metric metric-featured"><span>Recovered revenue</span><strong>{operations ? money(totals.DIRECT_RECOVERY ?? 0) : "—"}</strong><small>Provider-verified recovery <span>↗</span></small></Link>
      <Link href="/payments" className="overview-metric"><span>Payment journeys</span><strong>{operations ? operations.journeys.toLocaleString() : "—"}</strong><small>All payment exceptions <span>↗</span></small></Link>
      <Link href="/recovery" className="overview-metric"><span>Active workflows</span><strong>{operations ? operations.pendingWorkflows.toLocaleString() : "—"}</strong><small>Recovery in progress <span>↗</span></small></Link>
      <Link href="/payments?state=MANUAL_REVIEW" className="overview-metric"><span>Needs your attention</span><strong>{operations ? states.MANUAL_REVIEW ?? 0 : "—"}</strong><small>Awaiting operator review <span>↗</span></small></Link>
    </section>
    <section className="pipeline-panel" aria-labelledby="pipeline-title"><header className="dashboard-section-title"><div><p className="micro-label">FOLLOW THE PAYMENT</p><h2 id="pipeline-title">Recovery pipeline</h2></div><Link href="/payments">View all payments ↗</Link></header><div className="pipeline-stages">{stages.map((stage, i) => <Link href={stage.href} key={stage.name}><div><span className="pipeline-index">0{i + 1}</span><span className="pipeline-arrow">↗</span></div><strong>{stage.count}</strong><h3>{stage.name}</h3><p>{stage.note}</p></Link>)}</div></section>
    <HealthPanel incident={incident} loading={loading} />
    <section className="overview-columns"><OutcomePanel totals={totals} ready={Boolean(operations)} /><article className="operator-queues"><header className="dashboard-section-title"><div><p className="micro-label">WHAT NEEDS YOU</p><h2>Operator queues</h2></div><Link href="/recovery" aria-label="Open recovery queues">↗</Link></header><Queue title="Manual review" note="A human decision is needed" value={operations ? states.MANUAL_REVIEW ?? 0 : "—"} href="/payments?state=MANUAL_REVIEW" /><Queue title="Pending verification" note="Checking for late captures" value={operations ? states.FAILED_PENDING_VERIFICATION ?? 0 : "—"} href="/payments?state=FAILED_PENDING_VERIFICATION" /><Queue title="Recovery eligible" note="Verified unpaid and ready" value={operations ? states.RETRY_ELIGIBLE ?? 0 : "—"} href="/payments?state=RETRY_ELIGIBLE" /></article></section>
    <section className="revenue-watch"><p className="micro-label">REVENUE AT RISK</p><strong>{incident ? money(incident.revenueAtRisk?.amount ?? 0) : "—"}</strong><p>{incident ? `Across ${incident.revenueAtRisk?.eligibleJourneyCount ?? 0} eligible journeys. Risk is separate from recovered revenue.` : "Awaiting current payment evidence."}</p><Link href="/payments">Inspect payments ↗</Link></section>
    <section className="activity-panel"><header className="dashboard-section-title"><div><p className="micro-label">THE LATEST CHAPTER</p><h2>Recent activity</h2></div><Link href="/evidence">Full evidence trail ↗</Link></header>{operations?.recentActivity.length ? <div className="recent-activity-list">{operations.recentActivity.slice(0, 6).map((activity, i) => <div className="recent-activity-row" key={`${activity.createdAt}-${i}`}><span className="activity-number">{String(i + 1).padStart(2, "0")}</span><div><strong>{activity.journeyId ? <Link href={`/journeys/${activity.journeyId}`}>{label(activity.eventType)}</Link> : label(activity.eventType)}</strong><p>{activity.reason ?? "Stored system evidence"}</p></div><time dateTime={activity.createdAt}>{new Date(activity.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</time><span className="activity-row-arrow">↗</span></div>)}</div> : <div className="activity-empty"><Icon name="evidence" /><strong>{operations ? "Your evidence trail starts here." : loading ? "Connecting your evidence trail…" : "Evidence is currently unavailable."}</strong><p>{operations ? "Verified recovery actions appear here as they are recorded." : "Recent activity will appear when the connection is available."}</p></div>}</section>
  </>;
}

function HealthPanel({ incident, loading }: { incident?: Incident; loading: boolean }) {
  const active = incident?.incident;
  return <section className={`payment-health ${active ? "health-warning" : ""}`}><span className="health-symbol"><Icon name={!incident ? "clock" : active ? "warning" : "check"} /></span><div><h2>{!incident ? loading ? "Checking provider signals" : "Provider signals unavailable" : active ? "A payment signal needs attention" : "All clear in the current evidence window."}</h2><p>{!incident ? "Provider evidence is needed to determine payment health." : active ? `${active.topSegment.label} · ${(active.overallCurrent.successRate * 100).toFixed(1)}% success · ${active.topSegment.zScore.toFixed(1)}σ signal` : "No active incident detected from operational provider evidence."}</p></div>{active ? <Link href="/incidents">Investigate ↗</Link> : <StatusBadge tone={incident ? "success" : "neutral"}>{incident ? "No active incident" : "Awaiting evidence"}</StatusBadge>}</section>;
}

function Queue({ title, note, value, href }: { title: string; note: string; value: number | string; href: string }) {
  return <Link className="operator-queue-row" href={href}><div><strong>{title}</strong><small>{note}</small></div><b>{value}</b><span>↗</span></Link>;
}

function OutcomePanel({ totals, ready }: { totals: Record<string, number>; ready: boolean }) {
  const outcomes = [{ key: "DIRECT_RECOVERY", title: "Direct recovery", color: "accent" }, { key: "NATURAL_LATE_CAPTURE", title: "Natural capture", color: "green" }, { key: "UNATTRIBUTED_CAPTURE", title: "Unattributed", color: "blue" }, { key: "NOT_RECOVERED", title: "Not recovered", color: "muted" }];
  const total = outcomes.reduce((sum, item) => sum + (totals[item.key] ?? 0), 0);
  return <article className="outcome-panel"><header className="dashboard-section-title"><div><p className="micro-label">ACCOUNTED FOR</p><h2>Verified outcomes</h2></div><span className="outcome-unit">INR</span></header><div className="outcome-value-grid">{outcomes.map(item => <div key={item.key}><span><i className={`outcome-color-${item.color}`} />{item.title}</span><strong>{ready ? money(totals[item.key] ?? 0) : "—"}</strong></div>)}</div>{total > 0 && <div className="outcome-distribution" aria-label="Outcome value distribution">{outcomes.map(item => <span className={`outcome-color-${item.color}`} key={item.key} style={{ flexGrow: (totals[item.key] ?? 0) / total }} title={`${item.title}: ${money(totals[item.key] ?? 0)}`} />)}</div>}<footer><span>Duplicate preventions <strong>{ready ? totals.DUPLICATE_PREVENTED ?? 0 : "—"}</strong></span><small>Synthetic Lab evidence is excluded.</small></footer></article>;
}
