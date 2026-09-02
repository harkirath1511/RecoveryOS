import { createHash, createHmac } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { POST as processRazorpayWebhook } from "@/app/api/webhooks/razorpay/route";
import { requireOperator } from "@/lib/auth/session";
import { createDatabase } from "@/db/client";
import { paymentJourneys, paymentStateTransitions, recoveryOutcomes, recoveryWorkflows, scenarioRuns } from "@/db/schema";
import { env } from "@/lib/env";
import { transitionPaymentJourney } from "@/lib/recovery/payment-journey";
import { defaultSimulationConfig, simulatePaymentEvents } from "@/lib/recovery/simulator";
import { executeAutonomousRecovery } from "@/app/api/recovery-links/route";
import { anchorScenarioClock } from "@/lib/recovery/scenario-clock";

const requestSchema = z.object({ seed: z.number().int().optional(), baselineAttempts: z.number().int().min(25).max(1_000).default(200), currentAttempts: z.number().int().min(25).max(1_000).default(100), delayedAuthorizationMs: z.number().int().min(0).max(86_400_000).default(0), duplicateEventRate: z.number().min(0).max(1).default(0), outOfOrderEventRate: z.number().min(0).max(1).default(0) });

/** Replays every virtual delivery through the same signed-webhook handler as Razorpay. */
export async function POST(request: Request) {
  const unauthorized = await requireOperator();
  if (unauthorized) return unauthorized;
  try {
  if (!env.RAZORPAY_WEBHOOK_SECRET) return NextResponse.json({ error: "RAZORPAY_WEBHOOK_SECRET is required to execute signed scenarios." }, { status: 409 });
  const webhookSecret = env.RAZORPAY_WEBHOOK_SECRET;
  const input = requestSchema.parse(await request.json());
  const config = { ...defaultSimulationConfig, seed: input.seed ?? defaultSimulationConfig.seed, baselineAttempts: input.baselineAttempts, currentAttempts: input.currentAttempts, virtualTime: { delayedAuthorizationMs: input.delayedAuthorizationMs, duplicateEventRate: input.duplicateEventRate, outOfOrderEventRate: input.outOfOrderEventRate } };
  const events = simulatePaymentEvents(config);
  const database = createDatabase();
  // Keep virtual ordering while anchoring it to a recent real window so the
  // incident detector sees a baseline followed by a current cohort.
  const clock = anchorScenarioClock(events);
  const virtualStartedAt = clock.startedAt;
  const virtualEndedAt = clock.endedAt;
  const configurationHash = createHash("sha256").update(JSON.stringify(config)).digest("hex");
  const [run] = await database.insert(scenarioRuns).values({ seed: config.seed, configurationHash, configurationSnapshot: config, virtualStartedAt, virtualEndedAt, result: { eventCount: events.length, delayedAuthorizations: events.filter((event) => event.type === "PAYMENT_AUTHORIZED").length, duplicateEvents: events.filter((event) => event.duplicate).length, outOfOrderDeliveries: events.filter((event) => event.deliveredAt < event.occurredAt).length } }).returning();
  const results: Array<{ id: string; status: number; accepted: boolean }> = [];
  const eventsByAttempt = new Map<string, typeof events>();
  for (const event of events) eventsByAttempt.set(event.attemptId, [...(eventsByAttempt.get(event.attemptId) ?? []), event]);
  await forEachWithConcurrency([...eventsByAttempt.values()], 8, async attemptEvents => {
    for (const event of attemptEvents) {
    const eventName = event.type === "PAYMENT_FAILED" ? "payment.failed" : event.type === "PAYMENT_AUTHORIZED" ? "payment.authorized" : "payment.captured";
    const deliveredAt = clock.toDate(event.deliveredAt);
    const body = JSON.stringify({ event: eventName, payload: { payment: { entity: { id: `scenario-payment:${run!.id}:${event.attemptId}`, order_id: `scenario:${run!.id}:${event.attemptId}`, amount: scenarioAmount(event.attemptId), currency: "INR", method: "UPI", bank: "HDFC", status: eventName.slice("payment.".length), error_code: event.type === "PAYMENT_FAILED" ? "TIMEOUT" : undefined, created_at: Math.floor(clock.toDate(event.occurredAt).getTime() / 1000), notes: { device: "ANDROID", scenarioRunId: run!.id, virtualDeliveredAt: deliveredAt.toISOString() } } } } });
    const signature = createHmac("sha256", webhookSecret).update(body).digest("hex");
    const response = await processRazorpayWebhook(new Request("http://scenario.local/api/webhooks/razorpay", { method: "POST", headers: { "content-type": "application/json", "x-recoveryos-synthetic": "true", "x-recoveryos-virtual-received-at": deliveredAt.toISOString(), "x-razorpay-signature": signature, "x-razorpay-event-id": `scenario:${run!.id}:${event.id}` }, body }));
    const result = await response.json() as { accepted?: boolean };
    results.push({ id: event.id, status: response.status, accepted: result.accepted === true });
  }
  });
  // The virtual clock completes the same pending-verification contract after all
  // deliveries have passed through the real webhook ingestion path.
  const autonomousRecovery: Array<{ journeyId: string; result: Awaited<ReturnType<typeof executeAutonomousRecovery>> }> = [];
  const autonomousJourneyIds: string[] = [];
  const orderIds = [...new Set(events.map(event => `scenario:${run!.id}:${event.attemptId}`))];
  const pendingJourneys = await database.select().from(paymentJourneys).where(and(inArray(paymentJourneys.razorpayOrderId, orderIds), eq(paymentJourneys.state, "FAILED_PENDING_VERIFICATION")));
  const pendingJourneyIds = pendingJourneys.map(journey => journey.id);
  const pendingWorkflows = pendingJourneyIds.length ? await database.select().from(recoveryWorkflows).where(and(inArray(recoveryWorkflows.journeyId, pendingJourneyIds), eq(recoveryWorkflows.status, "PENDING"))) : [];
  const verificationWorkflowByJourney = new Map(pendingWorkflows.map(workflow => [workflow.journeyId, workflow]));
  await forEachWithConcurrency(pendingJourneys, 4, async journey => {
    const workflow = verificationWorkflowByJourney.get(journey.id);
    const transition = transitionPaymentJourney(journey.state, "VERIFICATION_EXPIRED");
    if (!workflow || !transition.accepted) return;
    await database.transaction(async (tx) => {
      await tx.update(paymentJourneys).set({ state: transition.state, updatedAt: virtualEndedAt }).where(eq(paymentJourneys.id, journey.id));
      await tx.update(recoveryWorkflows).set({ status: "EXECUTED", terminalReason: "VIRTUAL_NO_CAPTURE_AFTER_GRACE", executedAt: virtualEndedAt, updatedAt: virtualEndedAt }).where(eq(recoveryWorkflows.id, workflow.id));
      await tx.insert(paymentStateTransitions).values({ journeyId: journey.id, previousState: journey.state, nextState: transition.state, accepted: true, reason: "Virtual verification window expired.", occurredAt: virtualEndedAt });
      await tx.insert(recoveryOutcomes).values({ journeyId: journey.id, decisionId: workflow.decisionId, workflowId: workflow.id, outcomeKey: `NOT_RECOVERED:scenario:${run!.id}:${journey.id}`, category: "NOT_RECOVERED", capturedAmount: 0, expectedRecoveryAmount: journey.outstandingAmount, policyReward: 0, evidence: { scenarioRunId: run!.id, virtual: true, graceExpiredAt: virtualEndedAt.toISOString() } }).onConflictDoNothing();
    });
    autonomousJourneyIds.push(journey.id);
  });
  await forEachWithConcurrency(autonomousJourneyIds, 4, async journeyId => { autonomousRecovery.push({ journeyId, result: await executeAutonomousRecovery({ journeyId, triggerSource: "AUTONOMOUS_INDIVIDUAL", synthetic: true }) }); });
  return NextResponse.json({ scenarioRun: run, results, eventCount: events.length, autonomousRecovery });
  } catch (error) {
    console.error("Synthetic scenario failed.", error);
    const code = error && typeof error === "object" && "code" in error ? (error as { code?: unknown }).code : undefined;
    const isConnectionFailure = code === "ETIMEDOUT" || code === "CONNECT_TIMEOUT" || code === "ECONNREFUSED" || code === "ENETUNREACH";
    return NextResponse.json({ error: isConnectionFailure ? "The synthetic scenario could not reach the database. Retry shortly." : "The synthetic scenario could not be completed." }, { status: isConnectionFailure ? 503 : 500 });
  }
}

function scenarioAmount(attemptId: string) { let hash = 0; for (const character of attemptId) hash = (hash * 31 + character.charCodeAt(0)) >>> 0; return (500 + (hash % 9_500)) * 100; }

async function forEachWithConcurrency<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  let nextIndex = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const item = items[nextIndex++];
      if (item) await worker(item);
    }
  }));
}
