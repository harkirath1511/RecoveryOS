import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyRazorpayWebhook } from "./webhook";

const secret = "test_secret"; const body = JSON.stringify({ event: "payment.captured", payload: {} }); const signature = createHmac("sha256", secret).update(body).digest("hex");
describe("Razorpay webhook verification", () => {
  it("accepts an authentic event and rejects tampering", () => { expect(verifyRazorpayWebhook(body, signature, "evt_1", secret).eventType).toBe("payment.captured"); expect(() => verifyRazorpayWebhook(body, "bad", "evt_1", secret)).toThrow("Invalid"); });
  it("accepts the nullable error fields and array notes Razorpay sends for a captured payment", () => {
    const captured = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_1", order_id: "order_1", amount: 100, status: "captured", error_code: null, error_source: null, error_step: null, error_reason: null, notes: [] } } } });
    const capturedSignature = createHmac("sha256", secret).update(captured).digest("hex");
    expect(verifyRazorpayWebhook(captured, capturedSignature, "evt_2", secret).payload.payload.payment?.entity?.status).toBe("captured");
  });
});
