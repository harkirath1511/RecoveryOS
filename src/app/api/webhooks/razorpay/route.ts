import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { createDatabase } from "@/db/client";
import { paymentJourneys, webhookEvents } from "@/db/schema";
import { mapRazorpayEvent } from "@/lib/razorpay/event-mapping";
import { applyPaymentEvent } from "@/lib/recovery/journey-updater";
import { eq } from "drizzle-orm";
import { verifyRazorpayWebhook, WebhookIdempotencyStore } from "@/lib/razorpay/webhook";

const idempotency = new WebhookIdempotencyStore();

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const webhook = verifyRazorpayWebhook(rawBody, request.headers.get("x-razorpay-signature"), request.headers.get("x-razorpay-event-id"), env.RAZORPAY_WEBHOOK_SECRET);
    if (!idempotency.accept(webhook.eventId)) return NextResponse.json({ accepted: true, duplicate: true });
    const database = createDatabase();
    const inserted = await database.insert(webhookEvents).values({ razorpayEventId: webhook.eventId, eventType: webhook.eventType, payload: webhook.payload }).onConflictDoNothing().returning({ id: webhookEvents.id });
    if (inserted.length === 0) return NextResponse.json({ accepted: true, duplicate: true });
    const payment = webhook.payload.payload.payment as { entity?: { order_id?: string; amount?: number } } | undefined;
    const paymentEvent = mapRazorpayEvent(webhook.eventType);
    if (paymentEvent && payment?.entity?.order_id && payment.entity.amount) {
      const [existing] = await database.select().from(paymentJourneys).where(eq(paymentJourneys.razorpayOrderId, payment.entity.order_id)).limit(1);
      const current = existing ?? await database.insert(paymentJourneys).values({ razorpayOrderId: payment.entity.order_id, outstandingAmount: payment.entity.amount }).returning().then((rows) => rows[0]!);
      const next = applyPaymentEvent({ state: current.state, outstandingAmount: current.outstandingAmount }, paymentEvent);
      if (next.state !== current.state || next.outstandingAmount !== current.outstandingAmount) await database.update(paymentJourneys).set({ state: next.state, outstandingAmount: next.outstandingAmount, updatedAt: new Date() }).where(eq(paymentJourneys.id, current.id));
    }
    return NextResponse.json({ accepted: true, event: webhook.eventType });
  } catch (error) {
    return NextResponse.json({ accepted: false, error: error instanceof Error ? error.message : "Webhook rejected" }, { status: 400 });
  }
}
