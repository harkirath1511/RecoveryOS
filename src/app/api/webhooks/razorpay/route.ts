import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { createDatabase } from "@/db/client";
import { webhookEvents } from "@/db/schema";
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
    return NextResponse.json({ accepted: true, event: webhook.eventType });
  } catch (error) {
    return NextResponse.json({ accepted: false, error: error instanceof Error ? error.message : "Webhook rejected" }, { status: 400 });
  }
}
