"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- These read-only visualizations render several versioned internal JSON payloads; their server routes remain the typed contract. */

import Link from "next/link";
import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { LoadingState } from "./loading-state";
import { OperatorAssistant } from "./operator-assistant";
import { PolicyConsole } from "./policy-console";
import { EmptyState, Icon, SourceBadge, StatusBadge } from "./ui-primitives";
import { PaymentLedger } from "./payment-ledger";
import { EvidenceLedger } from "./evidence-ledger";
import { incidentPaymentFilters } from "@/lib/operator/incident-payment-filters";

const label = (value: string | null | undefined) => value?.replaceAll("_", " ") ?? "Not recorded";
const money = (value: number | null | undefined) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format((value ?? 0) / 100);
type Pagination = { page: number; pageSize: number; total: number; totalPages: number };

function useData<T>(url: string) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true); setError("");
      fetch(url, { cache: "no-store", signal: controller.signal }).then(async response => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error ?? "Evidence is temporarily unavailable.");
        setData(body);
      }).catch(cause => {
        if (!(cause instanceof DOMException && cause.name === "AbortError")) setError(cause instanceof Error ? cause.message : "Evidence is temporarily unavailable.");
      }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [url]);
  return { data, error, loading };
}

function useDebouncedValue<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => { const timer = window.setTimeout(() => setDebounced(value), delay); return () => window.clearTimeout(timer); }, [value, delay]);
  return debounced;
}

function Empty({ title, text }: { title: string; text: string }) { return <EmptyState title={title} text={text} />; }
function Metric({ title, value }: { title: string; value: string }) { return <div className="metric-card"><p>{title}</p><strong>{value}</strong></div>; }
function Pager({ pagination, loading, onPage }: { pagination?: Pagination; loading: boolean; onPage: (page: number) => void }) {
  if (!pagination || pagination.totalPages <= 1) return null;
  return <div className="pagination"><span>Page {pagination.page} of {pagination.totalPages} · {pagination.total} records</span><div className="actions"><button type="button" disabled={loading || pagination.page <= 1} onClick={() => onPage(pagination.page - 1)}>Previous</button><button type="button" disabled={loading || pagination.page >= pagination.totalPages} onClick={() => onPage(pagination.page + 1)}>Next</button></div></div>;
}

function affectedPaymentsUrl(cohortKey: string) {
  const params = new URLSearchParams(incidentPaymentFilters(cohortKey));
  return "/payments?" + params.toString();
}

export function IncidentsScreen() {
  const { data, error, loading } = useData<any>("/api/incidents");
  const rows = data?.history ?? [];
  return <><p className="source-note">Source: real payment evidence. Simulator incidents remain in Recovery Lab.</p>{error && <p className="state error-state">{error}</p>}<section className="panel"><div className="panel-heading"><div><p className="card-label">Incident register</p><h2>Open, resolved, and historical incidents</h2></div><StatusBadge tone={loading ? "info" : "neutral"}>{loading ? "Loading" : rows.length + " records"}</StatusBadge></div>{loading ? <LoadingState label="Loading incident evidence…" /> : rows.length ? <div className="table-wrap"><table><thead><tr><th>Status / source</th><th>Cohort / affected payments</th><th>Baseline → current</th><th>Confidence</th><th>Risk</th><th>Timeline</th></tr></thead><tbody>{rows.map((incident: any) => <tr key={incident.id}><td><StatusBadge>{label(incident.status)}</StatusBadge><small>{label(incident.source)}</small></td><td>{incident.affectedSegment?.label ?? incident.cohortKey}<small><Link href={affectedPaymentsUrl(incident.cohortKey)}>View matching payments →</Link></small></td><td>{((incident.baselineWindow?.successRate ?? 0) * 100).toFixed(1)}% → {((incident.currentWindow?.successRate ?? 0) * 100).toFixed(1)}%</td><td>{incident.calibration?.zScore?.toFixed?.(1) ?? incident.confidence}σ</td><td>{incident.excessFailureContribution} excess failures</td><td>{new Date(incident.openedAt).toLocaleString()}</td></tr>)}</tbody></table></div> : <Empty title="No incidents yet" text="The detector has not persisted an incident meeting its evidence gates." />}</section></>;
}

export type JourneyFilters = { query: string; state: string; provider: string; method: string; device: string; errorCode: string; workflow: string; outcome: string; balance: string; from: string; to: string; sort: string };
type JourneyRow = { id: string; orderId: string | null; providerPaymentId: string | null; state: string; outstandingAmount: number; provider: string | null; method: string | null; device: string | null; workflowStatus: string | null; outcomeCategory: string | null; updatedAt: string };
type JourneyResponse = { journeys: JourneyRow[]; facets: Record<"state" | "provider" | "method" | "device" | "workflow" | "outcome", string[]>; pagination: Pagination };
const defaultFilters: JourneyFilters = { query: "", state: "", provider: "", method: "", device: "", errorCode: "", workflow: "", outcome: "", balance: "", from: "", to: "", sort: "recent" };

function Select({ title, value, values, onChange }: { title: string; value: string; values: string[]; onChange: (event: ChangeEvent<HTMLSelectElement>) => void }) {
  return <label className="journey-filter"><span>{title}</span><select value={value} onChange={onChange}><option value="">All</option>{values.map(item => <option key={item} value={item}>{label(item)}</option>)}</select></label>;
}

// Retained temporarily while legacy routes are consolidated into PaymentLedger.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function LegacyJourneysScreen({ initialQuery = "", initialFilters = {} }: { initialQuery?: string; initialFilters?: Partial<JourneyFilters> }) {
  const [filters, setFilters] = useState<JourneyFilters>({ ...defaultFilters, ...initialFilters, query: initialQuery || initialFilters.query || "" });
  const [page, setPage] = useState(1);
  const debouncedQuery = useDebouncedValue(filters.query);
  const requestUrl = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: "25", ...filters, query: debouncedQuery });
    for (const [key, value] of [...params.entries()]) if (!value) params.delete(key);
    return "/api/journeys?" + params.toString();
  }, [debouncedQuery, filters, page]);
  const { data, error, loading } = useData<JourneyResponse>(requestUrl);
  const facets = data?.facets ?? { state: [], provider: [], method: [], device: [], workflow: [], outcome: [] };
  const update = (key: keyof JourneyFilters) => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { setPage(1); setFilters(current => ({ ...current, [key]: event.target.value })); };
  const rows = data?.journeys ?? [];
  return <>{error && <p className="state error-state">{error}</p>}<section className="panel journey-filter-panel"><div className="panel-heading"><div><p className="card-label">Universal payment search</p><h2>Find any payment journey</h2></div><div className="actions"><StatusBadge tone={loading ? "info" : "neutral"}>{data ? data.pagination.total + " matches" : "Searching…"}</StatusBadge><button type="button" className="text-button" onClick={() => { setFilters(defaultFilters); setPage(1); }}>Clear filters</button></div></div><div className="journey-filter-toolbar"><label className="journey-filter journey-filter-search"><span>Search a payment</span><input value={filters.query} onChange={update("query")} placeholder="Journey, order, payment, link, provider…" aria-label="Search payments" /><small>Server-side search runs after a short pause. Results preserve pagination, sorting, and all stored identifiers.</small></label><Select title="State" value={filters.state} values={facets.state} onChange={update("state")} /><Select title="Provider" value={filters.provider} values={facets.provider} onChange={update("provider")} /><Select title="Payment method" value={filters.method} values={facets.method} onChange={update("method")} /><Select title="Device" value={filters.device} values={facets.device} onChange={update("device")} /><label className="journey-filter"><span>Error code</span><input value={filters.errorCode} onChange={update("errorCode")} placeholder="Provider error code" /></label><label className="journey-filter"><span>From</span><input type="date" value={filters.from} onChange={update("from")} /></label><label className="journey-filter"><span>To</span><input type="date" value={filters.to} onChange={update("to")} /></label><Select title="Workflow status" value={filters.workflow} values={facets.workflow} onChange={update("workflow")} /><Select title="Outcome" value={filters.outcome} values={facets.outcome} onChange={update("outcome")} /><label className="journey-filter"><span>Outstanding balance</span><select value={filters.balance} onChange={update("balance")}><option value="">Any balance</option><option value="open">Outstanding</option><option value="settled">Settled</option></select></label><label className="journey-filter"><span>Sort</span><select value={filters.sort} onChange={update("sort")}><option value="recent">Most recently updated</option><option value="oldest">Least recently updated</option><option value="outstanding-high">Outstanding: high to low</option><option value="outstanding-low">Outstanding: low to high</option></select></label></div></section><section className="panel"><div className="panel-heading"><div><p className="card-label">Payment journeys</p><h2>Lifecycle and recovery status</h2></div><span className="source-legend"><SourceBadge>Test Mode</SourceBadge><SourceBadge synthetic>Synthetic</SourceBadge></span></div>{loading && !data ? <LoadingState label="Searching payment records…" /> : rows.length ? <><div className="table-wrap payment-table"><table><thead><tr><th>Journey / order</th><th>State</th><th>Outstanding</th><th>Provider / method / device</th><th>Workflow</th><th>Outcome</th><th>Updated</th></tr></thead><tbody>{rows.map(journey => { const synthetic = journey.orderId?.startsWith("scenario:") ?? false; return <tr key={journey.id} className={synthetic ? "synthetic-row" : ""}><td><Link href={"/journeys/" + journey.id}>{journey.orderId ?? journey.id}<small>{journey.providerPaymentId ?? "Provider payment ID not recorded"}</small></Link><SourceBadge synthetic={synthetic}>{synthetic ? "Synthetic" : "Test Mode"}</SourceBadge></td><td><StatusBadge>{label(journey.state)}</StatusBadge></td><td className="numeric-cell">{money(journey.outstandingAmount)}</td><td>{[journey.provider, journey.method, journey.device].filter(Boolean).join(" · ") || "Not recorded"}</td><td><StatusBadge>{label(journey.workflowStatus)}</StatusBadge></td><td><StatusBadge>{label(journey.outcomeCategory)}</StatusBadge></td><td>{new Date(journey.updatedAt).toLocaleString()}</td></tr>; })}</tbody></table></div><Pager pagination={data?.pagination} loading={loading} onPage={setPage} /></> : <><Empty title="No payment found" text="Try a Razorpay order ID, payment ID, journey UUID, payment-link ID, provider, error code, state, or merchant reference." /><p className="panel-footnote">A payment link that was created but never opened or paid is not shown as a failed payment: RecoveryOS creates a journey only after provider payment evidence arrives.</p></>}</section></>;
}

export function JourneysScreen({ initialQuery = "", initialFilters = {} }: { initialQuery?: string; initialFilters?: Partial<JourneyFilters> }) {
  return <PaymentLedger initialQuery={initialQuery} initialFilters={initialFilters} />;
}

type OperationsResponse = { journeys: number; signedEvents: number; capturedJourneys: number; pendingWorkflows: number; workflows: any[]; pagination?: Pagination };
export function OperationsScreen() {
  const [page, setPage] = useState(1);
  const { data, error, loading } = useData<OperationsResponse>("/api/operations?page=" + page + "&pageSize=25");
  const queues = [
    ["Pending verification", data?.workflows?.filter(item => item.status === "PENDING") ?? [], "warning"],
    ["Executing", data?.workflows?.filter(item => item.status === "EXECUTING") ?? [], "info"],
    ["Stopped", data?.workflows?.filter(item => item.status === "STOPPED") ?? [], "danger"],
    ["Manual review", data?.workflows?.filter(item => item.status === "MANUAL_REVIEW") ?? [], "warning"],
    ["Completed", data?.workflows?.filter(item => item.status === "EXECUTED" || item.status === "COMPLETED") ?? [], "success"],
  ] as const;
  return <><p className="source-note">Execution evidence is shown with explicit Test Mode or synthetic provenance. Lab benchmark amounts are never presented as merchant revenue.</p>{error && <p className="state error-state">{error}</p>}{loading && !data ? <section className="panel"><LoadingState label="Loading recovery operations…" /></section> : <><section className="summary-grid compact"><Metric title="Journeys" value={String(data?.journeys ?? "—")} /><Metric title="Signed events" value={String(data?.signedEvents ?? "—")} /><Metric title="Captured" value={String(data?.capturedJourneys ?? "—")} /><Metric title="Pending workflows" value={String(data?.pendingWorkflows ?? "—")} /></section><section className="queue-overview" aria-label="Recovery queue overview">{queues.map(([name, items, tone]) => <div key={name}><StatusBadge tone={tone}>{items.length}</StatusBadge><span>{name}</span></div>)}</section><section className="panel"><div className="panel-heading"><div><p className="card-label">Recovery workflows</p><h2>Ownership, state, and next action</h2></div><StatusBadge tone="neutral">Newest first</StatusBadge></div>{data?.workflows?.length ? <><div className="table-wrap"><table><thead><tr><th>Journey / source</th><th>Action / status</th><th>Owner / attempts</th><th>Schedule / execution</th><th>Next action</th><th>Terminal reason</th></tr></thead><tbody>{data.workflows.map(workflow => { const synthetic = workflow.orderId?.startsWith("scenario:") ?? false; const owner = workflow.status === "MANUAL_REVIEW" ? "Operator" : workflow.status === "PENDING" ? "RecoveryOS scheduler" : "RecoveryOS"; const next = workflow.status === "PENDING" ? "Await provider verification" : workflow.status === "MANUAL_REVIEW" ? "Review journey evidence" : workflow.status === "STOPPED" ? "No further action" : "Inspect verified outcome"; return <tr key={workflow.id} className={synthetic ? "synthetic-row" : ""}><td><Link href={"/journeys/" + workflow.journeyId}>{workflow.orderId ?? workflow.journeyId}</Link><SourceBadge synthetic={synthetic}>{synthetic ? "Synthetic" : "Test Mode"}</SourceBadge></td><td>{label(workflow.action)}<small><StatusBadge>{label(workflow.status)}</StatusBadge></small></td><td>{owner}<small>{workflow.attemptCount} attempt{workflow.attemptCount === 1 ? "" : "s"}</small></td><td>{workflow.scheduledAt ? new Date(workflow.scheduledAt).toLocaleString() : "—"}<small>{workflow.executedAt ? "Executed " + new Date(workflow.executedAt).toLocaleString() : "Not executed"}</small></td><td>{next}</td><td>{workflow.terminalReason ? label(workflow.terminalReason) : "—"}</td></tr>; })}</tbody></table></div><Pager pagination={data.pagination} loading={loading} onPage={setPage} /></> : <Empty title="No recovery workflows" text="There are no queued, executed, stopped, or review workflows yet." />}</section></>}</>;
}

type AuditEntry = { id: string; journeyId: string | null; eventType: string; actor: string; entityType: string; entityId: string; action: string | null; reason: string | null; evidence: Record<string, unknown>; previousState: string | null; nextState: string | null; createdAt: string };
type AuditResponse = { entries: AuditEntry[]; pagination: Pagination };
const auditCategories = ["Payment events", "State transitions", "Decisions", "Safety checks", "Workflows", "Outcomes", "Policy updates", "Manual actions", "Other evidence"] as const;
function auditCategory(entry: AuditEntry) {
  if (entry.eventType.includes("PAYMENT") || entry.eventType.includes("WEBHOOK") || entry.eventType.includes("CAPTURE")) return "Payment events";
  if (entry.previousState || entry.nextState) return "State transitions";
  if (entry.eventType.includes("SAFETY") || entry.eventType.includes("DUPLICATE")) return "Safety checks";
  if (entry.eventType.includes("WORKFLOW") || entry.eventType.includes("VERIFICATION") || entry.eventType.includes("RECOVERY_LINK")) return "Workflows";
  if (entry.eventType.includes("OUTCOME") || entry.eventType.includes("ATTRIBUTE")) return "Outcomes";
  if (entry.eventType.includes("LINUCB") || entry.eventType.includes("POLICY")) return "Policy updates";
  if (entry.eventType.includes("MANUAL")) return "Manual actions";
  if (entry.entityType === "DECISION" || entry.eventType.includes("DECISION")) return "Decisions";
  return "Other evidence";
}

function AuditRow({ entry }: { entry: AuditEntry }) { return <article className="audit-entry"><div><span className="audit-event-heading"><StatusBadge>{auditCategory(entry)}</StatusBadge><strong>{label(entry.eventType)}</strong></span><p>{entry.actor} · {entry.entityType} · {entry.action ?? "No action"}</p><p>{entry.reason ?? "No reason recorded."}</p></div><div><time>{new Date(entry.createdAt).toLocaleString()}</time>{entry.journeyId && <Link href={"/journeys/" + entry.journeyId}>Open journey <Icon name="arrow" /></Link>}</div><details><summary>Raw technical evidence</summary><pre>{JSON.stringify({ previousState: entry.previousState, nextState: entry.nextState, evidence: entry.evidence, entityId: entry.entityId }, null, 2)}</pre></details></article>; }

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function LegacyAuditScreen() {
  const [page, setPage] = useState(1);
  const { data, error, loading } = useData<AuditResponse>("/api/audit?page=" + page + "&pageSize=50");
  const groups = useMemo(() => {
    const grouped = new Map<string, { journeyId: string | null; entries: AuditEntry[] }>();
    for (const entry of data?.entries ?? []) { const key = entry.journeyId ?? "unlinked"; const group = grouped.get(key) ?? { journeyId: entry.journeyId, entries: [] }; group.entries.push(entry); grouped.set(key, group); }
    return [...grouped.values()];
  }, [data?.entries]);
  return <>{error && <p className="state error-state">{error}</p>}<section className="panel"><div className="panel-heading"><div><p className="card-label">Immutable audit evidence</p><h2>Trace decisions to payment truth</h2><p className="panel-footnote">Evidence is grouped by journey and lifecycle category. Technical JSON remains behind a secondary disclosure.</p></div><span className="safe-pill">Append-only</span></div>{loading && !data ? <LoadingState label="Loading immutable audit evidence…" /> : groups.length ? <><div className="audit-groups">{groups.map(group => { const latest = group.entries[0]!; const categorized = group.entries.reduce<Record<string, AuditEntry[]>>((all, entry) => { const category = auditCategory(entry); (all[category] ??= []).push(entry); return all; }, {}); return <details className="audit-journey-group" key={group.journeyId ?? "unlinked"}><summary><div><strong>{group.journeyId ?? "System / unlinked evidence"}</strong><p>{group.entries.length} audit entries · Latest: {label(latest.eventType)}</p></div><time>{new Date(latest.createdAt).toLocaleString()}</time></summary><div className="audit-list">{group.journeyId && <p className="audit-group-link"><Link href={"/journeys/" + group.journeyId}>Open this journey →</Link></p>}{auditCategories.map(category => { const entries = categorized[category]; return entries?.length ? <details className="audit-category" key={category}><summary>{category} ({entries.length})</summary>{entries.map((entry: AuditEntry) => <AuditRow entry={entry} key={entry.id} />)}</details> : null; })}</div></details>; })}</div><Pager pagination={data?.pagination} loading={loading} onPage={setPage} /></> : <Empty title="No audit entries" text="Accepted, ignored, conflicting, and execution events will appear here." />}</section></>;
}

export function AuditScreen() { return <EvidenceLedger />; }

export function ManualReviewScreen() {
  const { data, error, loading } = useData<any>("/api/manual-review");
  return <>{error && <p className="state error-state">{error}</p>}<section className="panel"><div className="panel-heading"><div><p className="card-label">Manual review queue</p><h2>Operator-required payment conflicts</h2></div><span className="status-pill">No auto-approval</span></div><p className="panel-footnote">Open a journey to see provider state, safety evidence, current workflows, and confirmed intervention controls. The queue itself never applies a recovery action.</p>{loading ? <LoadingState label="Loading manual-review queue…" /> : data?.queue?.length ? <div className="audit-list">{data.queue.map((journey: any) => <article className="audit-entry" key={journey.id}><div><strong><Link href={"/journeys/" + journey.id}>{journey.orderId ?? journey.id}</Link></strong><p>Outstanding: {money(journey.outstandingAmount)} · Latest provider state requires a human decision.</p><p>{journey.workflows.map((workflow: any) => label(workflow.action) + " (" + label(workflow.status) + ")").join(", ") || "No workflow evidence"}</p></div><div className="actions"><Link className="recovery-button" href={"/journeys/" + journey.id}>Review journey →</Link></div></article>)}</div> : <Empty title="Queue is clear" text="Hard declines and conflicting financial states are never auto-approved." />}</section></>;
}

export function RecoveryScreen() { return <><section className="panel recovery-guide"><div className="panel-heading"><div><p className="card-label">Recovery workspace</p><h2>Recovery activity, queues, and policy context</h2></div><Link href="/incidents">Incident evidence →</Link></div><p className="panel-footnote">Use this area to understand RecoveryOS across payments. Individual actions remain in Journey Detail, where original payment state and safety evidence stay together.</p><div className="workflow-guide"><div><strong>1. Verify</strong><p>Never create a recovery path while capture is uncertain.</p></div><div><strong>2. Gate</strong><p>Safety gates decide whether a recovery link may be created. A policy rank cannot authorize it.</p></div><div><strong>3. Handoff</strong><p>When permitted, RecoveryOS creates one exact-amount Razorpay Test Mode payment link. It never charges or contacts the customer; capture is verified later.</p></div></div></section><OperationsScreen /><ManualReviewScreen /><section className="panel"><div className="panel-heading"><div><p className="card-label">Policy context</p><h2>Synthetic policy diagnostics</h2></div><span className="safe-pill">Secondary tool</span></div><p className="panel-footnote">Diagnostic rankings never forecast recovered revenue or override deterministic safety gates.</p><PolicyConsole /></section></>; }
export function EvidenceScreen() { return <><section className="panel recovery-guide"><div className="panel-heading"><div><p className="card-label">How RecoveryOS works</p><h2>A factual operator guide</h2></div><span className="safe-pill">Evidence first</span></div><ol className="how-it-works"><li>A verified payment failure is received.</li><li>RecoveryOS opens a late-capture verification window; it does not immediately retry or charge.</li><li>Provider evidence either confirms capture or the journey becomes recovery eligible.</li><li>Safety gates determine whether one exact-amount recovery link may be created; a policy rank cannot authorize it.</li><li>When permitted, RecoveryOS creates one Razorpay Test Mode payment link. It never charges or contacts the customer; only a later provider capture is verified and attributed.</li><li>Operators can intervene where the state machine permits it.</li></ol></section><AuditScreen /><section className="panel"><div className="panel-heading"><div><p className="card-label">Evidence questions</p><h2>Ask about stored records</h2></div><span className="safe-pill">Read-only</span></div><OperatorAssistant /></section></>; }
