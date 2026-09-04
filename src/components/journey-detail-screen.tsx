"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- The detail view renders versioned, read-only evidence JSON from its internal operator route. */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { LoadingState } from "./loading-state";

const money = (value: number | null | undefined) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format((value ?? 0) / 100);
const label = (value: string | null | undefined) => (value ?? "Not recorded").replaceAll("_", " ");
const time = (value: string | Date | null | undefined) => value ? new Date(value).toLocaleString() : "Not recorded";

const states: Record<string, { explanation: string; owner: string; next: string; action: string }> = {
  CREATED: { explanation: "RecoveryOS is waiting for a verified provider payment event.", owner: "Razorpay/provider", next: "A payment attempt or provider event is received.", action: "No recovery action is available yet." },
  ATTEMPTED: { explanation: "A payment attempt exists, but no terminal provider result has been verified.", owner: "Razorpay/provider", next: "RecoveryOS waits for a verified status event.", action: "No recovery action is available yet." },
  FAILED_PENDING_VERIFICATION: { explanation: "A verified failure was received. RecoveryOS has paused recovery to guard against a late authorization or capture.", owner: "RecoveryOS", next: "Provider verification completes after the configured grace window.", action: "You can enter manual review while verification remains controlled." },
  RETRY_ELIGIBLE: { explanation: "Provider verification found no capture. The journey can be evaluated for a separate, safety-checked recovery action.", owner: "RecoveryOS / operator", next: "A policy decision or an operator-approved recovery may create a controlled workflow.", action: "Review the safety result before approving a recovery link." },
  AUTHORIZED: { explanation: "The provider has authorized the payment but capture is not yet confirmed.", owner: "Razorpay/provider", next: "RecoveryOS waits for capture confirmation and prevents another payment path.", action: "Recovery is unavailable to avoid duplicate collection." },
  CAPTURED: { explanation: "The provider verified capture. RecoveryOS stopped pending work so a second payment cannot be created.", owner: "Razorpay/provider", next: "No recovery is needed.", action: "No operator action is available." },
  HARD_DECLINED: { explanation: "The provider reported a hard decline. Automatic payment recovery is blocked.", owner: "Operator", next: "Move the journey to manual review if follow-up is required.", action: "Enter manual review; no unsafe payment action is available." },
  MANUAL_REVIEW: { explanation: "An operator must decide how to handle this journey; RecoveryOS will not auto-approve it.", owner: "Operator", next: "Record an approval or stop further recovery.", action: "Approve recovery only after reviewing the safety evidence." },
  CANCELLED: { explanation: "The payment journey was cancelled and cannot be reopened by RecoveryOS.", owner: "Operator / provider", next: "No automated recovery will run.", action: "No operator action is available." },
  EXPIRED: { explanation: "The payment journey expired and cannot be reopened by RecoveryOS.", owner: "Operator / provider", next: "No automated recovery will run.", action: "No operator action is available." },
};

type Action = "ENTER_MANUAL_REVIEW" | "APPROVE_RECOVERY" | "CREATE_PAYMENT_LINK";

export function JourneyDetailScreen({ id }: { id: string }) {
  const [data, setData] = useState<any>();
  const [error, setError] = useState("");
  const [pending, setPending] = useState<Action>();
  const [reason, setReason] = useState("");
  const [actionStatus, setActionStatus] = useState("");
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch(`/api/journeys/${id}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Journey unavailable.");
      setData(body);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Journey unavailable."); }
  }, [id]);

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);

  async function confirmAction() {
    if (!pending || !data) return;
    if (pending !== "CREATE_PAYMENT_LINK" && reason.trim().length < 3) { setActionStatus("Give the operator reason before confirming this action."); return; }
    setWorking(true); setActionStatus("");
    try {
      const response = pending === "CREATE_PAYMENT_LINK"
        ? await fetch("/api/recovery-links", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ journeyId: data.journey.id, customer: { name: "RecoveryOS Test", contact: "+919876543210" }, referenceId: `recovery-${data.journey.id.slice(0, 8)}`, requestedAction: "CREATE_PAYMENT_LINK" }) })
        : await fetch("/api/manual-review", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ journeyId: data.journey.id, action: pending, reason: reason.trim() }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? result.reason ?? "The action was not applied.");
      setActionStatus(result.recoveryUrl ? `Approved Test Mode recovery link created: ${result.recoveryUrl}` : result.reason ?? (result.action ? `${label(result.action)} workflow recorded. Journey evidence refreshed.` : "Operator action recorded. Journey evidence refreshed."));
      setPending(undefined); setReason(""); await load();
    } catch (cause) { setActionStatus(cause instanceof Error ? cause.message : "The action was not applied."); }
    finally { setWorking(false); }
  }

  if (error) return <p className="state error-state">{error} <button type="button" onClick={() => void load()}>Retry</button></p>;
  if (!data) return <LoadingState label="Loading payment, provider, decision, workflow, and audit evidence…" />;

  const journey = data.journey;
  const activeRecoveryLink = data.tokens.find((token: any) => token.customerHandoffUrl && token.customerHandoffAvailable);
  const state = states[journey.state] ?? { explanation: "This persisted state has no operator explanation yet.", owner: "RecoveryOS", next: "Inspect the related evidence.", action: "Review the audit trail." };
  const synthetic = journey.razorpayOrderId?.startsWith("scenario:") || data.workflows.some((workflow: any) => String(workflow.externalResourceId ?? "").startsWith("virtual:"));
  const source = synthetic ? "Synthetic evidence" : "Razorpay Test Mode evidence";
  const latestDecision = data.decisions[0];
  const latestWorkflow = data.workflows[0];
  const currentOutcome = data.outcomes[0];
  const canIntervene = !["CAPTURED", "CANCELLED", "EXPIRED"].includes(journey.state);
  const candidateActions = latestDecision?.policyEstimates ?? latestDecision?.candidateActions ?? [];
  const recoveryAvailability = describeRecoveryAvailability(journey, data, latestDecision, latestWorkflow);
  const nextStep = activeRecoveryLink ? "An exact-amount Test Mode recovery link is ready and awaits a customer checkout." : state.next;

  return <>
    <section className="journey-hero panel">
      <div className="panel-heading"><div><p className="card-label">Payment journey</p><h2>{journey.razorpayOrderId ?? journey.id}</h2><p className="panel-footnote">Journey UUID: {journey.id}</p></div><span className={synthetic ? "status-pill" : "safe-pill"}>{source}</span></div>
      <div className="summary-grid compact"><Metric label="Current state" value={label(journey.state)} /><Metric label="Outstanding / original" value={`${money(journey.outstandingAmount)} / ${money(journey.originalAmount)}`} /><Metric label="Provider / method" value={[journey.provider, journey.paymentMethod].filter(Boolean).join(" · ") || "Not recorded"} /><Metric label="Workflow / outcome" value={`${label(latestWorkflow?.status)} / ${label(currentOutcome?.category ?? journey.terminalOutcome)}`} /></div>
      <div className="operator-answer"><div><strong>What happened?</strong><p>{state.explanation}</p></div><div><strong>What happens next?</strong><p>{nextStep}</p></div><div><strong>Current owner</strong><p>{state.owner}</p></div></div>
    </section>

    <LifecycleTimeline journey={journey} transitions={data.transitions} decisions={data.decisions} workflows={data.workflows} outcomes={data.outcomes} />

    <section className="panel">
      <div className="panel-heading"><div><p className="card-label">RecoveryOS Agent Activity</p><h2>How the recovery decision was made</h2></div><span className="safe-pill">Safety rules cannot be bypassed</span></div>
      <div className="agent-context"><Info label="Recovery availability" value={recoveryAvailability.availability} /><Info label="Why" value={recoveryAvailability.reason} /><Info label="Next expected step" value={recoveryAvailability.next} /><Info label="Operator action" value={recoveryAvailability.operatorAction} /></div>
      {latestDecision ? <>
        <p className="agent-summary">{agentSummary(journey, latestDecision, latestWorkflow, Boolean(activeRecoveryLink))}</p>
        <div className="agent-context"><Info label="Trigger" value={label(latestDecision.triggerSource)} /><Info label="Selection" value={latestDecision.triggerSource === "MANUAL_OPERATOR" ? "Manual request" : "Automated"} /><Info label="Policy version" value={latestDecision.policyVersion ?? latestDecision.policy} /><Info label="Selected action" value={label(latestDecision.action)} /></div>
        <div className="agent-context"><Info label="Execution artifact" value={activeRecoveryLink ? "Exact-amount Test Mode payment link created" : "No customer-facing recovery artifact created"} /><Info label="Decision reason" value={latestDecision.decisionReason ?? "Stored policy decision"} /><Info label="Policy update" value={data.audits.some((entry: any) => entry.eventType === "LINUCB_UPDATED") ? "Verified outcome updated policy" : "No provider-confirmed recovery outcome yet"} /></div>
        <details className="detail-card"><summary>Candidate actions and safety checks</summary><div className="candidate-list">{Array.isArray(candidateActions) ? candidateActions.map((candidate: any, index: number) => <div key={`${candidate.action ?? candidate}-${index}`}><strong>{label(candidate.action ?? candidate)}</strong><span>Candidate retained only if deterministic safety checks permit it.</span></div>) : <p>No candidate-action list was persisted.</p>}</div><SafetyResults value={latestDecision.safety} /></details>
        <details className="detail-card"><summary>Recovery context</summary><div className="agent-context">{Object.entries(latestDecision.policyContext ?? {}).map(([key, value]) => <Info key={key} label={label(key)} value={String(value)} />)}</div></details>
      </> : <p className="panel-footnote">{journey.state === "RETRY_ELIGIBLE" ? data.autonomousRecoveryEnabled ? "Recovery is eligible, but no persisted policy decision is available yet. The audit trail records whether policy readiness or safety prevented execution." : "Recovery is eligible, but autonomous recovery is disabled. An operator may evaluate the available manual actions below." : "No recovery decision is required at this stage."}</p>}
    </section>

    {activeRecoveryLink && <section className="panel">
      <div className="panel-heading"><div><p className="card-label">Customer recovery handoff</p><h2>Exact-amount Test Mode recovery link is ready</h2></div><span className="safe-pill">No automatic charge</span></div>
      <p className="panel-footnote">RecoveryOS created this link after provider verification and safety checks. It remains unpaid until the customer completes checkout; share it only through an approved customer channel.</p>
      <div className="actions"><a className="button-link" href={activeRecoveryLink.customerHandoffUrl} target="_blank" rel="noreferrer">Open recovery payment link</a><span className="status-pill">Expires {time(activeRecoveryLink.expiresAt)}</span></div>
    </section>}

    <section className="panel">
      <div className="panel-heading"><div><p className="card-label">Controlled workflow</p><h2>Execution, verification, and outcome</h2></div><span className="status-pill">{latestWorkflow ? label(latestWorkflow.status) : "No workflow"}</span></div>
      {data.workflows.length ? <div className="workflow-list">{data.workflows.map((workflow: any) => <article className="workflow-card" key={workflow.id}><strong>{label(workflow.action)} · {label(workflow.status)}</strong><div><Info label="Workflow ID" value={workflow.id} /><Info label="Attempts" value={String(workflow.attemptCount)} /><Info label="Scheduled" value={time(workflow.scheduledAt)} /><Info label="Executed" value={time(workflow.executedAt)} /><Info label="Cancelled" value={time(workflow.cancelledAt)} /><Info label="Expires" value={time(workflow.expiresAt)} /><Info label="Terminal reason" value={workflow.terminalReason ?? "Not terminal"} /><Info label="Idempotency key" value={workflow.idempotencyKey ?? "Not recorded"} /><Info label="QStash message" value={workflow.qstashMessageId ?? "Not scheduled"} /><Info label="External resource" value={workflow.externalResourceId ?? "Not created"} /></div></article>)}</div> : <p className="panel-footnote">No workflow has been created. RecoveryOS never creates a payment path before verification and safety checks allow it.</p>}
      {data.outcomes.length ? <div className="outcome-list">{data.outcomes.map((outcome: any) => <article className="workflow-card" key={outcome.id}><strong>{label(outcome.category)} · {money(outcome.capturedAmount)}</strong><p>{outcome.category === "NATURAL_LATE_CAPTURE" ? "Provider capture arrived during verification. It is retained revenue, not direct policy recovery." : outcome.category === "DIRECT_RECOVERY" ? "Provider-verified direct recovery outcome." : outcome.category === "DUPLICATE_PREVENTED" ? "RecoveryOS prevented another payment attempt." : outcome.category === "NOT_RECOVERED" ? "No verified capture was attributed to this recovery path." : "Provider-verified outcome; attribution is shown separately from prediction."}</p></article>)}</div> : journey.state === "CAPTURED" ? <p className="panel-footnote">Capture is verified; no recovery outcome record was required for this normal payment path.</p> : null}
    </section>

    {canIntervene && <section className="panel manual-intervention"><div className="panel-heading"><div><p className="card-label">Manual intervention</p><h2>Take a controlled action</h2></div><span className="status-pill">Operator reason required</span></div><p className="panel-footnote">{state.action} These controls use the existing server-side state machine and safety checks; they cannot charge a customer or bypass a block.</p>{data.workflows.some((workflow: any) => workflow.status === "PENDING") && <p className="panel-footnote">Stopping a pending workflow is unavailable here: the current operator API records an operator stop but does not cancel the scheduled provider-verification delivery. The control is intentionally withheld rather than imply that recovery has stopped.</p>}{journey.state === "MANUAL_REVIEW" && <p className="panel-footnote">This journey is already in manual review. The current backend exposes no further approval transition from this terminal state; its existing workflow and audit evidence remain available above.</p>}{actionStatus && <p className="state">{actionStatus.startsWith("Approved Test") ? <><span>{actionStatus.split(": ")[0]}: </span><a href={actionStatus.slice(actionStatus.indexOf(": ") + 2)} target="_blank" rel="noreferrer">Open approved recovery link</a></> : actionStatus}</p>}<div className="actions intervention-actions">{["FAILED_PENDING_VERIFICATION", "RETRY_ELIGIBLE", "HARD_DECLINED", "AUTHORIZED"].includes(journey.state) && <button type="button" disabled={working} onClick={() => setPending("ENTER_MANUAL_REVIEW")}>Enter manual review</button>}{journey.state === "FAILED_PENDING_VERIFICATION" && <button type="button" disabled={working} onClick={() => setPending("APPROVE_RECOVERY")}>Approve recovery</button>}{journey.state === "RETRY_ELIGIBLE" && <button type="button" disabled={working} onClick={() => setPending("CREATE_PAYMENT_LINK")}>Request approved recovery</button>}</div>{pending && <div className="confirmation-card"><strong>{pending === "CREATE_PAYMENT_LINK" ? "Request a safety-approved Test Mode recovery?" : `${label(pending)}?`}</strong><p>{pending === "CREATE_PAYMENT_LINK" ? `RecoveryOS will evaluate the exact outstanding amount (${money(journey.outstandingAmount)}) and may create an approved payment link only if policy and safety permit it. No payment is charged automatically.` : "This consequential operator action is written to the immutable audit trail."}</p>{pending !== "CREATE_PAYMENT_LINK" && <label>Operator reason<input value={reason} onChange={event => setReason(event.target.value)} maxLength={500} placeholder="Why is this action required?" disabled={working} /></label>}<div className="actions"><button type="button" onClick={() => void confirmAction()} disabled={working}>{working ? "Applying action…" : "Confirm action"}</button><button type="button" onClick={() => { setPending(undefined); setReason(""); }} disabled={working}>Cancel</button></div></div>}</section>}

    <section className="panel"><div className="panel-heading"><div><p className="card-label">Evidence trail</p><h2>Provider events and audit evidence</h2></div><Link href="/evidence">Cross-journey evidence →</Link></div><div className="evidence-columns"><div><h3>Provider events</h3>{data.events.length ? data.events.map((event: any) => <div className="journey-row" key={event.id}><span>{label(event.type)}<small>{event.id}</small></span><strong>{time(event.receivedAt)}</strong></div>) : <p className="panel-footnote">No signed provider event has been linked to this journey.</p>}</div><div><h3>Audit trail</h3>{data.audits.length ? data.audits.map((audit: any) => <details className="audit-evidence" key={audit.id}><summary>{label(audit.eventType)} · {time(audit.createdAt)}</summary><p>{audit.reason ?? "No reason recorded."}</p><p>{audit.actor} · {audit.entityType} · {audit.action ?? "No action"}</p><details><summary>Technical evidence</summary><pre>{JSON.stringify({ previousState: audit.previousState, nextState: audit.nextState, evidence: audit.evidence }, null, 2)}</pre></details></details>) : <p className="panel-footnote">No audit evidence has been recorded.</p>}</div></div></section>
  </>;
}

function LifecycleTimeline({ journey, transitions, decisions, workflows, outcomes }: any) {
  const hasFailure = ["FAILED_PENDING_VERIFICATION", "RETRY_ELIGIBLE", "HARD_DECLINED", "MANUAL_REVIEW", "CAPTURED"].includes(journey.state) && transitions.some((item: any) => item.nextState === "FAILED_PENDING_VERIFICATION" || item.previousState === "FAILED_PENDING_VERIFICATION");
  const verified = journey.state !== "FAILED_PENDING_VERIFICATION" && hasFailure;
  const recoveryWorkflows = workflows.filter((workflow: any) => workflow.action !== "WAIT_AND_VERIFY");
  const steps = [
    ["Payment attempt received", "completed", journey.createdAt, "Provider event or payment attempt"],
    ["Payment failure received", hasFailure ? "completed" : "not applicable", transitions.find((item: any) => item.nextState === "FAILED_PENDING_VERIFICATION")?.occurredAt, "Signed provider event"],
    ["RecoveryOS verifies for late capture", journey.state === "FAILED_PENDING_VERIFICATION" ? "current" : hasFailure ? "completed" : "not applicable", workflows.find((workflow: any) => workflow.action === "WAIT_AND_VERIFY")?.scheduledAt, "Verification workflow"],
    ["Provider verification completed", verified ? "completed" : journey.state === "FAILED_PENDING_VERIFICATION" ? "waiting" : "not applicable", transitions.find((item: any) => item.nextState === "RETRY_ELIGIBLE" || item.nextState === "CAPTURED")?.occurredAt, "Provider result"],
    ["Journey became eligible for recovery", journey.state === "RETRY_ELIGIBLE" || decisions.length ? "completed" : journey.state === "CAPTURED" && hasFailure ? "skipped" : "not applicable", transitions.find((item: any) => item.nextState === "RETRY_ELIGIBLE")?.occurredAt, "State transition"],
    ["Recovery policy selected an action", decisions.length ? "completed" : journey.state === "RETRY_ELIGIBLE" ? "current" : "not applicable", decisions[0]?.createdAt, "Policy decision"],
    ["Safety checks allowed or blocked action", decisions.length ? "completed" : "not applicable", decisions[0]?.createdAt, "Safety evidence"],
    ["Concrete recovery action", recoveryWorkflows.length ? "completed" : decisions.length ? "waiting" : "not applicable", recoveryWorkflows[0]?.executedAt ?? recoveryWorkflows[0]?.scheduledAt, "Payment link or customer-facing handoff"],
    ["Outcome verified", outcomes.length || journey.state === "CAPTURED" ? "completed" : recoveryWorkflows.length ? "waiting" : "not applicable", outcomes[0]?.createdAt, "Provider outcome"],
  ];
  return <section className="panel lifecycle-panel"><div className="panel-heading"><div><p className="card-label">Lifecycle timeline</p><h2>What happened, what is current, and what comes next</h2></div></div><ol className="lifecycle-timeline">{steps.map(([name, status, occurredAt, evidence], index) => <li key={String(name)} className={`timeline-${status}`}><span>{index + 1}</span><div><strong>{name}</strong><p>{label(String(status))} · {evidence}</p></div><time>{time(occurredAt as string)}</time></li>)}</ol></section>;
}

function agentSummary(journey: any, decision: any, workflow: any, hasRecoveryLink: boolean) { const count = Array.isArray(decision.candidateActions) ? decision.candidateActions.length : Array.isArray(decision.policyEstimates) ? decision.policyEstimates.length : 0; const execution = hasRecoveryLink ? "created an exact-amount Test Mode recovery link that now awaits customer checkout" : workflow ? `recorded a ${label(workflow.status).toLowerCase()} workflow` : "has not created a workflow"; return `RecoveryOS detected ${label(journey.state).toLowerCase()}, evaluated ${count || "the persisted"} safety-permitted action${count === 1 ? "" : "s"}, selected ${label(decision.action)}, and ${execution}. Recovery is verified only after the linked Razorpay payment captures.`; }
function describeRecoveryAvailability(journey: any, data: any, decision: any, workflow: any) {
  const recordedBlock = data.audits.find((entry: any) => entry.eventType === "AUTONOMOUS_RECOVERY_SKIPPED" || entry.eventType === "AUTONOMOUS_RECOVERY_NOT_EXECUTED" || entry.eventType === "DUPLICATE_PREVENTED");
  if (["CAPTURED", "AUTHORIZED"].includes(journey.state)) return { availability: "Unavailable", reason: "A provider authorization or capture conflicts with another payment attempt.", next: "Wait for provider capture confirmation.", operatorAction: "None; duplicate-payment guard is active." };
  if (["CANCELLED", "EXPIRED"].includes(journey.state)) return { availability: "Unavailable", reason: "This terminal journey cannot be reopened by RecoveryOS.", next: "No automated recovery will run.", operatorAction: "None." };
  if (journey.state === "FAILED_PENDING_VERIFICATION") return { availability: "Waiting", reason: "Late provider authorization or capture must be checked first.", next: "Verification window completes.", operatorAction: "Enter manual review or stop recovery." };
  if (journey.state === "HARD_DECLINED") return { availability: "Safety-blocked", reason: "The provider reported a hard decline.", next: "An operator reviews the journey.", operatorAction: "Enter manual review." };
  if (recordedBlock) return { availability: "Safety-blocked", reason: recordedBlock.reason ?? "A recorded safety rule prevented recovery.", next: "Inspect linked audit evidence.", operatorAction: "Use only a state-permitted manual action." };
  const readyToken = data.tokens.find((token: any) => token.customerHandoffUrl && token.customerHandoffAvailable);
  if (readyToken) return { availability: "Executed", reason: "RecoveryOS created a safety-approved exact-amount Test Mode link.", next: "The customer completes the recovery checkout or the link expires.", operatorAction: "Open the recovery payment link or share it through an approved channel." };
  if (decision) return { availability: "Safety-allowed", reason: "A persisted decision passed deterministic safety checks.", next: workflow ? "Inspect whether a customer-facing recovery artifact was created." : "Create the controlled workflow.", operatorAction: "Review the workflow and outcome." };
  if (journey.state === "RETRY_ELIGIBLE" && !data.autonomousRecoveryEnabled) return { availability: "Unavailable", reason: "Autonomous recovery is disabled.", next: "An operator may review the safe manual path.", operatorAction: "Request approved recovery after confirmation." };
  if (journey.state === "RETRY_ELIGIBLE") return { availability: "Waiting", reason: "Provider verification completed, but no policy decision is persisted yet.", next: "Policy ranks safety-permitted actions when ready.", operatorAction: "Enter manual review or request approved recovery." };
  return { availability: "Not applicable", reason: "Recovery is not required at the current payment stage.", next: "Wait for a verified provider event.", operatorAction: "None." };
}
function Metric({ label, value }: { label: string; value: string }) { return <article className="metric-card"><p>{label}</p><strong>{value}</strong></article>; }
function Info({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><strong>{value}</strong></div>; }
function SafetyResults({ value }: { value: any }) { const results = value?.results ?? (value?.selected ? [value.selected] : []); return <div className="safety-results">{Array.isArray(results) && results.length ? results.map((result: any, index: number) => <p key={`${result.action}-${index}`}><strong>{label(result.action)}</strong> · {result.allowed ? "Safety-allowed" : "Safety-blocked"} · {result.reason ?? result.ruleId ?? "No reason recorded"}</p>) : <p>No persisted safety result is available.</p>}</div>; }
