import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createDatabase } from "@/db/client";
import { auditEntries, paymentJourneys, recoveryDecisions, recoveryTokens } from "@/db/schema";
import { requireOperator } from "@/lib/auth/session";
import { createExactAmountTestLink } from "@/lib/razorpay/client";
import { evaluateRecoveryAction } from "@/lib/recovery/safety-policy";

const requestSchema = z.object({
  journeyId: z.string().uuid(),
  customer: z.object({ name: z.string().min(1).optional(), email: z.string().email().optional(), contact: z.string().min(8).optional() }),
  referenceId: z.string().min(1).max(40),
});

export async function POST(request: Request) {
  try {
    const unauthorized = await requireOperator(); if (unauthorized) return unauthorized;
    const input = requestSchema.parse(await request.json());
    const database = createDatabase();
    const [journey] = await database.select().from(paymentJourneys).where(eq(paymentJourneys.id, input.journeyId)).limit(1);
    if (!journey) return NextResponse.json({ created: false, error: "Payment journey not found." }, { status: 404 });
    const priorActions = await database.select({ id: recoveryDecisions.id }).from(recoveryDecisions).where(and(eq(recoveryDecisions.journeyId, journey.id), eq(recoveryDecisions.action, "CREATE_PAYMENT_LINK")));
    const safety = evaluateRecoveryAction({ journeyState: journey.state, outstandingAmount: journey.outstandingAmount, requestedAmount: journey.outstandingAmount, automatedRecoveryActions: priorActions.length, maxAutomatedRecoveryActions: 2, hardDeclineDetected: journey.state === "HARD_DECLINED", hasConflictingFinancialState: journey.state === "CAPTURED" || journey.state === "AUTHORIZED", lateAuthorizationGracePeriodActive: journey.state === "FAILED_PENDING_VERIFICATION" }, "CREATE_PAYMENT_LINK");
    if (!safety.allowed) return NextResponse.json({ created: false, safety }, { status: 409 });
    const link = await createExactAmountTestLink({ amount: journey.outstandingAmount, referenceId: input.referenceId, description: "RecoveryOS Test Mode recovery", customer: input.customer });
    const token = randomBytes(24).toString("base64url");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await database.transaction(async tx => { const [decision] = await tx.insert(recoveryDecisions).values({ journeyId: journey.id, action: "CREATE_PAYMENT_LINK", policy: "RULES", predictedSuccess: "0", expectedRecoveryAmount: journey.outstandingAmount, safety }).returning({ id: recoveryDecisions.id }); await tx.insert(auditEntries).values({ entityType: "DECISION", entityId: decision!.id, eventType: "RECOVERY_LINK_CREATED", evidence: { safety, journeyId: journey.id, referenceId: input.referenceId, amount: journey.outstandingAmount, paymentLinkId: link.id } }); await tx.insert(recoveryTokens).values({ token, journeyId: journey.id, paymentLinkId: link.id, paymentLinkUrl: link.short_url, expiresAt }); });
    const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";
    return NextResponse.json({ created: true, recoveryUrl: `${baseUrl}/recover/${token}`, id: link.id, expiresAt, safety });
  } catch (error) { return NextResponse.json({ created: false, error: error instanceof Error ? error.message : "Recovery link rejected" }, { status: 400 }); }
}
