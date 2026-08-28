import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const payloadSchema = z.object({ event: z.string().min(1), payload: z.record(z.string(), z.unknown()) });
export type VerifiedWebhook = { eventId: string; eventType: string; payload: z.infer<typeof payloadSchema> };

export function verifyRazorpayWebhook(rawBody: string, signature: string | null, eventId: string | null, secret: string | undefined): VerifiedWebhook {
  if (!secret || !signature || !eventId) throw new Error("Missing Razorpay webhook credentials or event identifier.");
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw new Error("Invalid Razorpay webhook signature.");
  return { eventId, eventType: payloadSchema.parse(JSON.parse(rawBody)).event, payload: payloadSchema.parse(JSON.parse(rawBody)) };
}

export class WebhookIdempotencyStore {
  private readonly seen = new Set<string>();
  accept(eventId: string): boolean { if (this.seen.has(eventId)) return false; this.seen.add(eventId); return true; }
}
