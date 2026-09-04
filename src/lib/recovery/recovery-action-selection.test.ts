import { describe, expect, it } from "vitest";
import { selectExecutableRecoveryActions } from "./recovery-action-selection";

describe("executable recovery action selection", () => {
  const safeActions = ["RETRY_ORIGINAL_CHECKOUT", "OFFER_ALTERNATE_CHECKOUT", "CREATE_PAYMENT_LINK"] as const;

  it("limits autonomous execution to the concrete payment-link recovery action", () => {
    expect(selectExecutableRecoveryActions({ safeActions, autonomous: true })).toEqual(["CREATE_PAYMENT_LINK"]);
  });

  it("does not execute a requested action that safety did not allow", () => {
    expect(selectExecutableRecoveryActions({ safeActions: ["CREATE_PAYMENT_LINK"], requestedAction: "OFFER_ALTERNATE_CHECKOUT", autonomous: false })).toEqual([]);
  });
});
