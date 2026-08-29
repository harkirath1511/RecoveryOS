import type { PaymentEventType } from "@/lib/recovery/payment-journey";

export function mapRazorpayEvent(eventType: string): PaymentEventType | null {
  return ({ "payment.authorized": "PAYMENT_AUTHORIZED", "payment.captured": "PAYMENT_CAPTURED", "payment.failed": "PAYMENT_FAILED" } as const)[eventType] ?? null;
}
