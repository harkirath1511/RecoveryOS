import { describe, expect, it } from "vitest";
import { processVerifiedEvent } from "./event-processor";

describe("verified event processor", () => {
  it("records an event once even when delivery is duplicated", () => {
    const journey = { id: "j1", state: "ATTEMPTED" as const, processedEventIds: [] };
    const first = processVerifiedEvent(journey, { id: "e1", paymentEvent: "PAYMENT_FAILED" });
    const duplicate = processVerifiedEvent(first.journey, { id: "e1", paymentEvent: "PAYMENT_FAILED" });
    expect(first.journey.state).toBe("FAILED_PENDING_VERIFICATION"); expect(duplicate).toMatchObject({ duplicate: true, accepted: false });
  });
  it("does not reopen a captured journey with a stale failure", () => {
    const result = processVerifiedEvent({ id: "j1", state: "CAPTURED" as const, processedEventIds: [] }, { id: "e2", paymentEvent: "PAYMENT_FAILED" });
    expect(result).toMatchObject({ accepted: false }); expect(result.journey.state).toBe("CAPTURED");
  });
});
