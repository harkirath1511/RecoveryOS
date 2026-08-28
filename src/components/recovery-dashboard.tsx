import { detectPaymentIncident } from "@/lib/recovery/incident-detector";
import { chooseRulesAction } from "@/lib/recovery/rules-policy";
import { evaluateRecoveryAction, recoveryActions } from "@/lib/recovery/safety-policy";
import { simulatePaymentAttempts } from "@/lib/recovery/simulator";

const percent = (value: number) => `${(value * 100).toFixed(1)}%`;
const rupees = (paise: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(paise / 100);

export function RecoveryDashboard() {
  const attempts = simulatePaymentAttempts();
  const incident = detectPaymentIncident(attempts);
  if (!incident) throw new Error("The seeded demonstration scenario should detect an incident.");

  const affectedFailures = attempts.filter((attempt) =>
    attempt.period === "CURRENT" && attempt.provider === "HDFC" && attempt.method === "UPI" && attempt.device === "ANDROID" && !attempt.succeeded,
  );
  const averageAmount = affectedFailures.reduce((sum, attempt) => sum + attempt.amount, 0) / affectedFailures.length;
  const safetyContext = { journeyState: "RETRY_ELIGIBLE" as const, outstandingAmount: Math.round(averageAmount), automatedRecoveryActions: 0, maxAutomatedRecoveryActions: 2, hardDeclineDetected: false, hasConflictingFinancialState: false, lateAuthorizationGracePeriodActive: true };
  const allowed = recoveryActions.filter((action) => evaluateRecoveryAction(safetyContext, action).allowed);
  const decision = chooseRulesAction({ amount: safetyContext.outstandingAmount, attemptNumber: 1, minutesSinceFailure: 2, hourOfDay: 14, method: "UPI", provider: "HDFC", errorCode: "TIMEOUT", device: "ANDROID", activeIncident: true, downtimeSeverity: 2 }, allowed);
  const revenueAtRisk = Math.round(incident.topSegment.excessFailures * averageAmount);

  return <main className="dashboard-shell">
    <header className="topbar"><div><p className="eyebrow">RecoveryOS / command center</p><h1>Find the leak. Protect every recovery.</h1></div><span className="demo-badge">Synthetic simulator · seed 20260829</span></header>
    <section className="hero-grid" aria-label="Payment incident overview">
      <article className="incident-card"><p className="card-label">Active degradation</p><h2>Payment success is dropping</h2><p className="incident-copy">{incident.topSegment.label}</p><div className="rate-row"><div><span>Baseline</span><strong>{percent(incident.overallBaseline.successRate)}</strong></div><div><span>Current</span><strong className="danger">{percent(incident.overallCurrent.successRate)}</strong></div><div><span>Confidence</span><strong>{incident.topSegment.zScore.toFixed(1)}σ</strong></div></div></article>
      <article className="metric-card risk-card"><p className="card-label">Revenue at risk</p><strong>{rupees(revenueAtRisk)}</strong><p>Estimated from {incident.topSegment.excessFailures} excess failures in this synthetic window.</p></article>
      <article className="metric-card"><p className="card-label">Recovery guardrail</p><strong>Verify first</strong><p>Late authorisation grace period is active. New payment attempts remain blocked.</p></article>
    </section>
    <section className="main-grid">
      <article className="panel"><div className="panel-heading"><div><p className="card-label">Diagnosis</p><h2>Why this is happening</h2></div><span className="status-pill">High confidence</span></div><div className="cause-row"><span>Root cohort</span><strong>HDFC · UPI · Android</strong></div><div className="cause-row"><span>Dominant evidence</span><strong>Timeout failures</strong></div><div className="cause-row"><span>Success-rate drop</span><strong className="danger">{percent(incident.topSegment.successRateDrop)}</strong></div><p className="panel-footnote">Ranked statistically from baseline versus current payment cohorts. This is reproducible simulator evidence.</p></article>
      <article className="panel"><div className="panel-heading"><div><p className="card-label">Safe next step</p><h2>{decision.action.replaceAll("_", " ")}</h2></div><span className="safe-pill">Safety cleared</span></div><p className="action-explanation">{decision.reason} The deterministic safety engine permits only verification while a late capture may still arrive.</p><div className="allowed-list"><span>Permitted now</span><strong>{allowed.map((action) => action.replaceAll("_", " ")).join(" · ")}</strong></div></article>
    </section>
    <section className="audit-strip"><div><span>Directly recovered</span><strong>₹0</strong></div><div><span>Natural late captures</span><strong>₹0</strong></div><div><span>Unattributed captures</span><strong>₹0</strong></div><p>Demo environment only. No live money, real customer data, or automatic customer messaging.</p></section>
  </main>;
}
