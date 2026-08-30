import { describe, expect, it } from "vitest";

import {
  isTerminalPaymentJourneyState,
  transitionPaymentJourney,
} from "./payment-journey";

describe("payment journey transitions", () => {
  it("waits for verification after a failed attempt", () => {
    const result = transitionPaymentJourney("ATTEMPTED", "PAYMENT_FAILED");

    expect(result).toEqual({
      accepted: true,
      state: "FAILED_PENDING_VERIFICATION",
      reason: "PAYMENT_FAILED moved the journey from ATTEMPTED to FAILED_PENDING_VERIFICATION.",
    });
  });

  it("waits for verification when the first received event is a failure", () => {
    const result = transitionPaymentJourney("CREATED", "PAYMENT_FAILED");

    expect(result).toMatchObject({
      accepted: true,
      state: "FAILED_PENDING_VERIFICATION",
    });
  });

  it("accepts a late capture while verification is pending", () => {
    const result = transitionPaymentJourney(
      "FAILED_PENDING_VERIFICATION",
      "PAYMENT_CAPTURED",
    );

    expect(result.accepted).toBe(true);
    expect(result.state).toBe("CAPTURED");
  });

  it("does not allow an old failure to reopen a captured journey", () => {
    const result = transitionPaymentJourney("CAPTURED", "PAYMENT_FAILED");

    expect(result.accepted).toBe(false);
    expect(result.state).toBe("CAPTURED");
    expect(result.reason).toContain("terminal");
  });

  it("does not offer retries after a hard decline", () => {
    const result = transitionPaymentJourney("HARD_DECLINED", "ATTEMPT_STARTED");

    expect(result.accepted).toBe(false);
    expect(result.state).toBe("HARD_DECLINED");
  });

  it("marks the intended terminal states", () => {
    expect(isTerminalPaymentJourneyState("CAPTURED")).toBe(true);
    expect(isTerminalPaymentJourneyState("FAILED_PENDING_VERIFICATION")).toBe(false);
  });
});
