import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createDatabase } from "@/db/client";
import { auditEntries, paymentJourneys, recoveryDecisions, recoveryOutcomes, recoveryTokens, recoveryWorkflows, webhookEvents } from "@/db/schema";
import { requireOperator } from "@/lib/auth/session";

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
    const [tokens, workflows, decisions, outcomes, audits, rawEvents] = await Promise.all([
      database.select({ paymentLinkId: recoveryTokens.paymentLinkId }).from(recoveryTokens).where(eq(recoveryTokens.journeyId, id)),
      database.select({ id: recoveryWorkflows.id, action: recoveryWorkflows.action, status: recoveryWorkflows.status, scheduledAt: recoveryWorkflows.scheduledAt, executedAt: recoveryWorkflows.executedAt, terminalReason: recoveryWorkflows.terminalReason }).from(recoveryWorkflows).where(eq(recoveryWorkflows.journeyId, id)).orderBy(desc(recoveryWorkflows.createdAt)),
      database.select({ id: recoveryDecisions.id, action: recoveryDecisions.action, policy: recoveryDecisions.policy, expectedRecoveryAmount: recoveryDecisions.expectedRecoveryAmount, safety: recoveryDecisions.safety, createdAt: recoveryDecisions.createdAt }).from(recoveryDecisions).where(eq(recoveryDecisions.journeyId, id)).orderBy(desc(recoveryDecisions.createdAt)),
      database.select().from(recoveryOutcomes).where(eq(recoveryOutcomes.journeyId, id)).limit(1),
      database.select({ eventType: auditEntries.eventType, createdAt: auditEntries.createdAt, evidence: auditEntries.evidence }).from(auditEntries).where(eq(auditEntries.entityId, id)).orderBy(desc(auditEntries.createdAt)).limit(50),
      database.select({ id: webhookEvents.razorpayEventId, type: webhookEvents.eventType, receivedAt: webhookEvents.receivedAt, payload: webhookEvents.payload }).from(webhookEvents).orderBy(desc(webhookEvents.receivedAt)).limit(100),
    ]);
    const paymentLinkIds = new Set(tokens.map(token => token.paymentLinkId).filter(Boolean));
    const events = rawEvents.flatMap(event => {
      const entity = (event.payload as RazorpayPayload).payload?.payment?.entity;
      if (!entity || (entity.order_id !== journey.razorpayOrderId && !paymentLinkIds.has(entity.payment_link_id ?? null))) return [];
      return [{ id: event.id, type: event.type, receivedAt: event.receivedAt, amount: entity.amount ?? null, orderId: entity.order_id ?? null }];
    });
    return NextResponse.json({ journey, events, workflows, decisions, outcome: outcomes[0] ?? null, audits });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load journey detail." }, { status: 400 });
  }
}
