import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { desc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createDatabase } from "@/db/client";
import { auditEntries, paymentJourneys, recoveryDecisions, recoveryOutcomes, recoveryTokens, recoveryWorkflows, webhookEvents } from "@/db/schema";
import { requireOperator } from "@/lib/auth/session";
import { cancelRazorpayPaymentLink, createExactAmountTestLink } from "@/lib/razorpay/client";
import { evaluateRecoveryAction, isMoneyMovingRecoveryAction, recoveryActions } from "@/lib/recovery/safety-policy";
import { selectLiveRecoveryAction } from "@/lib/recovery/live-policy";
import { buildLiveRecoveryContext } from "@/lib/recovery/live-context";
import { recoveryTokenDigest } from "@/lib/recovery/token-lifecycle";
import { policyFeatureSchemaVersion } from "@/lib/recovery/policy-context";
import { env } from "@/lib/env";

const requestSchema = z.object({
  journeyId: z.string().uuid(),
  customer: z.object({ name: z.string().min(1).max(80).optional(), email: z.string().email().refine((value) => value.endsWith("@example.com"), "Only synthetic example.com email addresses are permitted.").optional(), contact: z.literal("+919876543210").optional() }).refine((customer) => Boolean(customer.email || customer.contact), "A synthetic test contact is required."),
  referenceId: z.string().min(1).max(40),
});

export async function POST(request: Request) {
  try {
    const raw = await request.text();
    const triggerSource = trustedTriggerSource(raw, request.headers.get("x-recoveryos-trigger-source"), request.headers.get("x-recoveryos-internal-signature"));
    const synthetic = request.headers.get("x-recoveryos-synthetic") === "true" && Boolean(triggerSource);
    if (!triggerSource) { const unauthorized = await requireOperator(); if (unauthorized) return unauthorized; }
    const input = requestSchema.parse(JSON.parse(raw));
    const database = createDatabase();
    const [journey] = await database.select().from(paymentJourneys).where(eq(paymentJourneys.id, input.journeyId)).limit(1);
    if (!journey) return NextResponse.json({ created: false, error: "Payment journey not found." }, { status: 404 });
    const priorDecisions = await database.select({ action: recoveryDecisions.action }).from(recoveryDecisions).where(eq(recoveryDecisions.journeyId, journey.id));
    const automatedRecoveryActions = priorDecisions.filter(decision => isMoneyMovingRecoveryAction(decision.action as (typeof recoveryActions)[number])).length;
    const failedEvents = await database.select({ payload: webhookEvents.payload, receivedAt: webhookEvents.receivedAt }).from(webhookEvents).where(eq(webhookEvents.eventType, "payment.failed")).orderBy(desc(webhookEvents.receivedAt)).limit(100);
    const failure = failedEvents.find(event => isFailureForOrder(event.payload, journey.razorpayOrderId));
    const safetyContext = { journeyState: journey.state, outstandingAmount: journey.outstandingAmount, requestedAmount: journey.outstandingAmount, automatedRecoveryActions, maxAutomatedRecoveryActions: env.MAX_AUTOMATED_RECOVERY_ACTIONS, hardDeclineDetected: journey.state === "HARD_DECLINED", hasConflictingFinancialState: journey.state === "CAPTURED" || journey.state === "AUTHORIZED", lateAuthorizationGracePeriodActive: journey.state === "FAILED_PENDING_VERIFICATION" };
    const safetyResults = recoveryActions.map(action => evaluateRecoveryAction(safetyContext, action));
    if (journey.state === "CAPTURED" || journey.outstandingAmount <= 0 || automatedRecoveryActions >= env.MAX_AUTOMATED_RECOVERY_ACTIONS) { const ruleId = journey.state === "CAPTURED" || journey.outstandingAmount <= 0 ? "DUPLICATE_PAYMENT_GUARD" : "AUTOMATED_ACTION_LIMIT"; await recordDuplicatePrevention(database, journey, ruleId, { safetyContext, safetyResults }); return NextResponse.json({ created: false, error: "Recovery was prevented by a duplicate-payment safety guard.", ruleId }, { status: 409 }); }
    const safeActions = safetyResults.filter(result => result.allowed).map(result => result.action);
    // Razorpay Payment Links own the original checkout order. Reopening that order
    // after a failure can be rejected by Razorpay, so recovery must use a fresh,
    // exact-amount Payment Link instead of retrying the original checkout.
    const allowedActions = (failureCameFromPaymentLink(failure?.payload)
      ? safeActions.filter(action => action === "CREATE_PAYMENT_LINK")
      : safeActions).filter(action => isMoneyMovingRecoveryAction(action));
    if (allowedActions.length === 0) {
      return NextResponse.json({ created: false, error: "No safety-permitted recovery action is available for this payment origin." }, { status: 409 });
    }
    const context = buildLiveRecoveryContext({ amount: journey.outstandingAmount, attemptNumber: automatedRecoveryActions + 1, failureReceivedAt: failure?.receivedAt, failurePayload: failure?.payload });
    const selection = await selectLiveRecoveryAction(database, context, allowedActions, journey.outstandingAmount);
    if (!selection) return NextResponse.json({ created: false, error: "The persisted LinUCB policy is not ready. Warm-start it before executing recovery." }, { status: 409 });
    const safety = evaluateRecoveryAction(safetyContext, selection.ranking.action);
    if (!safety.allowed) { await recordDuplicatePrevention(database, journey, safety.ruleId, { safetyContext, safety }); return NextResponse.json({ created: false, safety }, { status: 409 }); }
    if (synthetic) {
      const idempotencyKey = `synthetic-recovery:${journey.id}:${selection.ranking.action}:${automatedRecoveryActions + 1}`;
      const workflow = await database.transaction(async tx => { await tx.execute(sql`select set_config('recovery.max_automated_actions', ${String(env.MAX_AUTOMATED_RECOVERY_ACTIONS)}, true)`); const [decision] = await tx.insert(recoveryDecisions).values({ journeyId: journey.id, action: selection.ranking.action, policy: "LINUCB", triggerSource: triggerSource!, policyVersion: selection.version, policyFeatureSchema: policyFeatureSchemaVersion, policyContext: selection.context, candidateActions: allowedActions, policyEstimates: selection.rankings, decisionReason: "Highest LinUCB score among safety-permitted actions.", predictedSuccess: String(selection.ranking.predictedSuccess), expectedRecoveryAmount: selection.ranking.expectedRecoveryAmount, safetyContext, safety: { selected: safety, results: safetyResults } }).returning({ id: recoveryDecisions.id }); const [created] = await tx.insert(recoveryWorkflows).values({ journeyId: journey.id, decisionId: decision!.id, action: selection.ranking.action, status: "EXECUTED", idempotencyKey, externalResourceId: `virtual:${journey.id}`, attemptCount: 1, executedAt: new Date() }).onConflictDoNothing().returning({ id: recoveryWorkflows.id }); if (!created) throw new Error("DUPLICATE_RECOVERY_WORKFLOW"); await tx.insert(auditEntries).values({ journeyId: journey.id, decisionId: decision!.id, entityType: "DECISION", entityId: decision!.id, action: selection.ranking.action, eventType: "SYNTHETIC_RECOVERY_WORKFLOW_CREATED", reason: "Synthetic replay used the same safety-permitted LinUCB recovery decision without creating a real payment instrument.", evidence: { triggerSource: triggerSource!, virtual: true, workflowId: created.id, selectedAction: selection.ranking.action, idempotencyKey } }); return created; });
      return NextResponse.json({ created: true, synthetic: true, action: selection.ranking.action, policy: "LINUCB", policyVersion: selection.version, workflowId: workflow!.id, safety });
    }
    if (selection.ranking.action === "RETRY_ORIGINAL_CHECKOUT" || selection.ranking.action === "OFFER_ALTERNATE_CHECKOUT") {
      if (!journey.razorpayOrderId || !env.RAZORPAY_KEY_ID) return NextResponse.json({ created: false, action: selection.ranking.action, error: "A Razorpay order and Test Mode key are required for Checkout recovery." }, { status: 409 });
      const idempotencyKey = `recovery:${journey.id}:${selection.ranking.action}:${automatedRecoveryActions + 1}`;
      const [workflow] = await database.transaction(async tx => { await tx.execute(sql`select set_config('recovery.max_automated_actions', ${String(env.MAX_AUTOMATED_RECOVERY_ACTIONS)}, true)`); const [decision] = await tx.insert(recoveryDecisions).values({ journeyId: journey.id, action: selection.ranking.action, policy: "LINUCB", triggerSource: triggerSource ?? "MANUAL_OPERATOR", policyVersion: selection.version, policyFeatureSchema: policyFeatureSchemaVersion, policyContext: selection.context, candidateActions: allowedActions, policyEstimates: selection.rankings, decisionReason: "Highest LinUCB score among safety-permitted actions.", predictedSuccess: String(selection.ranking.predictedSuccess), expectedRecoveryAmount: selection.ranking.expectedRecoveryAmount, safetyContext, safety: { selected: safety, results: safetyResults } }).returning({ id: recoveryDecisions.id }); const created = await tx.insert(recoveryWorkflows).values({ journeyId: journey.id, decisionId: decision!.id, action: selection.ranking.action, status: "EXECUTED", idempotencyKey, externalResourceId: journey.razorpayOrderId, attemptCount: 1, executedAt: new Date() }).onConflictDoNothing().returning({ id: recoveryWorkflows.id }); if (!created[0]) throw new Error("DUPLICATE_RECOVERY_WORKFLOW"); await tx.insert(auditEntries).values({ journeyId: journey.id, decisionId: decision!.id, entityType: "DECISION", entityId: decision!.id, action: selection.ranking.action, eventType: "CHECKOUT_RECOVERY_READY", reason: "Safety-permitted LinUCB selection.", evidence: { triggerSource: triggerSource ?? "MANUAL_OPERATOR", workflowId: created[0].id, orderId: journey.razorpayOrderId, selectedAction: selection.ranking.action, idempotencyKey } }); return created; });
      return NextResponse.json({ created: true, action: selection.ranking.action, policy: "LINUCB", policyVersion: selection.version, workflowId: workflow!.id, checkout: { key: env.RAZORPAY_KEY_ID, orderId: journey.razorpayOrderId, amount: journey.outstandingAmount, currency: journey.currency, methods: selection.ranking.action === "OFFER_ALTERNATE_CHECKOUT" ? ["upi", "card", "netbanking", "wallet"] : undefined } });
    }
    if (selection.ranking.action !== "CREATE_PAYMENT_LINK") return NextResponse.json({ created: false, action: selection.ranking.action, policy: "LINUCB", policyVersion: selection.version, safety, error: `LinUCB selected ${selection.ranking.action}; no supported executor is available.` }, { status: 409 });
    const idempotencyKey = `recovery:${journey.id}:${selection.ranking.action}:${automatedRecoveryActions + 1}`;
    const link = await createExactAmountTestLink({ amount: journey.outstandingAmount, referenceId: input.referenceId, description: "RecoveryOS Test Mode recovery", customer: input.customer });
    const token = randomBytes(24).toString("base64url");
    const expiresAt = new Date(Date.now() + env.RECOVERY_TOKEN_TTL_SECONDS * 1000);
    try { await database.transaction(async tx => { await tx.execute(sql`select set_config('recovery.max_automated_actions', ${String(env.MAX_AUTOMATED_RECOVERY_ACTIONS)}, true)`); const [decision] = await tx.insert(recoveryDecisions).values({ journeyId: journey.id, action: selection.ranking.action, policy: "LINUCB", triggerSource: triggerSource ?? "MANUAL_OPERATOR", policyVersion: selection.version, policyFeatureSchema: policyFeatureSchemaVersion, policyContext: selection.context, candidateActions: allowedActions, policyEstimates: selection.rankings, decisionReason: "Highest LinUCB score among safety-permitted actions.", predictedSuccess: String(selection.ranking.predictedSuccess), expectedRecoveryAmount: selection.ranking.expectedRecoveryAmount, safetyContext, safety: { selected: safety, results: safetyResults } }).returning({ id: recoveryDecisions.id }); const tokenDigest = recoveryTokenDigest(token); const [workflow] = await tx.insert(recoveryWorkflows).values({ journeyId: journey.id, decisionId: decision!.id, action: "CREATE_PAYMENT_LINK", status: "EXECUTED", idempotencyKey, customerTokenDigest: tokenDigest, externalResourceId: link.id, attemptCount: 1, executedAt: new Date(), expiresAt }).onConflictDoNothing().returning({ id: recoveryWorkflows.id }); if (!workflow) throw new Error("DUPLICATE_RECOVERY_WORKFLOW"); await tx.insert(auditEntries).values({ journeyId: journey.id, decisionId: decision!.id, entityType: "DECISION", entityId: decision!.id, action: "CREATE_PAYMENT_LINK", reason: "Safety-permitted LinUCB selection", eventType: "RECOVERY_LINK_CREATED", evidence: { triggerSource: triggerSource ?? "MANUAL_OPERATOR", safety, safetyResults, journeyId: journey.id, referenceId: input.referenceId, amount: journey.outstandingAmount, paymentLinkId: link.id, policyVersion: selection.version, policyContext: selection.context, selectedAction: selection.ranking.action, rankedActions: selection.rankings, workflowId: workflow.id, idempotencyKey } }); await tx.insert(recoveryTokens).values({ tokenDigest, journeyId: journey.id, decisionId: decision!.id, paymentLinkId: link.id, paymentLinkUrl: link.short_url, expiresAt }); }); } catch (error) { await cancelRazorpayPaymentLink(link.id).catch(() => undefined); if (error instanceof Error && (error.message.includes("AUTOMATED_ACTION_LIMIT") || error.message.includes("DUPLICATE_RECOVERY_WORKFLOW"))) await recordDuplicatePrevention(database, journey, "DUPLICATE_RECOVERY_WORKFLOW", { safetyContext, racePrevented: true, idempotencyKey }); throw error; }
    const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";
    return NextResponse.json({ created: true, recoveryUrl: `${baseUrl}/recover/${token}`, id: link.id, expiresAt, safety, action: selection.ranking.action, policy: "LINUCB", policyVersion: selection.version, predictedSuccess: selection.ranking.predictedSuccess });
  } catch (error) { return NextResponse.json({ created: false, error: error instanceof Error ? error.message : "Recovery link rejected" }, { status: 400 }); }
}

function isFailureForOrder(payload: unknown, orderId: string | null): boolean {
  if (!orderId || !payload || typeof payload !== "object") return false;
  const entity = (payload as { payload?: { payment?: { entity?: { order_id?: unknown } } } }).payload?.payment?.entity;
  return entity?.order_id === orderId;
}

function failureCameFromPaymentLink(payload: unknown): boolean {
  const entity = (payload as { payload?: { payment?: { entity?: { payment_link_id?: unknown } } } } | null)?.payload?.payment?.entity;
  return typeof entity?.payment_link_id === "string" && entity.payment_link_id.length > 0;
}

async function recordDuplicatePrevention(database: ReturnType<typeof createDatabase>, journey: typeof paymentJourneys.$inferSelect, reason: string, evidence: unknown) {
  await database.transaction(async tx => { const [outcome] = await tx.insert(recoveryOutcomes).values({ journeyId: journey.id, outcomeKey: `DUPLICATE_PREVENTED:${journey.id}:${reason}`, category: "DUPLICATE_PREVENTED", capturedAmount: 0, expectedRecoveryAmount: journey.outstandingAmount, policyReward: 0, evidence: { reason, ...asRecord(evidence) } }).onConflictDoNothing().returning({ id: recoveryOutcomes.id }); if (outcome) await tx.insert(auditEntries).values({ journeyId: journey.id, outcomeId: outcome.id, entityType: "OUTCOME", entityId: outcome.id, action: "PREVENT_DUPLICATE", eventType: "DUPLICATE_PREVENTED", reason, evidence }); });
}

function asRecord(value: unknown): Record<string, unknown> { return value && typeof value === "object" ? value as Record<string, unknown> : { evidence: value }; }

export type RecoveryTriggerSource = "MANUAL_OPERATOR" | "AUTONOMOUS_INDIVIDUAL" | "AUTONOMOUS_INCIDENT";

export async function executeAutonomousRecovery(input: { journeyId: string; triggerSource: Exclude<RecoveryTriggerSource, "MANUAL_OPERATOR">; synthetic?: boolean }) {
  if (env.AUTONOMOUS_RECOVERY_ENABLED !== "true") { const result = { created: false, skipped: true, reason: "AUTONOMOUS_RECOVERY_DISABLED" }; await recordAutonomousResult(input, result); return result; }
  const body = JSON.stringify({ journeyId: input.journeyId, customer: { name: "RecoveryOS Autonomous Test", contact: "+919876543210" }, referenceId: `auto-${input.journeyId.slice(0, 8)}` });
  const signature = internalSignature(body, input.triggerSource);
  const response = await POST(new Request("http://recoveryos.internal/api/recovery-links", { method: "POST", headers: { "content-type": "application/json", "x-recoveryos-trigger-source": input.triggerSource, "x-recoveryos-internal-signature": signature, ...(input.synthetic ? { "x-recoveryos-synthetic": "true" } : {}) }, body }));
  const result: Record<string, unknown> = { ...(await response.json() as Record<string, unknown>), status: response.status };
  if (result.created !== true) await recordAutonomousResult(input, result);
  return result;
}

async function recordAutonomousResult(input: { journeyId: string; triggerSource: Exclude<RecoveryTriggerSource, "MANUAL_OPERATOR">; synthetic?: boolean }, result: Record<string, unknown>) {
  await createDatabase().insert(auditEntries).values({ journeyId: input.journeyId, entityType: "RECOVERY", entityId: input.journeyId, action: "AUTONOMOUS_RECOVERY", eventType: result.skipped === true ? "AUTONOMOUS_RECOVERY_SKIPPED" : "AUTONOMOUS_RECOVERY_NOT_EXECUTED", reason: String(result.reason ?? result.error ?? "No safety-permitted recovery workflow was created."), evidence: { triggerSource: input.triggerSource, synthetic: input.synthetic === true, result } });
}

function trustedTriggerSource(body: string, source: string | null, signature: string | null): RecoveryTriggerSource | null {
  if (source !== "AUTONOMOUS_INDIVIDUAL" && source !== "AUTONOMOUS_INCIDENT") return null;
  const expected = internalSignature(body, source);
  if (!signature || signature.length !== expected.length) return null;
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected)) ? source : null;
}

function internalSignature(body: string, source: string) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not configured.");
  return createHmac("sha256", secret).update(`${source}:${body}`).digest("hex");
}
