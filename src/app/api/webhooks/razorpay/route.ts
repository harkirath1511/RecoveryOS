import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { verifyRazorpayWebhook, WebhookIdempotencyStore } from "@/lib/razorpay/webhook";

const idempotency = new WebhookIdempotencyStore();

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const webhook = verifyRazorpayWebhook(rawBody, request.headers.get("x-razorpay-signature"), request.headers.get("x-razorpay-event-id"), env.RAZORPAY_WEBHOOK_SECRET);
    if (!idempotency.accept(webhook.eventId)) return NextResponse.json({ accepted: true, duplicate: true });
    // Persistence and state transitions are deliberately added only after the event is verified.
    return NextResponse.json({ accepted: true, event: webhook.eventType });
  } catch (error) {
    return NextResponse.json({ accepted: false, error: error instanceof Error ? error.message : "Webhook rejected" }, { status: 400 });
  }
}
