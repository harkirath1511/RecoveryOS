import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createDatabase } from "@/db/client";
import { auditEntries, banditStates, paymentJourneys, recoveryDecisions, recoveryOutcomes, recoveryWorkflows } from "@/db/schema";
import { verifyQStashSignature } from "@/lib/qstash/verify";
import { fetchRazorpayPayment } from "@/lib/razorpay/client";
import { transitionPaymentJourney } from "@/lib/recovery/payment-journey";
import { env } from "@/lib/env";
import { restoreBanditState, serializeBanditState } from "@/lib/recovery/bandit-persistence";
import { updateLinUcb } from "@/lib/recovery/linucb";
import { encodeRecoveryContext, type RecoveryPolicyContext } from "@/lib/recovery/policy-context";
import { recoveryActions, type RecoveryAction } from "@/lib/recovery/safety-policy";
import { executeAutonomousRecovery } from "@/app/api/recovery-links/route";

const jobSchema = z.object({ journeyId: z.string().uuid(), workflowId: z.string().uuid(), idempotencyKey: z.string().min(1), expectedState: z.literal("FAILED_PENDING_VERIFICATION") });

export async function POST(request: Request) {
  try {
    const raw = await request.text();
    const verified = await verifyQStashSignature({ body: raw, signature: request.headers.get("upstash-signature"), currentSigningKey: env.QSTASH_CURRENT_SIGNING_KEY, nextSigningKey: env.QSTASH_NEXT_SIGNING_KEY });
    if (!verified) return NextResponse.json({ processed: false, error: "Invalid or unconfigured QStash signature." }, { status: 401 });
    const job = jobSchema.parse(JSON.parse(raw)); const db = createDatabase();
    const [journey, workflow] = await Promise.all([db.select().from(paymentJourneys).where(eq(paymentJourneys.id, job.journeyId)).limit(1).then(rows => rows[0]), db.select().from(recoveryWorkflows).where(eq(recoveryWorkflows.id, job.workflowId)).limit(1).then(rows => rows[0])]);
    if (!journey || !workflow || workflow.journeyId !== job.journeyId || workflow.idempotencyKey !== job.idempotencyKey) return NextResponse.json({ processed: false, reason: "Journey, workflow, or idempotency key not found" }, { status: 404 });
    if (workflow.status !== "PENDING" || journey.state !== job.expectedState) return NextResponse.json({ processed: false, duplicate: workflow.status === "EXECUTED", reason: "Stale or cancelled job safely ignored" });
    if (!journey.providerPaymentId) return NextResponse.json({ processed: false, error: "Cannot verify a journey without a provider payment ID." }, { status: 409 });
    const payment = await fetchRazorpayPayment(journey.providerPaymentId);
    const providerEvent = payment.status === "captured" ? "PAYMENT_CAPTURED" : payment.status === "authorized" ? "PAYMENT_AUTHORIZED" : "VERIFICATION_EXPIRED";
    const transition = transitionPaymentJourney(journey.state, providerEvent);
    await db.transaction(async tx => {
      if (!transition.accepted) { await tx.update(recoveryWorkflows).set({ status: "STOPPED", terminalReason: "VERIFICATION_TRANSITION_REJECTED", updatedAt: new Date() }).where(eq(recoveryWorkflows.id, workflow.id)); return; }
      await tx.update(paymentJourneys).set({ state: transition.state, outstandingAmount: transition.state === "CAPTURED" ? 0 : journey.outstandingAmount, terminalOutcome: transition.state === "CAPTURED" ? "CAPTURED" : journey.terminalOutcome, updatedAt: new Date() }).where(eq(paymentJourneys.id, journey.id));
      await tx.update(recoveryWorkflows).set({ status: "EXECUTED", executedAt: new Date(), attemptCount: workflow.attemptCount + 1, terminalReason: payment.status === "captured" ? "PROVIDER_CAPTURE_VERIFIED" : payment.status === "authorized" ? "PROVIDER_AUTHORIZATION_VERIFIED" : "PROVIDER_NO_CAPTURE_AFTER_GRACE", updatedAt: new Date() }).where(and(eq(recoveryWorkflows.id, workflow.id), eq(recoveryWorkflows.status, "PENDING")));
      await tx.insert(auditEntries).values({ journeyId: journey.id, entityType: "WORKFLOW", entityId: workflow.id, action: "VERIFY_PROVIDER", eventType: "PAYMENT_STATUS_VERIFIED", reason: "Razorpay payment status fetched before recovery eligibility.", previousState: journey.state, nextState: transition.state, evidence: { providerPaymentId: journey.providerPaymentId, providerStatus: payment.status } });
      const [decision] = workflow.decisionId ? await tx.select().from(recoveryDecisions).where(eq(recoveryDecisions.id, workflow.decisionId)).limit(1) : [];
      const captured = providerEvent === "PAYMENT_CAPTURED";
      // An authorization is intentionally non-terminal: only a capture or the end of
      // the verification window is an attributable recovery outcome.
      const [outcome] = captured || providerEvent === "VERIFICATION_EXPIRED"
        ? await tx.insert(recoveryOutcomes).values({ journeyId: journey.id, decisionId: workflow.decisionId, workflowId: workflow.id, outcomeKey: `${captured ? "NATURAL_LATE_CAPTURE" : "NOT_RECOVERED"}:${workflow.id}`, category: captured ? "NATURAL_LATE_CAPTURE" : "NOT_RECOVERED", capturedAmount: captured ? Number(payment.amount) : 0, expectedRecoveryAmount: decision?.expectedRecoveryAmount ?? journey.outstandingAmount, policyReward: 0, evidence: { providerPaymentId: journey.providerPaymentId, providerStatus: payment.status, verificationWorkflowId: workflow.id, gracePeriodExpired: providerEvent === "VERIFICATION_EXPIRED" } }).onConflictDoNothing().returning({ id: recoveryOutcomes.id })
        : [];
      if (outcome) await tx.insert(auditEntries).values({ journeyId: journey.id, decisionId: workflow.decisionId, outcomeId: outcome.id, entityType: "OUTCOME", entityId: outcome.id, action: "ATTRIBUTE", eventType: captured ? "NATURAL_LATE_CAPTURE" : providerEvent === "VERIFICATION_EXPIRED" ? "NOT_RECOVERED" : "PAYMENT_AUTHORIZED", reason: "Provider verification produced a persisted outcome.", evidence: { workflowId: workflow.id, providerStatus: payment.status } });
      if (outcome && !captured && decision?.policy === "LINUCB" && decision.policyVersion && isAction(decision.action) && isContext(decision.policyContext)) { const [stored] = await tx.select().from(banditStates).where(eq(banditStates.version, decision.policyVersion)).limit(1); if (stored) { const state = updateLinUcb(restoreBanditState(JSON.stringify(stored.state)), decision.action, encodeRecoveryContext(decision.policyContext), false); await tx.update(banditStates).set({ state: JSON.parse(serializeBanditState(state)), updatedAt: new Date() }).where(eq(banditStates.version, decision.policyVersion)); } }
    });
    const autonomousRecovery = transition.state === "RETRY_ELIGIBLE"
      ? await executeAutonomousRecovery({ journeyId: journey.id, triggerSource: "AUTONOMOUS_INDIVIDUAL" })
      : undefined;
    return NextResponse.json({ processed: transition.accepted, state: transition.state, providerStatus: payment.status, autonomousRecovery });
  } catch (error) { return NextResponse.json({ processed: false, error: error instanceof Error ? error.message : "Invalid job" }, { status: 400 }); }
}
function isAction(value: string): value is RecoveryAction { return recoveryActions.includes(value as RecoveryAction); }
function isContext(value: unknown): value is RecoveryPolicyContext { return !!value && typeof value === "object" && typeof (value as RecoveryPolicyContext).amount === "number"; }
