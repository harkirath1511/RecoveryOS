import { after, NextResponse } from "next/server";
import { and, desc, eq, gte, inArray, lt } from "drizzle-orm";
import { requireOperator } from "@/lib/auth/session";
import { createDatabase } from "@/db/client";
import { banditStates, banditTrainingInteractions, downtimeSignals, incidents, paymentAttempts, paymentJourneys, recoveryDecisions } from "@/db/schema";
import { defaultIncidentDetectorConfig, detectPaymentIncident, type DetectablePaymentAttempt } from "@/lib/recovery/incident-detector";
import { env } from "@/lib/env";
import { evaluateRecoveryAction, isMoneyMovingRecoveryAction, recoveryActions } from "@/lib/recovery/safety-policy";
import { estimateRevenueAtRisk, type JourneyRecoveryEstimate } from "@/lib/recovery/revenue-at-risk";
import { restoreBanditState } from "@/lib/recovery/bandit-persistence";
import { rankLinUcbActions } from "@/lib/recovery/linucb";
import { encodeRecoveryContext } from "@/lib/recovery/policy-context";
import { executeAutonomousRecovery } from "@/app/api/recovery-links/route";

const currentWindowMs = 15 * 60_000;
const baselineWindowMs = 24 * 60 * 60_000;

export async function GET(request: Request) {
  const unauthorized = await requireOperator();
  if (unauthorized) return unauthorized;
  try {
  const database = createDatabase();
  const now = new Date();
  const currentStart = new Date(now.getTime() - currentWindowMs);
  const baselineStart = new Date(currentStart.getTime() - baselineWindowMs);
  const rows = await database.select({ id: paymentAttempts.id, method: paymentAttempts.method, provider: paymentAttempts.provider, deviceCategory: paymentAttempts.deviceCategory, errorCode: paymentAttempts.errorCode, status: paymentAttempts.status, receivedAt: paymentAttempts.receivedAt }).from(paymentAttempts).where(and(gte(paymentAttempts.receivedAt, baselineStart), lt(paymentAttempts.receivedAt, now)));
  const attempts = rows.map((row): DetectablePaymentAttempt => ({ id: row.id, method: row.method ?? "OTHER", provider: row.provider ?? "OTHER", device: row.deviceCategory ?? "OTHER", errorCode: row.errorCode ?? "NONE", succeeded: row.status === "captured" || row.status === "authorized", period: row.receivedAt >= currentStart ? "CURRENT" : "BASELINE" }));
  const incident = detectPaymentIncident(attempts);
  const includeRisk = new URL(request.url).searchParams.get("includeRisk") === "true";
  const revenueAtRisk = includeRisk ? await calculateRevenueAtRisk(database) : estimateRevenueAtRisk([], { baselineRecoveryProbability: env.RISK_NO_INTERVENTION_PROBABILITY, interventionCostPaise: env.RISK_INTERVENTION_COST_PAISE });
  if (!incident) {
    await closeResolvedIncidents(database, now);
    const history=await database.select().from(incidents).orderBy(desc(incidents.openedAt)).limit(100);
    return NextResponse.json({ incident: null, history, source: "REAL_PAYMENT_ATTEMPTS", windows: windowEvidence(baselineStart, currentStart, now), revenueAtRisk });
  }

  const [provider, method] = parseProviderAndMethod(incident.topSegment.key);
  const signals = await database.select().from(downtimeSignals).where(and(eq(downtimeSignals.status, "ACTIVE"), gte(downtimeSignals.observedAt, baselineStart))).orderBy(desc(downtimeSignals.observedAt));
  const corroboratingSignals = signals.filter((signal) => (!provider || !signal.provider || signal.provider === provider) && (!method || !signal.method || signal.method === method));
  const downtimeEvidence = { corroborated: corroboratingSignals.length > 0, signals: corroboratingSignals.map((signal) => ({ id: signal.id, source: signal.source, observedAt: signal.observedAt, evidence: signal.evidence })) };
  const dedupeKey = `REAL_PAYMENT_ATTEMPTS:${incident.topSegment.key}`;
  const [existing] = await database.select().from(incidents).where(and(eq(incidents.status, "OPEN"), eq(incidents.dedupeKey, dedupeKey))).limit(1);
  const calibration = { confidence: Math.min(0.99, Math.max(0, incident.topSegment.zScore / 6)), zScore: incident.topSegment.zScore, status: "STATISTICAL_GATING_ONLY" };
  const openedNow = !existing;
  const persisted = existing ?? (await database.insert(incidents).values({
    source: "REAL_PAYMENT_ATTEMPTS", status: "OPEN", cohortKey: incident.topSegment.key, dedupeKey,
    affectedSegment: incident.topSegment,
    baselineWindow: { ...incident.overallBaseline, startsAt: baselineStart.toISOString(), endsAt: currentStart.toISOString() },
    currentWindow: { ...incident.overallCurrent, startsAt: currentStart.toISOString(), endsAt: now.toISOString() },
    excessFailureContribution: incident.topSegment.excessFailures, confidence: String(incident.topSegment.zScore), calibration,
    riskAssumptions: revenueAtRisk.assumptions, downtimeEvidence,
    configurationSnapshot: { detector: defaultIncidentDetectorConfig, currentWindowMs, baselineWindowMs },
  }).returning())[0]!;
  // Incident detection is a read path used by the operator UI. Persist the
  // incident before responding, then run its bounded recovery fan-out after
  // the response so opening the screen is never held hostage by workflows.
  // The operator's read response must not contend with recovery workflows for
  // database connections. Next keeps this bounded task alive after responding.
  if (openedNow) after(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    await triggerIncidentRecovery(database, incident.topSegment.key);
  });
  const autonomousRecovery = openedNow ? { status: "QUEUED", triggerSource: "AUTONOMOUS_INCIDENT" } : [];
  const history=await database.select().from(incidents).orderBy(desc(incidents.openedAt)).limit(100);
  return NextResponse.json({ incident, incidentId: persisted.id, status: persisted.status, history, source: "REAL_PAYMENT_ATTEMPTS", windows: windowEvidence(baselineStart, currentStart, now), downtimeEvidence, calibration, revenueAtRisk, autonomousRecovery });
  } catch (error) {
    if (isDatabaseConnectivityError(error)) {
      console.warn("Incidents unavailable: database connection timed out.");
      return NextResponse.json({ error: "Payment evidence is temporarily unavailable because the database cannot be reached. Check the Neon connection and try again." }, { status: 503 });
    }
    console.error("Unable to load incidents.", error);
    return NextResponse.json({ error: "Unable to load incident evidence." }, { status: 500 });
  }
}

function isDatabaseConnectivityError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; cause?: unknown; errors?: unknown[] };
  if (candidate.code === "ETIMEDOUT" || candidate.code === "ECONNREFUSED" || candidate.code === "ENETUNREACH") return true;
  return isDatabaseConnectivityError(candidate.cause) || (Array.isArray(candidate.errors) && candidate.errors.some(isDatabaseConnectivityError));
}

function windowEvidence(baselineStart: Date, currentStart: Date, now: Date) { return { baseline: { startsAt: baselineStart.toISOString(), endsAt: currentStart.toISOString() }, current: { startsAt: currentStart.toISOString(), endsAt: now.toISOString() } }; }
function parseProviderAndMethod(key: string): [string | undefined, string | undefined] { const [, value = ""] = key.split(":"); const [provider, method] = value.split("|"); return [key.startsWith("provider") ? provider : undefined, key.includes("method") ? method : undefined]; }
async function closeResolvedIncidents(database: ReturnType<typeof createDatabase>, now: Date) { const open = await database.select().from(incidents).where(eq(incidents.status, "OPEN")); await Promise.all(open.filter((item) => item.source === "REAL_PAYMENT_ATTEMPTS").map((item) => database.update(incidents).set({ status: "RESOLVED", closedAt: now }).where(eq(incidents.id, item.id)))); }

async function triggerIncidentRecovery(database: ReturnType<typeof createDatabase>, cohortKey: string) {
  if (env.AUTONOMOUS_RECOVERY_ENABLED !== "true") return [];
  const candidates = await database.select().from(paymentJourneys).where(inArray(paymentJourneys.state, ["RETRY_ELIGIBLE", "FAILED_PENDING_VERIFICATION"])).limit(100);
  if (!candidates.length) return [];
  const candidateIds = candidates.map((candidate) => candidate.id);
  const attempts = await database.select({ journeyId: paymentAttempts.journeyId, provider: paymentAttempts.provider, method: paymentAttempts.method, device: paymentAttempts.deviceCategory, errorCode: paymentAttempts.errorCode, receivedAt: paymentAttempts.receivedAt }).from(paymentAttempts).where(inArray(paymentAttempts.journeyId, candidateIds));
  const latestByJourney = new Map<string, typeof attempts[number]>();
  for (const attempt of attempts) if (!latestByJourney.has(attempt.journeyId) || latestByJourney.get(attempt.journeyId)!.receivedAt < attempt.receivedAt) latestByJourney.set(attempt.journeyId, attempt);
  const affected = candidates.filter((journey) => matchesCohort(cohortKey, latestByJourney.get(journey.id), journey));
  return withConcurrency(affected, 4, (journey) => executeAutonomousRecovery({ journeyId: journey.id, triggerSource: "AUTONOMOUS_INCIDENT", synthetic: journey.razorpayOrderId?.startsWith("scenario:") === true }));
}

function matchesCohort(key: string, attempt: { provider: string | null; method: string | null; device: string | null; errorCode: string | null } | undefined, journey: typeof paymentJourneys.$inferSelect) {
  const value = key.slice(key.indexOf(":") + 1).split("|"); const kind = key.split(":", 1)[0];
  const provider = attempt?.provider ?? journey.provider; const method = attempt?.method ?? journey.paymentMethod; const device = attempt?.device ?? journey.deviceCategory; const error = attempt?.errorCode;
  if (kind === "provider") return provider === value[0]; if (kind === "method") return method === value[0]; if (kind === "device") return device === value[0]; if (kind === "error") return error === value[0];
  if (kind === "provider-method-device") return provider === value[0] && method === value[1] && device === value[2]; if (kind === "provider-error") return provider === value[0] && error === value[1]; return provider === value[0] && method === value[1];
}

async function withConcurrency<T, R>(items: T[], limit: number, work: (item: T) => Promise<R>) { const results: R[] = []; let index = 0; await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => { while (index < items.length) { const item = items[index++]; if (item) results.push(await work(item)); } })); return results; }

async function calculateRevenueAtRisk(database: ReturnType<typeof createDatabase>) {
  const eligible = await database.select().from(paymentJourneys).where(eq(paymentJourneys.state, "RETRY_ELIGIBLE"));
  if (!eligible.length) return estimateRevenueAtRisk([], { baselineRecoveryProbability: env.RISK_NO_INTERVENTION_PROBABILITY, interventionCostPaise: env.RISK_INTERVENTION_COST_PAISE });
  const journeyIds = eligible.map((journey) => journey.id);
  const [attemptRows, decisionRows, interactionRows, activeSignals, openIncidents, storedPolicy] = await Promise.all([
    database.select().from(paymentAttempts).where(inArray(paymentAttempts.journeyId, journeyIds)),
    database.select().from(recoveryDecisions).where(inArray(recoveryDecisions.journeyId, journeyIds)),
    database.select({ action: banditTrainingInteractions.action }).from(banditTrainingInteractions),
    database.select().from(downtimeSignals).where(eq(downtimeSignals.status, "ACTIVE")),
    database.select({ cohortKey: incidents.cohortKey }).from(incidents).where(eq(incidents.status, "OPEN")),
    database.select().from(banditStates).orderBy(desc(banditStates.updatedAt)).limit(1),
  ]);
  const policy = storedPolicy[0] ? restoreBanditState(JSON.stringify(storedPolicy[0].state)) : null;
  const attemptsByJourney = new Map<string, typeof attemptRows>();
  for (const attempt of attemptRows) attemptsByJourney.set(attempt.journeyId, [...(attemptsByJourney.get(attempt.journeyId) ?? []), attempt]);
  const decisionsByJourney = new Map<string, typeof decisionRows>();
  for (const decision of decisionRows) decisionsByJourney.set(decision.journeyId, [...(decisionsByJourney.get(decision.journeyId) ?? []), decision]);
  const estimates: JourneyRecoveryEstimate[] = [];
  for (const journey of eligible) {
    const journeyAttempts = attemptsByJourney.get(journey.id) ?? [];
    const latestAttempt = [...journeyAttempts].sort((left, right) => right.receivedAt.getTime() - left.receivedAt.getTime())[0];
    const journeyDecisions = decisionsByJourney.get(journey.id) ?? [];
    const minutesSinceFailure = latestAttempt ? Math.max(0, Math.floor((Date.now() - latestAttempt.receivedAt.getTime()) / 60_000)) : 0;
    const signalCount = activeSignals.filter((signal) => (!signal.provider || signal.provider === (latestAttempt?.provider ?? journey.provider)) && (!signal.method || signal.method === (latestAttempt?.method ?? journey.paymentMethod))).length;
    const activeIncident = openIncidents.some((incident) => incident.cohortKey.includes(latestAttempt?.provider ?? journey.provider ?? "") || incident.cohortKey.includes(latestAttempt?.method ?? journey.paymentMethod ?? ""));
    const context = { amount: journey.outstandingAmount, attemptNumber: journeyAttempts.length, minutesSinceFailure, hourOfDay: latestAttempt?.receivedAt.getUTCHours() ?? journey.updatedAt.getUTCHours(), method: latestAttempt?.method ?? journey.paymentMethod ?? "OTHER", provider: latestAttempt?.provider ?? journey.provider ?? "OTHER", errorCode: latestAttempt?.errorCode ?? "PAYMENT_FAILED", device: latestAttempt?.deviceCategory ?? journey.deviceCategory ?? "OTHER", activeIncident, downtimeSeverity: Math.min(2, signalCount) as 0 | 1 | 2 };
    const safeActions = recoveryActions.filter((action) => isMoneyMovingRecoveryAction(action) && evaluateRecoveryAction({ journeyState: "RETRY_ELIGIBLE", outstandingAmount: journey.outstandingAmount, automatedRecoveryActions: journeyDecisions.filter((decision) => isMoneyMovingRecoveryAction(decision.action as Parameters<typeof isMoneyMovingRecoveryAction>[0])).length, maxAutomatedRecoveryActions: env.MAX_AUTOMATED_RECOVERY_ACTIONS, hardDeclineDetected: journeyAttempts.some((attempt) => attempt.errorCode === "HARD_DECLINE"), hasConflictingFinancialState: journeyAttempts.some((attempt) => attempt.status === "captured" || attempt.status === "authorized"), lateAuthorizationGracePeriodActive: latestAttempt?.status === "authorized" }, action).allowed);
    const ranking = policy && safeActions.length ? rankLinUcbActions(policy, encodeRecoveryContext(context), safeActions, journey.outstandingAmount, env.LINUCB_ALPHA)[0] : null;
    const selectedAction = ranking?.action;
    estimates.push({ journeyId: journey.id, outstandingAmount: journey.outstandingAmount, baselineRecoveryProbability: env.RISK_NO_INTERVENTION_PROBABILITY, selectedRecoveryProbability: ranking?.predictedSuccess ?? env.RISK_NO_INTERVENTION_PROBABILITY, interventionCost: selectedAction ? env.RISK_INTERVENTION_COST_PAISE : 0, policySamples: selectedAction ? interactionRows.filter((interaction) => interaction.action === selectedAction).length : 0 });
  }
  return estimateRevenueAtRisk(estimates, { baselineRecoveryProbability: env.RISK_NO_INTERVENTION_PROBABILITY, interventionCostPaise: env.RISK_INTERVENTION_COST_PAISE });
}
