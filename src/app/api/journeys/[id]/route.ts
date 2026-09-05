import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createDatabase } from "@/db/client";
import { auditEntries, paymentAttempts, paymentJourneys, paymentStateTransitions, recoveryDecisions, recoveryOutcomes, recoveryTokens, recoveryWorkflows, webhookEvents } from "@/db/schema";
import { requireOperator } from "@/lib/auth/session";
import { env } from "@/lib/env";

const paramsSchema = z.object({ id: z.string().uuid() });
type RazorpayPayload = { payload?: { payment?: { entity?: { order_id?: string; payment_link_id?: string; amount?: number } } } };

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireOperator();
  if (unauthorized) return unauthorized;
  try {
    const { id } = paramsSchema.parse(await context.params);
    const database = createDatabase();
    const [journey] = await database.select().from(paymentJourneys).where(eq(paymentJourneys.id, id)).limit(1);
    if (!journey) return NextResponse.json({ error: "Journey not found." }, { status: 404 });
    const [tokens, workflows, decisions, outcomes, audits, rawEvents, attempts, transitions] = await Promise.all([
      database.select({ paymentLinkId: recoveryTokens.paymentLinkId, customerHandoffUrl: recoveryTokens.paymentLinkUrl, expiresAt: recoveryTokens.expiresAt, usedAt: recoveryTokens.usedAt }).from(recoveryTokens).where(eq(recoveryTokens.journeyId, id)),
      database.select({ id: recoveryWorkflows.id, action: recoveryWorkflows.action, status: recoveryWorkflows.status, scheduledAt: recoveryWorkflows.scheduledAt, executedAt: recoveryWorkflows.executedAt, expiresAt: recoveryWorkflows.expiresAt, createdAt: recoveryWorkflows.createdAt, terminalReason: recoveryWorkflows.terminalReason, qstashMessageId:recoveryWorkflows.qstashMessageId,idempotencyKey:recoveryWorkflows.idempotencyKey,externalResourceId:recoveryWorkflows.externalResourceId,attemptCount:recoveryWorkflows.attemptCount,cancelledAt:recoveryWorkflows.cancelledAt }).from(recoveryWorkflows).where(eq(recoveryWorkflows.journeyId, id)).orderBy(desc(recoveryWorkflows.createdAt)),
      database.select({ id: recoveryDecisions.id, action: recoveryDecisions.action, policy: recoveryDecisions.policy, triggerSource: recoveryDecisions.triggerSource, expectedRecoveryAmount: recoveryDecisions.expectedRecoveryAmount, predictedSuccess:recoveryDecisions.predictedSuccess, safety: recoveryDecisions.safety, safetyContext:recoveryDecisions.safetyContext, policyContext: recoveryDecisions.policyContext, candidateActions:recoveryDecisions.candidateActions,policyEstimates:recoveryDecisions.policyEstimates,decisionReason:recoveryDecisions.decisionReason,policyVersion:recoveryDecisions.policyVersion,createdAt: recoveryDecisions.createdAt }).from(recoveryDecisions).where(eq(recoveryDecisions.journeyId, id)).orderBy(desc(recoveryDecisions.createdAt)),
      database.select().from(recoveryOutcomes).where(eq(recoveryOutcomes.journeyId, id)).orderBy(desc(recoveryOutcomes.createdAt)),
      database.select({ id:auditEntries.id, actor:auditEntries.actor, entityType:auditEntries.entityType, entityId:auditEntries.entityId, action:auditEntries.action, eventType: auditEntries.eventType, reason:auditEntries.reason, previousState:auditEntries.previousState,nextState:auditEntries.nextState, createdAt: auditEntries.createdAt, evidence: auditEntries.evidence }).from(auditEntries).where(eq(auditEntries.journeyId, id)).orderBy(desc(auditEntries.createdAt)).limit(100),
      database.select({ id: webhookEvents.razorpayEventId, type: webhookEvents.eventType, receivedAt: webhookEvents.receivedAt, payload: webhookEvents.payload }).from(webhookEvents).orderBy(desc(webhookEvents.receivedAt)).limit(100),
      database.select({ id:paymentAttempts.id, providerPaymentId:paymentAttempts.providerPaymentId, providerOrderId:paymentAttempts.providerOrderId, status:paymentAttempts.status, errorCode:paymentAttempts.errorCode, errorReason:paymentAttempts.errorReason, method:paymentAttempts.method, provider:paymentAttempts.provider, device:paymentAttempts.deviceCategory, receivedAt:paymentAttempts.receivedAt }).from(paymentAttempts).where(eq(paymentAttempts.journeyId, id)).orderBy(desc(paymentAttempts.receivedAt)),
      database.select().from(paymentStateTransitions).where(eq(paymentStateTransitions.journeyId, id)).orderBy(desc(paymentStateTransitions.occurredAt)),
    ]);
    const paymentLinkIds = new Set(tokens.map(token => token.paymentLinkId).filter(Boolean));
    const events = rawEvents.flatMap(event => {
      const entity = (event.payload as RazorpayPayload).payload?.payment?.entity;
      if (!entity || (entity.order_id !== journey.razorpayOrderId && !paymentLinkIds.has(entity.payment_link_id ?? null))) return [];
      return [{ id: event.id, type: event.type, receivedAt: event.receivedAt, amount: entity.amount ?? null, orderId: entity.order_id ?? null }];
    });
    return NextResponse.json({ journey, events, attempts, transitions, tokens: tokens.map(token => ({ ...token, customerHandoffAvailable: !token.usedAt && token.expiresAt.getTime() > Date.now() })), workflows, decisions, outcomes, outcome: outcomes[0] ?? null, audits, autonomousRecoveryEnabled: env.AUTONOMOUS_RECOVERY_ENABLED === "true" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load journey detail." }, { status: 400 });
  }
}
