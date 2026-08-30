import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export const paymentEntitySchema = z.object({ id: z.string().min(1).optional(), order_id: z.string().min(1).optional(), amount: z.number().int().positive().optional(), currency: z.string().min(1).optional(), payment_link_id: z.string().min(1).optional(), method: z.string().min(1).optional(), bank: z.string().min(1).optional(), status: z.string().min(1).optional(), error_code: z.string().min(1).optional(), error_source: z.string().min(1).optional(), error_step: z.string().min(1).optional(), error_reason: z.string().min(1).optional(), created_at: z.number().int().positive().optional(), notes: z.record(z.string(), z.unknown()).optional() });
const payloadSchema = z.object({ event: z.string().min(1), payload: z.object({ payment: z.object({ entity: paymentEntitySchema }).optional() }).passthrough() });
export type VerifiedWebhook = { eventId: string; eventType: string; payload: z.infer<typeof payloadSchema> };

export function verifyRazorpayWebhook(rawBody: string, signature: string | null, eventId: string | null, secret: string | undefined): VerifiedWebhook {
  if (!secret || !signature) throw new Error("Missing Razorpay webhook credentials.");
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw new Error("Invalid Razorpay webhook signature.");
  const payload = payloadSchema.parse(JSON.parse(rawBody));
  const stableId = eventId ?? `${payload.event}:${payload.payload.payment?.entity?.id ?? createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  return { eventId: stableId, eventType: payload.event, payload };
}
