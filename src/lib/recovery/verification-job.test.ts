import { describe, expect, it } from "vitest";
import { createExactAmountTestLink } from "../razorpay/client";
import { qstashDeduplicationId } from "./verification-job";

describe("recovery execution boundaries", () => {
  it("rejects invalid money amounts before reaching Razorpay", async () => { await expect(createExactAmountTestLink({ amount: 0, referenceId: "j1", description: "Recovery", customer: {} })).rejects.toThrow("positive integer"); });
  it("converts internal idempotency keys to a QStash-safe deterministic identifier", () => {
    const key = "verify:9344ec22-8002-4d1e-ba30-a3f8691aef3b:54a7567b-9452-415a-af61-76db7f5ef408";
    expect(qstashDeduplicationId(key)).toMatch(/^[a-f0-9]{64}$/);
    expect(qstashDeduplicationId(key)).toBe(qstashDeduplicationId(key));
  });
});
