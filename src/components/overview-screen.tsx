"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Icon, StatusBadge } from "./ui-primitives";
import { RecoverySculpture } from "./recovery-sculpture";

type Operations = {
  journeys: number; signedEvents: number; capturedJourneys: number; pendingWorkflows: number;
  outcomeTotals: Record<string, number>; recentOutcome: { category: string; createdAt: string } | null;
  stateTotals: Record<string, number>;
  recentActivity: Array<{ journeyId: string | null; eventType: string; reason: string | null; createdAt: string }>;
};
type Incident = { incident: null | { overallBaseline: { successRate: number }; overallCurrent: { successRate: number }; topSegment: { label: string; zScore: number } }; source: string; revenueAtRisk?: { amount: number; eligibleJourneyCount: number } };
const money = (amount: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount / 100);
const label = (value: string) => value.replaceAll("_", " ");

export function OverviewScreen() {
  const [operations, setOperations] = useState<Operations>();
  const [incident, setIncident] = useState<Incident>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => { Promise.all([fetch("/api/operations"), fetch("/api/incidents?includeRisk=true")]).then(async responses => { const bodies = await Promise.all(responses.map(response => response.json())); if (responses.some(response => !response.ok)) throw new Error(bodies.find(body => body.error)?.error ?? "Some command-center evidence is unavailable."); setOperations(bodies[0]); setIncident(bodies[1]); }).catch(cause => setError(cause instanceof Error ? cause.message : "Unable to load command center.")).finally(() => setLoading(false)); }, []);
  const totals = operations?.outcomeTotals ?? {}; const states = operations?.stateTotals ?? {};
  const stages = [
    { name: "Failed", note: "Payment exception found", count: operations ? states.FAILED_PENDING_VERIFICATION ?? 0 : "—", href: "/payments", tone: "orange" },
    { name: "Verify", note: "Provider truth requested", count: operations ? states.ATTEMPTED ?? 0 : "—", href: "/payments", tone: "yellow" },
    { name: "Safe", note: "Safety checks agree", count: operations ? states.RETRY_ELIGIBLE ?? 0 : "—", href: "/payments", tone: "mint" },
    { name: "Recover", note: "Controlled work running", count: operations ? operations.pendingWorkflows : "—", href: "/recovery", tone: "violet" },
    { name: "Outcome", note: "Result verified", count: operations ? states.CAPTURED ?? 0 : "—", href: "/recovery", tone: "blue" },
  ];
  return <>
    <section className="slush-hero">
      <div className="slush-hero-copy">
        <p className="hero-kicker"><span className="mini-sticker"><Icon name="loop" /></span> RECOVERY COMMAND CENTER</p>
        <h1 className="slush-display">PAYMENTS.<br />UNSTUCK.</h1>
        <p>Find the failure. Verify the truth. Bring the revenue back.</p>
        <div className="hero-actions"><Link className="recovery-button" href="/recovery">START RECOVERING <Icon name="arrow" /></Link><Link className="hero-secondary" href="/payments">VIEW PAYMENT JOURNEYS</Link></div>
        <span className="hero-curved-arrow" aria-hidden="true">↝</span>
      </div>
      <div className="command-center-sculpture"><RecoverySculpture /></div>
    </section>
    {loading && <p className="dashboard-load-state" role="status"><span /> Connecting live payment evidence…</p>}
    {error && <p className="state error-state">{error} Some sections may be unavailable; retry when the database connection recovers.</p>}

    <section className="metric-world" aria-labelledby="money-heading">
      <header className="editorial-heading"><p>LIVE OPERATIONS</p><h2 id="money-heading">MONEY,<br />MOVING.</h2><span>Every number is backed by stored provider evidence.</span></header>
      <div className="overview-bento">
        <Link href="/recovery" className="bento-stat bento-revenue"><span className="bento-label">Recovered revenue <Icon name="arrow" /></span><strong>{operations ? money(totals.DIRECT_RECOVERY ?? 0) : "•••"}</strong><div className="mini-trend" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /></div><small><Icon name="shield" /> Provider verified</small><span className="cropped-coin" aria-hidden="true">₹</span></Link>
        <Link href="/payments" className="bento-stat bento-journeys"><span className="bento-label">Payment journeys <Icon name="arrow" /></span><strong>{operations ? operations.journeys : "•••"}</strong><small>Every payment, in one place</small><span className="card-stack" aria-hidden="true"><i>VISA</i><i>UPI</i><i>••••</i></span></Link>
        <Link href="/recovery" className="bento-stat bento-active"><span className="bento-label">Recovery active <Icon name="arrow" /></span><strong>{operations ? operations.pendingWorkflows : "•••"}</strong><small>Controlled workflows in motion</small><span className="orbit-mark" aria-hidden="true"><i /></span></Link>
        <Link href="/payments?state=MANUAL_REVIEW" className="bento-stat bento-attention"><span className="alert-burst" aria-hidden="true">!</span><span className="bento-label">Needs a human <Icon name="arrow" /></span><strong>{operations ? states.MANUAL_REVIEW ?? 0 : "•••"}</strong><small>Ready for your attention</small></Link>
      </div>
    </section>

    <section className="journey-world" aria-labelledby="journey-heading">
      <header className="section-heading"><p>FIND IT. VERIFY IT. RECOVER IT.</p><h2 id="journey-heading">THE RECOVERY JOURNEY</h2></header>
      <div className="illustrated-journey"><svg viewBox="0 0 1100 210" preserveAspectRatio="none" aria-hidden="true"><path d="M72 122 C170 14 272 18 344 104 S521 199 607 97 S785 9 856 99 S992 181 1040 75" /></svg>{stages.map((stage, index) => <Link key={stage.name} href={stage.href} className={`journey-node journey-node-${stage.tone}`}><span>{index + 1}</span><strong>{stage.name}</strong><b>{stage.count}</b><small>{stage.note}</small></Link>)}</div>
    </section>

    <section className="health-queue-world"><HealthComposition incident={incident} loading={loading} /><article className="queue-composition"><header><div><p>NEEDS A HUMAN</p><h2>OPERATOR<br />QUEUES.</h2></div><Link href="/recovery">OPEN ALL <Icon name="arrow" /></Link></header><div className="attention-list"><Attention title="Manual review" value={operations ? states.MANUAL_REVIEW ?? 0 : "—"} note="Human decision required" tone="orange" important={Boolean(operations && (states.MANUAL_REVIEW ?? 0) > 0)} /><Attention title="Pending verification" value={operations ? states.FAILED_PENDING_VERIFICATION ?? 0 : "—"} note="Waiting for late-capture evidence" tone="yellow" important={Boolean(operations && (states.FAILED_PENDING_VERIFICATION ?? 0) > 0)} /><Attention title="Recovery eligible" value={operations ? states.RETRY_ELIGIBLE ?? 0 : "—"} note="Verified unpaid; next action is ready" tone="blue" important={Boolean(operations && (states.RETRY_ELIGIBLE ?? 0) > 0)} /><Attention title="Running workflows" value={operations ? operations.pendingWorkflows : "—"} note="Controlled work in progress" tone="mint" important={false} /></div></article></section>

    <section className="risk-editorial"><div className="risk-copy"><p>REVENUE WATCH</p><h2><strong>{incident ? money(incident.revenueAtRisk?.amount ?? 0) : "•••"}</strong><br />CURRENTLY AT RISK.</h2><span>{incident ? `Estimated from ${incident.revenueAtRisk?.eligibleJourneyCount ?? 0} eligible journeys. This is risk, not recovered revenue.` : "Connecting the current evidence window…"}</span></div><div className="receipt-sticker"><span>RECENT VERIFIED OUTCOME</span><strong>{operations ? operations.recentOutcome ? label(operations.recentOutcome.category) : "NONE YET" : "CHECKING"}</strong><small>{operations?.recentOutcome ? new Date(operations.recentOutcome.createdAt).toLocaleString() : operations ? "Awaiting provider evidence" : "Connecting outcome evidence…"}</small><i>✓</i></div><span className="risk-coin" aria-hidden="true">₹</span></section>
    <OutcomeComposition totals={totals} ready={Boolean(operations)} />
    <ActivityTimeline activities={operations?.recentActivity ?? []} available={Boolean(operations)} loading={loading} />
  </>;
}

function HealthComposition({ incident, loading }: { incident?: Incident; loading: boolean }) {
  const rate = incident?.incident?.overallCurrent.successRate; const percent = rate == null ? 100 : Math.round(rate * 1000) / 10;
  const checking = loading && !incident;
  return <article className={`health-composition ${incident?.incident ? "has-incident" : "is-clear"}`}><header><div><p>PAYMENT HEALTH</p><h2>{checking ? "CHECKING SIGNALS." : incident?.incident ? "CURRENT SIGNAL." : "ALL CLEAR."}</h2></div><StatusBadge tone={checking ? "info" : incident?.incident ? "warning" : "success"}>{checking ? "Loading evidence" : incident?.incident ? "Degradation detected" : "No active incident"}</StatusBadge></header><div className="health-visual"><div className="health-dial" style={{ "--health": `${checking ? 0 : percent * 3.6}deg` } as CSSProperties}><span><strong>{checking ? "•••" : incident?.incident ? `${percent}%` : "✓"}</strong><small>{checking ? "CONNECTING" : incident?.incident ? "PAYMENT SUCCESS" : "HEALTHY WINDOW"}</small></span></div><div className="health-message"><strong>{checking ? "Connecting provider evidence" : incident?.incident ? incident.incident.topSegment.label : "No active incident in the current evidence window"}</strong><p>{checking ? "Health status will appear after the current evidence window is verified." : incident?.incident ? `${incident.incident.topSegment.zScore.toFixed(1)}σ evidence gate. Investigate matching payments before intervening.` : "Provider signals and deterministic safety gates show no issue requiring action."}</p><svg viewBox="0 0 240 60" preserveAspectRatio="none" aria-label="Recent health trend"><path d={incident?.incident ? "M2 18 L40 17 L78 20 L116 21 L154 35 L192 39 L238 51" : "M2 38 L40 33 L78 35 L116 25 L154 28 L192 18 L238 16"} /></svg></div></div><footer><span>Baseline <strong>{checking ? "—" : incident?.incident ? `${(incident.incident.overallBaseline.successRate * 100).toFixed(1)}%` : "Stable"}</strong></span><span>Source <strong>{checking ? "Connecting…" : "Operational evidence"}</strong></span>{incident?.incident && <Link href="/incidents">INVESTIGATE <Icon name="arrow" /></Link>}</footer></article>;
}

function Attention({ title, value, note, tone, important }: { title: string; value: number | string; note: string; tone: string; important: boolean }) { return <Link href="/payments" className={`queue-row queue-${tone}${important ? " is-actionable" : ""}`}><b>{value}</b><span><strong>{title}</strong><small>{note}</small></span><i><Icon name="arrow" /></i></Link>; }

function OutcomeComposition({ totals, ready }: { totals: Record<string, number>; ready: boolean }) {
  const outcomes = useMemo(() => [{ key: "DIRECT_RECOVERY", title: "Direct recovery", value: totals.DIRECT_RECOVERY ?? 0, tone: "mint" }, { key: "NATURAL_LATE_CAPTURE", title: "Natural capture", value: totals.NATURAL_LATE_CAPTURE ?? 0, tone: "blue" }, { key: "UNATTRIBUTED_CAPTURE", title: "Unattributed", value: totals.UNATTRIBUTED_CAPTURE ?? 0, tone: "violet" }, { key: "NOT_RECOVERED", title: "Not recovered", value: totals.NOT_RECOVERED ?? 0, tone: "peach" }], [totals]);
  const total = outcomes.reduce((sum, item) => sum + item.value, 0);
  return <section className="outcomes-world" aria-labelledby="outcomes-heading"><header className="section-heading"><p>EVERY RESULT. ACCOUNTED FOR.</p><h2 id="outcomes-heading">VERIFIED<br />OUTCOMES.</h2><Link href="/recovery">OPEN RECOVERY WORKSPACE <Icon name="arrow" /></Link></header><div className="outcome-composition"><article className="featured-outcome"><span>DIRECT RECOVERY</span><strong>{ready ? money(totals.DIRECT_RECOVERY ?? 0) : "•••"}</strong><p>Revenue returned through verified policy recovery.</p><i aria-hidden="true">✓</i></article><div className="outcome-breakdown"><div className="outcome-bar" aria-label="Outcome value distribution">{outcomes.map(item => <i key={item.key} className={`bar-${item.tone}`} style={{ flexGrow: total ? item.value / total : 1 }} />)}</div><div className="outcome-legend">{outcomes.map(item => <div key={item.key}><i className={`legend-${item.tone}`} /><span>{item.title}</span><strong>{ready ? money(item.value) : "—"}</strong></div>)}</div><div className="duplicate-chip"><span>Duplicate prevention</span><strong>{ready ? totals.DUPLICATE_PREVENTED ?? 0 : "—"}</strong><small>Safety guard outcomes</small></div></div></div><p className="outcome-footnote">Only provider-verified operational outcomes belong in these totals. Synthetic Lab evidence stays explicitly separate.</p></section>;
}

function ActivityTimeline({ activities, available, loading }: { activities: Operations["recentActivity"]; available: boolean; loading: boolean }) {
  const visibleActivities = activities.slice(0, 6);
  return <section className="activity-world" aria-labelledby="activity-heading"><header className="section-heading"><p>EVERY ACTION. ON RECORD.</p><h2 id="activity-heading">RECOVERY<br />ACTIVITY.</h2><StatusBadge tone={available ? "success" : "info"}>{available ? "Evidence-backed" : loading ? "Connecting" : "Unavailable"}</StatusBadge></header>{activities.length ? <div className="editorial-timeline">{visibleActivities.map((activity, index) => { const date = new Date(activity.createdAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }); const priorDate = index ? new Date(visibleActivities[index - 1].createdAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }) : ""; const showDate = date !== priorDate; const eventLabel = label(activity.eventType); const highlight = /RECOVERY_(CREATED|COMPLETED)|CAPTURED/.test(activity.eventType); return <div className={`timeline-entry${highlight ? " is-highlight" : ""}`} key={`${activity.eventType}-${activity.createdAt}-${index}`}>{showDate && <p className="timeline-date">{date}</p>}<span className="timeline-node"><Icon name={highlight ? "recovery" : "activity"} /></span><div><strong>{activity.journeyId ? <Link href={`/journeys/${activity.journeyId}`}>{eventLabel}</Link> : eventLabel}</strong><small>{activity.reason ?? "Stored system evidence"}</small></div><time>{new Date(activity.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></div>; })}</div> : <div className="activity-empty"><span><Icon name="evidence" /></span><strong>{available ? "THE TRAIL STARTS HERE." : loading ? "CONNECTING THE TRAIL." : "EVIDENCE UNAVAILABLE."}</strong><p>{available ? "Verified recovery actions appear as soon as they are persisted." : loading ? "Recent persisted actions will appear when the evidence connection is ready." : "No activity conclusion is shown while operational evidence is unavailable."}</p></div>}<Link className="activity-cta" href="/evidence">VIEW FULL EVIDENCE TRAIL <Icon name="arrow" /></Link></section>;
}
