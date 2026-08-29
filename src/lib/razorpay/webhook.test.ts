import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyRazorpayWebhook } from "./webhook";

const secret = "test_secret"; const body = JSON.stringify({ event: "payment.captured", payload: {} }); const signature = createHmac("sha256", secret).update(body).digest("hex");
describe("Razorpay webhook verification", () => {
  it("accepts an authentic event and rejects tampering", () => { expect(verifyRazorpayWebhook(body, signature, "evt_1", secret).eventType).toBe("payment.captured"); expect(() => verifyRazorpayWebhook(body, "bad", "evt_1", secret)).toThrow("Invalid"); });
});
