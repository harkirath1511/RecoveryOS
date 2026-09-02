"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const money = (value: number | null | undefined) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format((value ?? 0) / 100);
const label = (value: string | null | undefined) => (value ?? "Not recorded").replaceAll("_", " ");
const time = (value: string | Date | null | undefined, virtual = false) => {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return virtual || date.getFullYear() <= 1971 ? "Virtual simulation time (not wall-clock)" : date.toLocaleString();
};

const stateExplanation: Record<string, string> = {
  FAILED_PENDING_VERIFICATION: "Failure received. Recovery is paused while the original payment is checked for a late capture or authorization.",
  RETRY_ELIGIBLE: "The original payment was not captured after verification. It is eligible for a separately safety-checked recovery action; eligibility is not proof that a retry already ran.",
  HARD_DECLINED: "Automatic payment recovery is blocked. This journey requires manual review.",
  CAPTURED: "A provider capture was recorded, so no further recovery may run.",
};

export function JourneyDetailScreen({ id }: { id: string }) {
  const [data, setData] = useState<any>();
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/journeys/${id}`).then(async response => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Journey unavailable.");
      setData(body);
    }).catch(reason => setError(reason instanceof Error ? reason.message : "Journey unavailable."));
  }, [id]);

  if (error) return <p className="state error-state">{error}</p>;
  if (!data) return <p className="state">Loading journey evidence…</p>;

  const journey = data.journey;
  const hasDecision = data.decisions.length > 0;
  const autonomousEnabled = data.autonomousRecoveryEnabled === true;

  return <>
    <section className="summary-grid compact">
      <Metric label="State" value={label(journey.state)} />
      <Metric label="Original / outstanding" value={`${money(journey.originalAmount)} / ${money(journey.outstandingAmount)}`} />
      <Metric label="Terminal outcome" value={label(journey.terminalOutcome)} />
      <Metric label="Provider payment" value={journey.providerPaymentId ?? "Not yet verified"} />
    </section>

    <section className="panel">
      <div className="panel-heading"><div><p className="card-label">Current lifecycle</p><h2>{label(journey.state)}</h2></div><span className="safe-pill">{autonomousEnabled ? "Autonomous recovery enabled" : "Autonomous recovery disabled"}</span></div>
      <p className="panel-footnote">{stateExplanation[journey.state] ?? "This journey is following the persisted payment lifecycle."}</p>
      <Link className="recovery-button secondary-button" href={`/assistant?journey=${encodeURIComponent(journey.id)}`}>Ask Groq about this journey →</Link>
    </section>

    <section className="panel">
      <div className="panel-heading"><div><p className="card-label">Provider truth</p><h2>Event delivery and transitions</h2></div><span className="safe-pill">Occurrence and receipt evidence</span></div>
      {data.events.length ? data.events.map((event: any) => <div className="journey-row" key={event.id}><span>{label(event.type)} · {event.orderId ?? "No provider order"}</span><strong>{time(event.receivedAt)}</strong></div>) : <p className="panel-footnote">No signed webhook deliveries are related to this journey.</p>}
    </section>

    <section className="panel">
      <div className="panel-heading"><div><p className="card-label">Decision and safety</p><h2>Candidate actions, estimates, and safety results</h2></div></div>
      {hasDecision ? data.decisions.map((decision: any) => <details className="detail-card" key={decision.id} open><summary>{label(decision.action)} · {label(decision.triggerSource)} · expected {money(decision.expectedRecoveryAmount)}</summary><p>Decision reason: {decision.decisionReason ?? "Stored policy decision"}</p><pre>{JSON.stringify({ triggerSource: decision.triggerSource, candidateActions: decision.candidateActions, policyEstimates: decision.policyEstimates, safetyContext: decision.safetyContext, safety: decision.safety }, null, 2)}</pre></details>) : <p className="panel-footnote">{journey.state === "RETRY_ELIGIBLE" ? autonomousEnabled ? "Eligible for recovery, but no decision was recorded. Check the audit timeline for a policy-not-ready, duplicate-prevention, or safety-blocked reason." : "Eligible for recovery, but autonomous recovery is disabled. An operator can use the manual recovery flow after reviewing safety evidence." : "No recovery decision has been recorded yet."}</p>}
    </section>

    <section className="panel">
      <div className="panel-heading"><div><p className="card-label">Execution and attribution</p><h2>Workflows and verified outcomes</h2></div></div>
      {data.workflows.length ? data.workflows.map((workflow: any) => <div className="journey-row" key={workflow.id}><span>{label(workflow.action)} · {label(workflow.status)} · {workflow.terminalReason ?? "No terminal reason"}<small>Idempotency: {workflow.idempotencyKey ?? "Not recorded"} · External resource: {workflow.externalResourceId ?? "Not created"}</small></span><strong>{time(workflow.executedAt ?? workflow.scheduledAt ?? workflow.createdAt, String(workflow.terminalReason ?? "").startsWith("VIRTUAL_"))}</strong></div>) : <p className="panel-footnote">No workflow has been created.</p>}
      {data.outcome && <div className="journey-row"><span>{label(data.outcome.category)} · verified<small>{data.outcome.evidence?.virtual ? "Virtual verification outcome; this is not a customer recovery result." : "Provider-verified outcome."}</small></span><strong>{money(data.outcome.capturedAmount)}</strong></div>}
    </section>

    <section className="panel">
      <div className="panel-heading"><div><p className="card-label">Immutable audit timeline</p><h2>Complete evidence chain</h2></div><Link href="/audit">All audit evidence →</Link></div>
      {data.audits.length ? data.audits.map((audit: any, index: number) => <div className="journey-row" key={index}><span>{label(audit.eventType)} · {audit.reason ?? "No reason"}</span><strong>{time(audit.createdAt)}</strong></div>) : <p className="panel-footnote">No audit entries are attached to this journey.</p>}
    </section>
  </>;
}

function Metric({ label, value }: { label: string; value: string }) { return <article className="metric-card"><p>{label}</p><strong>{value}</strong></article>; }
