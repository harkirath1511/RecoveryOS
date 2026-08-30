import { NextResponse } from "next/server";
import { and, desc, eq, gte, lt } from "drizzle-orm";
import { requireOperator } from "@/lib/auth/session";
import { createDatabase } from "@/db/client";
import { banditTrainingInteractions, downtimeSignals, incidents, paymentAttempts, paymentJourneys, recoveryDecisions } from "@/db/schema";
import { defaultIncidentDetectorConfig, detectPaymentIncident, type DetectablePaymentAttempt } from "@/lib/recovery/incident-detector";
import { env } from "@/lib/env";
import { evaluateRecoveryAction, isMoneyMovingRecoveryAction, recoveryActions } from "@/lib/recovery/safety-policy";
import { selectLiveRecoveryAction } from "@/lib/recovery/live-policy";
import { estimateRevenueAtRisk, type JourneyRecoveryEstimate } from "@/lib/recovery/revenue-at-risk";

const currentWindowMs = 15 * 60_000;
const baselineWindowMs = 24 * 60 * 60_000;

export async function GET() {
  const unauthorized = await requireOperator();
  if (unauthorized) return unauthorized;
  const database = createDatabase();
  const now = new Date();
  const currentStart = new Date(now.getTime() - currentWindowMs);
  const baselineStart = new Date(currentStart.getTime() - baselineWindowMs);
  const rows = await database.select().from(paymentAttempts).where(and(gte(paymentAttempts.receivedAt, baselineStart), lt(paymentAttempts.receivedAt, now)));
  const attempts = rows.map((row): DetectablePaymentAttempt => ({ id: row.id, method: row.method ?? "OTHER", provider: row.provider ?? "OTHER", device: row.deviceCategory ?? "OTHER", errorCode: row.errorCode ?? "NONE", succeeded: row.status === "captured" || row.status === "authorized", period: row.receivedAt >= currentStart ? "CURRENT" : "BASELINE" }));
  const incident = detectPaymentIncident(attempts);
  const revenueAtRisk = await calculateRevenueAtRisk(database);
  if (!incident) {
    await closeResolvedIncidents(database, now);
    return NextResponse.json({ incident: null, source: "REAL_PAYMENT_ATTEMPTS", windows: windowEvidence(baselineStart, currentStart, now), revenueAtRisk });
  }

  const [provider, method] = parseProviderAndMethod(incident.topSegment.key);
  const signals = await database.select().from(downtimeSignals).where(and(eq(downtimeSignals.status, "ACTIVE"), gte(downtimeSignals.observedAt, baselineStart))).orderBy(desc(downtimeSignals.observedAt));
  const corroboratingSignals = signals.filter((signal) => (!provider || !signal.provider || signal.provider === provider) && (!method || !signal.method || signal.method === method));
  const downtimeEvidence = { corroborated: corroboratingSignals.length > 0, signals: corroboratingSignals.map((signal) => ({ id: signal.id, source: signal.source, observedAt: signal.observedAt, evidence: signal.evidence })) };
  const dedupeKey = `REAL_PAYMENT_ATTEMPTS:${incident.topSegment.key}`;
  const [existing] = await database.select().from(incidents).where(and(eq(incidents.status, "OPEN"), eq(incidents.dedupeKey, dedupeKey))).limit(1);
  const calibration = { confidence: Math.min(0.99, Math.max(0, incident.topSegment.zScore / 6)), zScore: incident.topSegment.zScore, status: "STATISTICAL_GATING_ONLY" };
  const persisted = existing ?? (await database.insert(incidents).values({
    source: "REAL_PAYMENT_ATTEMPTS", status: "OPEN", cohortKey: incident.topSegment.key, dedupeKey,
    affectedSegment: incident.topSegment,
    baselineWindow: { ...incident.overallBaseline, startsAt: baselineStart.toISOString(), endsAt: currentStart.toISOString() },
    currentWindow: { ...incident.overallCurrent, startsAt: currentStart.toISOString(), endsAt: now.toISOString() },
    excessFailureContribution: incident.topSegment.excessFailures, confidence: String(incident.topSegment.zScore), calibration,
    riskAssumptions: revenueAtRisk.assumptions, downtimeEvidence,
    configurationSnapshot: { detector: defaultIncidentDetectorConfig, currentWindowMs, baselineWindowMs },
  }).returning())[0]!;
  return NextResponse.json({ incident, incidentId: persisted.id, status: persisted.status, source: "REAL_PAYMENT_ATTEMPTS", windows: windowEvidence(baselineStart, currentStart, now), downtimeEvidence, calibration, revenueAtRisk });
}

function windowEvidence(baselineStart: Date, currentStart: Date, now: Date) { return { baseline: { startsAt: baselineStart.toISOString(), endsAt: currentStart.toISOString() }, current: { startsAt: currentStart.toISOString(), endsAt: now.toISOString() } }; }
function parseProviderAndMethod(key: string): [string | undefined, string | undefined] { const [, value = ""] = key.split(":"); const [provider, method] = value.split("|"); return [key.startsWith("provider") ? provider : undefined, key.includes("method") ? method : undefined]; }
async function closeResolvedIncidents(database: ReturnType<typeof createDatabase>, now: Date) { const open = await database.select().from(incidents).where(eq(incidents.status, "OPEN")); await Promise.all(open.filter((item) => item.source === "REAL_PAYMENT_ATTEMPTS").map((item) => database.update(incidents).set({ status: "RESOLVED", closedAt: now }).where(eq(incidents.id, item.id)))); }

async function calculateRevenueAtRisk(database: ReturnType<typeof createDatabase>) {
  const eligible = await database.select().from(paymentJourneys).where(eq(paymentJourneys.state, "RETRY_ELIGIBLE"));
  if (!eligible.length) return estimateRevenueAtRisk([], { baselineRecoveryProbability: env.RISK_NO_INTERVENTION_PROBABILITY, interventionCostPaise: env.RISK_INTERVENTION_COST_PAISE });
  const [attemptRows, decisionRows, interactionRows, activeSignals, openIncidents] = await Promise.all([
    database.select().from(paymentAttempts),
    database.select().from(recoveryDecisions),
    database.select({ action: banditTrainingInteractions.action }).from(banditTrainingInteractions),
    database.select().from(downtimeSignals).where(eq(downtimeSignals.status, "ACTIVE")),
    database.select({ cohortKey: incidents.cohortKey }).from(incidents).where(eq(incidents.status, "OPEN")),
  ]);
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
    const selection = safeActions.length ? await selectLiveRecoveryAction(database, context, safeActions, journey.outstandingAmount) : null;
    const selectedAction = selection?.ranking.action;
    estimates.push({ journeyId: journey.id, outstandingAmount: journey.outstandingAmount, baselineRecoveryProbability: env.RISK_NO_INTERVENTION_PROBABILITY, selectedRecoveryProbability: selection?.ranking.predictedSuccess ?? env.RISK_NO_INTERVENTION_PROBABILITY, interventionCost: selectedAction ? env.RISK_INTERVENTION_COST_PAISE : 0, policySamples: selectedAction ? interactionRows.filter((interaction) => interaction.action === selectedAction).length : 0 });
  }
  return estimateRevenueAtRisk(estimates, { baselineRecoveryProbability: env.RISK_NO_INTERVENTION_PROBABILITY, interventionCostPaise: env.RISK_INTERVENTION_COST_PAISE });
}
