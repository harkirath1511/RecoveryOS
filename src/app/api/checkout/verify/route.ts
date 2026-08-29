import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createDatabase } from "@/db/client";
import { auditEntries, paymentJourneys } from "@/db/schema";
import { fetchRazorpayPayment, verifyRazorpayCheckoutSignature } from "@/lib/razorpay/client";
import { transitionPaymentJourney } from "@/lib/recovery/payment-journey";
import { recoveryWorkflows } from "@/db/schema";
import { cancelVerification } from "@/lib/recovery/verification-job";

const callbackSchema = z.object({ razorpay_order_id: z.string().min(1), razorpay_payment_id: z.string().min(1), razorpay_signature: z.string().min(1) });

export async function POST(request: Request) {
  try {
    const callback = callbackSchema.parse(await request.json());
    if (!verifyRazorpayCheckoutSignature({ orderId: callback.razorpay_order_id, paymentId: callback.razorpay_payment_id, signature: callback.razorpay_signature })) return NextResponse.json({ verified: false, error: "Invalid Razorpay Checkout signature." }, { status: 400 });
    const payment = await fetchRazorpayPayment(callback.razorpay_payment_id);
    if (payment.order_id !== callback.razorpay_order_id) return NextResponse.json({ verified: false, error: "Payment does not belong to the supplied order." }, { status: 409 });
    const db = createDatabase(); const [journey] = await db.select().from(paymentJourneys).where(eq(paymentJourneys.razorpayOrderId, callback.razorpay_order_id)).limit(1);
    if (!journey) return NextResponse.json({ verified: false, error: "Payment journey not found." }, { status: 404 });
    const event = payment.status === "captured" ? "PAYMENT_CAPTURED" : payment.status === "authorized" ? "PAYMENT_AUTHORIZED" : null;
    if (!event) return NextResponse.json({ verified: false, error: "Payment is not authorized or captured." }, { status: 409 });
    const transition = transitionPaymentJourney(journey.state, event);
    const cancelledMessageIds = await db.transaction(async tx => { if (transition.accepted) await tx.update(paymentJourneys).set({ state: transition.state, outstandingAmount: transition.state === "CAPTURED" ? 0 : journey.outstandingAmount, providerPaymentId: payment.id, terminalOutcome: transition.state === "CAPTURED" ? "CAPTURED" : journey.terminalOutcome, updatedAt: new Date() }).where(eq(paymentJourneys.id, journey.id)); const pending = transition.state === "CAPTURED" ? await tx.select({ qstashMessageId: recoveryWorkflows.qstashMessageId }).from(recoveryWorkflows).where(and(eq(recoveryWorkflows.journeyId, journey.id), eq(recoveryWorkflows.status, "PENDING"))) : []; if (pending.length) await tx.update(recoveryWorkflows).set({ status: "STOPPED", terminalReason: "CAPTURED", cancelledAt: new Date(), updatedAt: new Date() }).where(and(eq(recoveryWorkflows.journeyId, journey.id), eq(recoveryWorkflows.status, "PENDING"))); await tx.insert(auditEntries).values({ journeyId: journey.id, entityType: "CHECKOUT", entityId: callback.razorpay_payment_id, action: "VERIFY_CALLBACK", eventType: transition.accepted ? "CHECKOUT_CALLBACK_VERIFIED" : "CHECKOUT_CALLBACK_IGNORED", reason: transition.reason, previousState: journey.state, nextState: transition.state, evidence: { orderId: callback.razorpay_order_id, paymentId: callback.razorpay_payment_id, providerStatus: payment.status } }); return pending.flatMap(workflow => workflow.qstashMessageId ? [workflow.qstashMessageId] : []); });
    await Promise.all(cancelledMessageIds.map(messageId => cancelVerification(messageId).catch(() => false)));
    return NextResponse.json({ verified: transition.accepted, state: transition.state });
  } catch (error) { return NextResponse.json({ verified: false, error: error instanceof Error ? error.message : "Invalid Checkout callback." }, { status: 400 }); }
}
