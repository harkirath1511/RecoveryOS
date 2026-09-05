import { and, count, desc, eq, inArray, isNull, notLike, or, sum } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createDatabase } from "@/db/client";
import { auditEntries, paymentJourneys, recoveryDecisions, recoveryOutcomes, recoveryWorkflows, webhookEvents } from "@/db/schema";
import { requireOperator } from "@/lib/auth/session";

const querySchema = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(10).max(100).default(25) });

export async function GET(request: Request) {
  const unauthorized = await requireOperator();
  if (unauthorized) return unauthorized;
  try {
    const input = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const database = createDatabase();
    const operationalJourney = or(isNull(paymentJourneys.razorpayOrderId), notLike(paymentJourneys.razorpayOrderId, "scenario:%"));
    const [journeyCount, eventCount, capturedCount, pendingCount, outcomeRows, workflows, workflowCount, stateRows, recentActivity, recentOutcome] = await Promise.all([
      database.select({ value: count() }).from(paymentJourneys).where(operationalJourney),
      database.select({ value: count() }).from(webhookEvents).innerJoin(paymentJourneys, eq(webhookEvents.journeyId, paymentJourneys.id)).where(operationalJourney),
      database.select({ value: count() }).from(paymentJourneys).where(and(eq(paymentJourneys.state, "CAPTURED"), operationalJourney)),
      database.select({ value: count() }).from(recoveryWorkflows).innerJoin(paymentJourneys, eq(recoveryWorkflows.journeyId, paymentJourneys.id)).where(and(eq(recoveryWorkflows.status, "PENDING"), operationalJourney)),
      database.select({ category: recoveryOutcomes.category, amount: sum(recoveryOutcomes.capturedAmount) }).from(recoveryOutcomes).innerJoin(paymentJourneys, eq(recoveryOutcomes.journeyId, paymentJourneys.id)).where(operationalJourney).groupBy(recoveryOutcomes.category),
      database.select().from(recoveryWorkflows).orderBy(desc(recoveryWorkflows.updatedAt)).limit(input.pageSize).offset((input.page - 1) * input.pageSize),
      database.select({ value: count() }).from(recoveryWorkflows),
      database.select({ state: paymentJourneys.state, value: count() }).from(paymentJourneys).where(operationalJourney).groupBy(paymentJourneys.state),
      database.select({ journeyId: auditEntries.journeyId, eventType: auditEntries.eventType, reason: auditEntries.reason, createdAt: auditEntries.createdAt, evidence: auditEntries.evidence }).from(auditEntries).innerJoin(paymentJourneys, eq(auditEntries.journeyId, paymentJourneys.id)).where(operationalJourney).orderBy(desc(auditEntries.createdAt)).limit(12),
      database.select({ category: recoveryOutcomes.category, createdAt: recoveryOutcomes.createdAt }).from(recoveryOutcomes).innerJoin(paymentJourneys, eq(recoveryOutcomes.journeyId, paymentJourneys.id)).where(operationalJourney).orderBy(desc(recoveryOutcomes.createdAt)).limit(1),
    ]);
    const journeyIds = [...new Set(workflows.map(workflow => workflow.journeyId))];
    const decisionIds = [...new Set(workflows.flatMap(workflow => workflow.decisionId ? [workflow.decisionId] : []))];
    const [workflowJourneys, workflowDecisions] = await Promise.all([
      journeyIds.length ? database.select({ id: paymentJourneys.id, orderId: paymentJourneys.razorpayOrderId }).from(paymentJourneys).where(inArray(paymentJourneys.id, journeyIds)) : [],
      decisionIds.length ? database.select({ id: recoveryDecisions.id, action: recoveryDecisions.action }).from(recoveryDecisions).where(inArray(recoveryDecisions.id, decisionIds)) : [],
    ]);
    const orderIdByJourney = new Map(workflowJourneys.map(journey => [journey.id, journey.orderId]));
    const actionByDecision = new Map(workflowDecisions.map(decision => [decision.id, decision.action]));
    const total = Number(workflowCount[0]?.value ?? 0);
    const totalPages = Math.max(1, Math.ceil(total / input.pageSize));
    return NextResponse.json({
      journeys: Number(journeyCount[0]?.value ?? 0),
      signedEvents: Number(eventCount[0]?.value ?? 0),
      capturedJourneys: Number(capturedCount[0]?.value ?? 0),
      pendingWorkflows: Number(pendingCount[0]?.value ?? 0),
      stateTotals: Object.fromEntries(stateRows.map(row => [row.state, Number(row.value)])),
      outcomeTotals: Object.fromEntries(outcomeRows.map(row => [row.category, Number(row.amount)])),
      recentOutcome: recentOutcome[0] ?? null,
      recentActivity,
      workflows: workflows.map(workflow => { const orderId = orderIdByJourney.get(workflow.journeyId) ?? null; return { ...workflow, orderId, source: orderId?.startsWith("scenario:") ? "SYNTHETIC" : "TEST_MODE", decisionAction: workflow.decisionId ? actionByDecision.get(workflow.decisionId) ?? null : null }; }),
      pagination: { page: Math.min(input.page, totalPages), pageSize: input.pageSize, total, totalPages },
    });
  } catch {
    return NextResponse.json({ error: "Recovery operations are temporarily unavailable because the database cannot be reached." }, { status: 503 });
  }
}
