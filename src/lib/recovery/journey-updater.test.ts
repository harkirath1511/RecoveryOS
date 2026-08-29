import { describe, expect, it } from "vitest";
import { applyPaymentEvent } from "./journey-updater";
describe("durable journey updates", () => {
  it("clears outstanding value only after capture", () => { expect(applyPaymentEvent({ state: "AUTHORIZED", outstandingAmount: 20_500 }, "PAYMENT_CAPTURED")).toEqual({ state: "CAPTURED", outstandingAmount: 0 }); });
  it("keeps a captured journey closed", () => { expect(applyPaymentEvent({ state: "CAPTURED", outstandingAmount: 0 }, "PAYMENT_FAILED").state).toBe("CAPTURED"); });
});
