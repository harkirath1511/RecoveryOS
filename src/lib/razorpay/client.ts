import { createHmac, timingSafeEqual } from "node:crypto";
import Razorpay from "razorpay";
import { env } from "@/lib/env";

export function createRazorpayClient(): Razorpay {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) throw new Error("Razorpay Test Mode credentials are not configured.");
  return new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET });
}

export async function createExactAmountTestLink(input: { amount: number; referenceId: string; description: string; customer: { name?: string; email?: string; contact?: string } }) {
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) throw new Error("Recovery amount must be a positive integer in paise.");
  const client = createRazorpayClient();
  return client.paymentLink.create({ amount: input.amount, currency: "INR", reference_id: input.referenceId, description: input.description, accept_partial: false, customer: input.customer, notify: { email: false, sms: false, whatsapp: false } });
}

export async function fetchRazorpayPayment(paymentId: string) { return createRazorpayClient().payments.fetch(paymentId); }
export async function cancelRazorpayPaymentLink(paymentLinkId: string) { return createRazorpayClient().paymentLink.cancel(paymentLinkId); }

export function verifyRazorpayCheckoutSignature(input: { orderId: string; paymentId: string; signature: string }): boolean {
  if (!env.RAZORPAY_KEY_SECRET) return false;
  const expected = createHmac("sha256", env.RAZORPAY_KEY_SECRET).update(`${input.orderId}|${input.paymentId}`).digest("hex");
  return input.signature.length === expected.length && timingSafeEqual(Buffer.from(input.signature), Buffer.from(expected));
}
