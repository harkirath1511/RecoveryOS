import { describe, expect, it } from "vitest";

import { evaluateRecoveryAction } from "./safety-policy";

const safeContext = {
  journeyState: "RETRY_ELIGIBLE" as const,
  outstandingAmount: 4_999,
  requestedAmount: 4_999,
  automatedRecoveryActions: 0,
  maxAutomatedRecoveryActions: 2,
  hardDeclineDetected: false,
  hasConflictingFinancialState: false,
  lateAuthorizationGracePeriodActive: false,
};

describe("recovery safety policy", () => {
  it("blocks payment actions after capture", () => {
    const decision = evaluateRecoveryAction(
      { ...safeContext, journeyState: "CAPTURED" },
      "CREATE_PAYMENT_LINK",
    );

    expect(decision).toMatchObject({ allowed: false, ruleId: "TERMINAL_JOURNEY" });
  });

  it("blocks an amount above the outstanding balance", () => {
    const decision = evaluateRecoveryAction(
      { ...safeContext, requestedAmount: 5_000 },
      "CREATE_PAYMENT_LINK",
    );

    expect(decision).toMatchObject({ allowed: false, ruleId: "AMOUNT_EXCEEDS_OUTSTANDING" });
  });

  it("allows verification but blocks payment actions during late-authorization grace", () => {
    const graceContext = { ...safeContext, lateAuthorizationGracePeriodActive: true };

    expect(evaluateRecoveryAction(graceContext, "WAIT_AND_VERIFY").allowed).toBe(true);
    expect(evaluateRecoveryAction(graceContext, "RETRY_ORIGINAL_CHECKOUT")).toMatchObject({
      allowed: false,
      ruleId: "LATE_AUTHORIZATION_GRACE",
    });
  });

  it("routes hard declines to manual review", () => {
    const hardDeclineContext = { ...safeContext, hardDeclineDetected: true };

    expect(evaluateRecoveryAction(hardDeclineContext, "MANUAL_REVIEW")).toMatchObject({
      allowed: true,
      ruleId: "HARD_DECLINE_REQUIRES_REVIEW",
    });
    expect(evaluateRecoveryAction(hardDeclineContext, "CREATE_PAYMENT_LINK").allowed).toBe(false);
  });

  it("allows a hard-declined journey itself to enter manual review", () => {
    expect(evaluateRecoveryAction({ ...safeContext, journeyState: "HARD_DECLINED", hardDeclineDetected: true }, "MANUAL_REVIEW")).toMatchObject({ allowed: true, ruleId: "HARD_DECLINE_REQUIRES_REVIEW" });
  });

  it("enforces the money-moving action limit", () => {
    const decision = evaluateRecoveryAction(
      { ...safeContext, automatedRecoveryActions: 2 },
      "OFFER_ALTERNATE_CHECKOUT",
    );

    expect(decision).toMatchObject({ allowed: false, ruleId: "AUTOMATED_ACTION_LIMIT" });
  });

  it("keeps stop recovery available in every state", () => {
    const decision = evaluateRecoveryAction(
      { ...safeContext, journeyState: "CAPTURED", outstandingAmount: 0 },
      "STOP_RECOVERY",
    );

    expect(decision).toMatchObject({ allowed: true, ruleId: "STOP_ALLOWED" });
  });
});
