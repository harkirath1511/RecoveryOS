import { describe, expect, it } from "vitest";
import { attributeOutcome } from "./outcome-attribution";

const prediction = { action: "CREATE_PAYMENT_LINK" as const, predictedSuccess: .5, expectedRecoveryAmount: 50_000, policyVersion: "recovery-v1" };

describe("outcome attribution", () => {
  it("rewards only captures through the recovery flow", () => {
    const outcome = attributeOutcome(prediction, { capturedAmount: 100_000, captureVerified: true, captureFlowToken: "token-1", recoveryFlowToken: "token-1", capturedDuringGracePeriod: false });
    expect(outcome).toMatchObject({ category: "DIRECT_RECOVERY", policyReward: 1, directRecoveredAmount: 100_000, varianceFromExpected: 50_000 });
  });
  it("does not teach the policy from natural late captures", () => {
    const outcome = attributeOutcome(prediction, { capturedAmount: 100_000, captureVerified: true, capturedDuringGracePeriod: true });
    expect(outcome).toMatchObject({ category: "NATURAL_LATE_CAPTURE", policyReward: 0, directRecoveredAmount: 0 });
  });
  it("does not claim unlinked captures as recovery", () => {
    const outcome = attributeOutcome(prediction, { capturedAmount: 100_000, captureVerified: true, capturedDuringGracePeriod: false });
    expect(outcome).toMatchObject({ category: "UNATTRIBUTED_CAPTURE", policyReward: 0, unattributedCaptureAmount: 100_000 });
  });
  it("uses the documented terminal name when a verified workflow has no capture", () => {
    const outcome = attributeOutcome(prediction, { capturedAmount: 0, captureVerified: false, capturedDuringGracePeriod: false });
    expect(outcome).toMatchObject({ category: "NOT_RECOVERED", policyReward: 0 });
  });
});
