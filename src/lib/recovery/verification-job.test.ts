import { describe, expect, it } from "vitest";
import { createExactAmountTestLink } from "../razorpay/client";

describe("recovery execution boundaries", () => {
  it("rejects invalid money amounts before reaching Razorpay", async () => { await expect(createExactAmountTestLink({ amount: 0, referenceId: "j1", description: "Recovery", customer: {} })).rejects.toThrow("positive integer"); });
});
