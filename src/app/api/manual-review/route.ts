import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createDatabase } from "@/db/client";
import { paymentJourneys, recoveryWorkflows } from "@/db/schema";
import { requireOperator } from "@/lib/auth/session";
import { z } from "zod";
import { auditEntries } from "@/db/schema";
import { transitionPaymentJourney } from "@/lib/recovery/payment-journey";

const actionSchema = z.object({ journeyId: z.string().uuid(), action: z.enum(["ENTER_MANUAL_REVIEW", "APPROVE_RECOVERY", "STOP_RECOVERY"]), reason: z.string().min(3).max(500) });

export async function GET() {
  const unauthorized = await requireOperator();
  if (unauthorized) return unauthorized;
  try {
    const database = createDatabase();
    const journeys = await database.select({ id: paymentJourneys.id, orderId: paymentJourneys.razorpayOrderId, outstandingAmount: paymentJourneys.outstandingAmount, updatedAt: paymentJourneys.updatedAt }).from(paymentJourneys).where(eq(paymentJourneys.state, "MANUAL_REVIEW")).orderBy(desc(paymentJourneys.updatedAt)).limit(25);
    const queue = await Promise.all(journeys.map(async journey => ({ ...journey, workflows: await database.select({ action: recoveryWorkflows.action, status: recoveryWorkflows.status, terminalReason: recoveryWorkflows.terminalReason }).from(recoveryWorkflows).where(eq(recoveryWorkflows.journeyId, journey.id)) })));
    return NextResponse.json({ queue });
  } catch {
    return NextResponse.json({ queue: [] });
  }
}

export async function POST(request: Request) {
  const unauthorized = await requireOperator(); if (unauthorized) return unauthorized;
  try {
    const input = actionSchema.parse(await request.json()); const database = createDatabase();
    const [journey] = await database.select().from(paymentJourneys).where(eq(paymentJourneys.id, input.journeyId)).limit(1);
    if (!journey) return NextResponse.json({ applied: false, error: "Payment journey not found." }, { status: 404 });
    const event = input.action === "ENTER_MANUAL_REVIEW" ? "MANUAL_REVIEW_REQUIRED" : input.action === "APPROVE_RECOVERY" ? "VERIFICATION_EXPIRED" : null;
    const transition = event ? transitionPaymentJourney(journey.state, event) : { accepted: true as const, state: journey.state, reason: "Operator stopped recovery." };
    await database.transaction(async tx => { if (input.action === "STOP_RECOVERY") await tx.insert(recoveryWorkflows).values({ journeyId: journey.id, action: "STOP_RECOVERY", status: "STOPPED", terminalReason: "OPERATOR_STOPPED", executedAt: new Date() }); else if (transition.accepted) { await tx.update(paymentJourneys).set({ state: transition.state, updatedAt: new Date() }).where(eq(paymentJourneys.id, journey.id)); await tx.insert(recoveryWorkflows).values({ journeyId: journey.id, action: input.action === "ENTER_MANUAL_REVIEW" ? "MANUAL_REVIEW" : "WAIT_AND_VERIFY", status: input.action === "ENTER_MANUAL_REVIEW" ? "MANUAL_REVIEW" : "EXECUTED", terminalReason: input.action === "APPROVE_RECOVERY" ? "OPERATOR_APPROVED" : null, executedAt: new Date() }); } await tx.insert(auditEntries).values({ journeyId: journey.id, actor: "OPERATOR", entityType: "MANUAL_REVIEW", entityId: journey.id, action: input.action, eventType: transition.accepted ? "MANUAL_REVIEW_ACTION_APPLIED" : "MANUAL_REVIEW_ACTION_REJECTED", reason: input.reason, previousState: journey.state, nextState: transition.state, evidence: { action: input.action } }); });
    return NextResponse.json({ applied: transition.accepted, state: transition.state, reason: transition.reason }, { status: transition.accepted ? 200 : 409 });
  } catch (error) { return NextResponse.json({ applied: false, error: error instanceof Error ? error.message : "Manual-review action failed." }, { status: 400 }); }
}
