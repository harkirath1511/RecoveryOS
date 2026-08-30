import { createHash, createHmac } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { POST as processRazorpayWebhook } from "@/app/api/webhooks/razorpay/route";
import { requireOperator } from "@/lib/auth/session";
import { createDatabase } from "@/db/client";
import { paymentJourneys, paymentStateTransitions, recoveryOutcomes, recoveryWorkflows, scenarioRuns } from "@/db/schema";
import { env } from "@/lib/env";
import { transitionPaymentJourney } from "@/lib/recovery/payment-journey";
import { defaultSimulationConfig, simulatePaymentEvents } from "@/lib/recovery/simulator";

const requestSchema = z.object({ seed: z.number().int().optional(), delayedAuthorizationMs: z.number().int().min(0).max(86_400_000).default(0), duplicateEventRate: z.number().min(0).max(1).default(0), outOfOrderEventRate: z.number().min(0).max(1).default(0) });

/** Replays every virtual delivery through the same signed-webhook handler as Razorpay. */
export async function POST(request: Request) {
  const unauthorized = await requireOperator();
  if (unauthorized) return unauthorized;
  if (!env.RAZORPAY_WEBHOOK_SECRET) return NextResponse.json({ error: "RAZORPAY_WEBHOOK_SECRET is required to execute signed scenarios." }, { status: 409 });
  const input = requestSchema.parse(await request.json());
  const config = { ...defaultSimulationConfig, seed: input.seed ?? defaultSimulationConfig.seed, virtualTime: { delayedAuthorizationMs: input.delayedAuthorizationMs, duplicateEventRate: input.duplicateEventRate, outOfOrderEventRate: input.outOfOrderEventRate } };
  const events = simulatePaymentEvents(config);
  const database = createDatabase();
  const virtualStartedAt = new Date(Math.min(...events.map((event) => event.occurredAt)));
  const virtualEndedAt = new Date(Math.max(...events.map((event) => event.deliveredAt)));
  const configurationHash = createHash("sha256").update(JSON.stringify(config)).digest("hex");
  const [run] = await database.insert(scenarioRuns).values({ seed: config.seed, configurationHash, configurationSnapshot: config, virtualStartedAt, virtualEndedAt, result: { eventCount: events.length, delayedAuthorizations: events.filter((event) => event.type === "PAYMENT_AUTHORIZED").length, duplicateEvents: events.filter((event) => event.duplicate).length, outOfOrderDeliveries: events.filter((event) => event.deliveredAt < event.occurredAt).length } }).returning();
  const results: Array<{ id: string; status: number; accepted: boolean }> = [];
  for (const event of events) {
    const eventName = event.type === "PAYMENT_FAILED" ? "payment.failed" : event.type === "PAYMENT_AUTHORIZED" ? "payment.authorized" : "payment.captured";
    const body = JSON.stringify({ event: eventName, payload: { payment: { entity: { id: `scenario-payment:${run!.id}:${event.attemptId}`, order_id: `scenario:${run!.id}:${event.attemptId}`, amount: scenarioAmount(event.attemptId), currency: "INR", method: "UPI", bank: "HDFC", status: eventName.slice("payment.".length), error_code: event.type === "PAYMENT_FAILED" ? "TIMEOUT" : undefined, created_at: Math.max(1, Math.floor(event.occurredAt / 1000)), notes: { device: "ANDROID", scenarioRunId: run!.id, virtualDeliveredAt: event.deliveredAt } } } } });
    const signature = createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET).update(body).digest("hex");
    const response = await processRazorpayWebhook(new Request("http://scenario.local/api/webhooks/razorpay", { method: "POST", headers: { "content-type": "application/json", "x-razorpay-signature": signature, "x-razorpay-event-id": `scenario:${run!.id}:${event.id}` }, body }));
    const result = await response.json() as { accepted?: boolean };
    results.push({ id: event.id, status: response.status, accepted: result.accepted === true });
  }
  // The virtual clock completes the same pending-verification contract after all
  // deliveries have passed through the real webhook ingestion path.
  for (const attemptId of new Set(events.map((event) => event.attemptId))) {
    const [journey] = await database.select().from(paymentJourneys).where(eq(paymentJourneys.razorpayOrderId, `scenario:${run!.id}:${attemptId}`)).limit(1);
    if (!journey || journey.state !== "FAILED_PENDING_VERIFICATION") continue;
    const [workflow] = await database.select().from(recoveryWorkflows).where(and(eq(recoveryWorkflows.journeyId, journey.id), eq(recoveryWorkflows.status, "PENDING"))).limit(1);
    const transition = transitionPaymentJourney(journey.state, "VERIFICATION_EXPIRED");
    if (!workflow || !transition.accepted) continue;
    await database.transaction(async (tx) => {
      await tx.update(paymentJourneys).set({ state: transition.state, updatedAt: virtualEndedAt }).where(eq(paymentJourneys.id, journey.id));
      await tx.update(recoveryWorkflows).set({ status: "EXECUTED", terminalReason: "VIRTUAL_NO_CAPTURE_AFTER_GRACE", executedAt: virtualEndedAt, updatedAt: virtualEndedAt }).where(eq(recoveryWorkflows.id, workflow.id));
      await tx.insert(paymentStateTransitions).values({ journeyId: journey.id, previousState: journey.state, nextState: transition.state, accepted: true, reason: "Virtual verification window expired.", occurredAt: virtualEndedAt });
      await tx.insert(recoveryOutcomes).values({ journeyId: journey.id, decisionId: workflow.decisionId, workflowId: workflow.id, outcomeKey: `NOT_RECOVERED:scenario:${run!.id}:${attemptId}`, category: "NOT_RECOVERED", capturedAmount: 0, expectedRecoveryAmount: journey.outstandingAmount, policyReward: 0, evidence: { scenarioRunId: run!.id, virtual: true, graceExpiredAt: virtualEndedAt.toISOString() } }).onConflictDoNothing();
    });
  }
  return NextResponse.json({ scenarioRun: run, results, events });
}

function scenarioAmount(attemptId: string) { let hash = 0; for (const character of attemptId) hash = (hash * 31 + character.charCodeAt(0)) >>> 0; return (500 + (hash % 9_500)) * 100; }
