import { describe, expect, it } from "vitest";
import { buildLiveRecoveryContext } from "./live-context";

describe("live recovery context", () => {
  it("uses the signed failed-payment evidence instead of invented categories", () => {
    const context = buildLiveRecoveryContext({ amount: 42_000, attemptNumber: 2, failureReceivedAt: new Date("2026-08-29T10:00:00Z"), now: new Date("2026-08-29T10:07:00Z"), failurePayload: { payload: { payment: { entity: { method: "upi", bank: "hdfc", error_code: "timeout", notes: { device: "android" } } } } } });
    expect(context).toMatchObject({ amount: 42_000, attemptNumber: 2, minutesSinceFailure: 7, method: "UPI", provider: "HDFC", errorCode: "TIMEOUT", device: "ANDROID", activeIncident: true, downtimeSeverity: 2 });
  });
});
