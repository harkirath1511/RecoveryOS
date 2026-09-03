import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOperator } from "@/lib/auth/session";
import { createDatabase } from "@/db/client";
import { auditEntries, incidents, paymentAttempts, paymentJourneys, paymentStateTransitions, recoveryDecisions, recoveryOutcomes, recoveryWorkflows } from "@/db/schema";
import { answerOperatorQuestion, type OperatorCitation } from "@/lib/groq/operator-assistant";

const requestSchema = z.object({
  question: z.string().trim().min(3).max(1_000),
  journey: z.string().trim().min(1).max(220).optional(),
  incidentId: z.string().uuid().optional(),
});
type CollectedEvidence = { scope: string; payload: Record<string, unknown>; citations: OperatorCitation[] };

export async function POST(request: Request) {
  const unauthorized = await requireOperator();
  if (unauthorized) return unauthorized;
  try {
    const input = requestSchema.parse(await request.json());
    const database = createDatabase();
    const evidence = await collectEvidence(database, input);
    if (!evidence.citations.length) return NextResponse.json({ error: "No stored evidence matched that payment or incident." }, { status: 404 });
    const result = await answerOperatorQuestion({ question: input.question, evidence: evidence.payload, citations: evidence.citations });
    return NextResponse.json({ ...result, scope: evidence.scope, evidenceCount: evidence.citations.length });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Operator assistant is unavailable." }, { status: 400 });
  }
}

async function collectEvidence(database: ReturnType<typeof createDatabase>, input: z.infer<typeof requestSchema>): Promise<CollectedEvidence> {
  if (input.journey) return journeyEvidence(database, input.journey);
  if (input.incidentId) return incidentEvidence(database, input.incidentId);
  return commandCenterEvidence(database);
}

async function journeyEvidence(database: ReturnType<typeof createDatabase>, reference: string): Promise<CollectedEvidence> {
  const isUuid = z.string().uuid().safeParse(reference).success;
  const [journey] = await database.select({ id: paymentJourneys.id, orderId: paymentJourneys.razorpayOrderId, state: paymentJourneys.state, originalAmount: paymentJourneys.originalAmount, outstandingAmount: paymentJourneys.outstandingAmount, currency: paymentJourneys.currency, provider: paymentJourneys.provider, method: paymentJourneys.paymentMethod, device: paymentJourneys.deviceCategory, terminalOutcome: paymentJourneys.terminalOutcome, createdAt: paymentJourneys.createdAt }).from(paymentJourneys).where(isUuid ? eq(paymentJourneys.id, reference) : eq(paymentJourneys.razorpayOrderId, reference)).limit(1);
  if (!journey) return emptyEvidence("JOURNEY");
  const [attempts, transitions, decisions, workflows, outcomes, audits] = await Promise.all([
    database.select({ id: paymentAttempts.id, status: paymentAttempts.status, provider: paymentAttempts.provider, method: paymentAttempts.method, errorCode: paymentAttempts.errorCode, receivedAt: paymentAttempts.receivedAt, providerOccurredAt: paymentAttempts.providerOccurredAt }).from(paymentAttempts).where(eq(paymentAttempts.journeyId, journey.id)).orderBy(desc(paymentAttempts.receivedAt)).limit(12),
    database.select({ id: paymentStateTransitions.id, previousState: paymentStateTransitions.previousState, nextState: paymentStateTransitions.nextState, accepted: paymentStateTransitions.accepted, reason: paymentStateTransitions.reason, occurredAt: paymentStateTransitions.occurredAt }).from(paymentStateTransitions).where(eq(paymentStateTransitions.journeyId, journey.id)).orderBy(desc(paymentStateTransitions.occurredAt)).limit(16),
    database.select({ id: recoveryDecisions.id, action: recoveryDecisions.action, policy: recoveryDecisions.policy, triggerSource: recoveryDecisions.triggerSource, decisionReason: recoveryDecisions.decisionReason, predictedSuccess: recoveryDecisions.predictedSuccess, expectedRecoveryAmount: recoveryDecisions.expectedRecoveryAmount, safety: recoveryDecisions.safety, createdAt: recoveryDecisions.createdAt }).from(recoveryDecisions).where(eq(recoveryDecisions.journeyId, journey.id)).orderBy(desc(recoveryDecisions.createdAt)).limit(8),
    database.select({ id: recoveryWorkflows.id, action: recoveryWorkflows.action, status: recoveryWorkflows.status, terminalReason: recoveryWorkflows.terminalReason, externalResourceId: recoveryWorkflows.externalResourceId, executedAt: recoveryWorkflows.executedAt, expiresAt: recoveryWorkflows.expiresAt }).from(recoveryWorkflows).where(eq(recoveryWorkflows.journeyId, journey.id)).orderBy(desc(recoveryWorkflows.updatedAt)).limit(12),
    database.select({ id: recoveryOutcomes.id, category: recoveryOutcomes.category, capturedAmount: recoveryOutcomes.capturedAmount, expectedRecoveryAmount: recoveryOutcomes.expectedRecoveryAmount, createdAt: recoveryOutcomes.createdAt }).from(recoveryOutcomes).where(eq(recoveryOutcomes.journeyId, journey.id)).orderBy(desc(recoveryOutcomes.createdAt)).limit(12),
    database.select({ id: auditEntries.id, eventType: auditEntries.eventType, action: auditEntries.action, reason: auditEntries.reason, previousState: auditEntries.previousState, nextState: auditEntries.nextState, createdAt: auditEntries.createdAt }).from(auditEntries).where(eq(auditEntries.journeyId, journey.id)).orderBy(desc(auditEntries.createdAt)).limit(16),
  ]);
  const citations: OperatorCitation[] = [
    { type: "JOURNEY", id: journey.id, claim: `Journey ${journey.orderId ?? journey.id} is ${journey.state} with ${journey.outstandingAmount} ${journey.currency} outstanding.` },
    ...attempts.map((item) => ({ type: "ATTEMPT" as const, id: item.id, claim: `Payment attempt status ${item.status}${item.errorCode ? `; error ${item.errorCode}` : ""}.` })),
    ...transitions.map((item) => ({ type: "TRANSITION" as const, id: item.id, claim: `${item.previousState} → ${item.nextState}: ${item.reason}` })),
    ...decisions.map((item) => ({ type: "DECISION" as const, id: item.id, claim: `${item.action} selected by ${item.policy} via ${item.triggerSource}.` })),
    ...workflows.map((item) => ({ type: "WORKFLOW" as const, id: item.id, claim: `${item.action} workflow is ${item.status}${item.terminalReason ? `; ${item.terminalReason}` : ""}.` })),
    ...outcomes.map((item) => ({ type: "OUTCOME" as const, id: item.id, claim: `${item.category} outcome recorded for ${item.capturedAmount}.` })),
    ...audits.map((item) => ({ type: "AUDIT" as const, id: item.id, claim: `${item.eventType}: ${item.reason ?? "stored audit event"}.` })),
  ];
  return { scope: "JOURNEY", payload: { journey, attempts, transitions, decisions, workflows, outcomes, audits }, citations };
}

async function incidentEvidence(database: ReturnType<typeof createDatabase>, incidentId: string): Promise<CollectedEvidence> {
  const [incident] = await database.select({ id: incidents.id, status: incidents.status, cohortKey: incidents.cohortKey, affectedSegment: incidents.affectedSegment, baselineWindow: incidents.baselineWindow, currentWindow: incidents.currentWindow, excessFailureContribution: incidents.excessFailureContribution, calibration: incidents.calibration, downtimeEvidence: incidents.downtimeEvidence, openedAt: incidents.openedAt, closedAt: incidents.closedAt }).from(incidents).where(eq(incidents.id, incidentId)).limit(1);
  if (!incident) return emptyEvidence("INCIDENT");
  const audits = await database.select({ id: auditEntries.id, eventType: auditEntries.eventType, reason: auditEntries.reason, createdAt: auditEntries.createdAt }).from(auditEntries).orderBy(desc(auditEntries.createdAt)).limit(12);
  return { scope: "INCIDENT", payload: { incident, audits }, citations: [{ type: "INCIDENT", id: incident.id, claim: `${incident.status} incident for ${incident.cohortKey}; ${incident.excessFailureContribution} excess failures.` }, ...audits.map((item) => ({ type: "AUDIT" as const, id: item.id, claim: `${item.eventType}: ${item.reason ?? "stored audit event"}.` }))] };
}

async function commandCenterEvidence(database: ReturnType<typeof createDatabase>): Promise<CollectedEvidence> {
  const [openIncidents, journeys, decisions, audits] = await Promise.all([
    queryOrEmpty(database.select({ id: incidents.id, status: incidents.status, cohortKey: incidents.cohortKey, excessFailureContribution: incidents.excessFailureContribution, openedAt: incidents.openedAt }).from(incidents).where(eq(incidents.status, "OPEN")).orderBy(desc(incidents.openedAt)).limit(3)),
    queryOrEmpty(database.select({ id: paymentJourneys.id, orderId: paymentJourneys.razorpayOrderId, state: paymentJourneys.state, outstandingAmount: paymentJourneys.outstandingAmount, currency: paymentJourneys.currency, createdAt: paymentJourneys.createdAt }).from(paymentJourneys).orderBy(desc(paymentJourneys.createdAt)).limit(8)),
    queryOrEmpty(database.select({ id: recoveryDecisions.id, journeyId: recoveryDecisions.journeyId, action: recoveryDecisions.action, triggerSource: recoveryDecisions.triggerSource, createdAt: recoveryDecisions.createdAt }).from(recoveryDecisions).orderBy(desc(recoveryDecisions.createdAt)).limit(8)),
    queryOrEmpty(database.select({ id: auditEntries.id, eventType: auditEntries.eventType, reason: auditEntries.reason, createdAt: auditEntries.createdAt }).from(auditEntries).orderBy(desc(auditEntries.createdAt)).limit(10)),
  ]);
  const citations: OperatorCitation[] = [
    ...openIncidents.map((item) => ({ type: "INCIDENT" as const, id: item.id, claim: `${item.status} incident for ${item.cohortKey}; ${item.excessFailureContribution} excess failures.` })),
    ...journeys.map((item) => ({ type: "JOURNEY" as const, id: item.id, claim: `${item.orderId ?? item.id} is ${item.state} with ${item.outstandingAmount} ${item.currency} outstanding.` })),
    ...decisions.map((item) => ({ type: "DECISION" as const, id: item.id, claim: `${item.action} selected via ${item.triggerSource}.` })),
    ...audits.map((item) => ({ type: "AUDIT" as const, id: item.id, claim: `${item.eventType}: ${item.reason ?? "stored audit event"}.` })),
  ];
  return { scope: "COMMAND_CENTER", payload: { openIncidents, journeys, decisions, audits }, citations };
}

function emptyEvidence(scope: string): CollectedEvidence {
  return { scope, payload: {}, citations: [] as OperatorCitation[] };
}

async function queryOrEmpty<T>(query: Promise<T[]>): Promise<T[]> {
  try {
    return await query;
  } catch {
    // Command-center context is composed from independent, read-only evidence
    // sources. A temporarily unavailable optional source must not prevent
    // answers grounded in the remaining sources.
    return [];
  }
}
