import type { RecoveryAction } from "./safety-policy";

export const attributionCategories = [
  "DIRECT_RECOVERY",
  "NATURAL_LATE_CAPTURE",
  "UNATTRIBUTED_CAPTURE",
  "NO_CAPTURE",
  "DUPLICATE_PREVENTED",
] as const;

export type AttributionCategory = (typeof attributionCategories)[number];

export type RecoveryPrediction = {
  action: RecoveryAction;
  predictedSuccess: number;
  expectedRecoveryAmount: number;
  policyVersion: string;
};

export type VerifiedOutcomeEvidence = {
  capturedAmount: number;
  captureVerified: boolean;
  captureFlowToken?: string;
  recoveryFlowToken?: string;
  capturedDuringGracePeriod: boolean;
};

export type AttributedOutcome = {
  category: AttributionCategory;
  policyReward: 0 | 1;
  directRecoveredAmount: number;
  naturalLateCaptureAmount: number;
  unattributedCaptureAmount: number;
  varianceFromExpected: number;
};

export function attributeOutcome(
  prediction: RecoveryPrediction,
  evidence: VerifiedOutcomeEvidence,
): AttributedOutcome {
  if (!evidence.captureVerified || evidence.capturedAmount <= 0) {
    return emptyOutcome(prediction, "NO_CAPTURE");
  }

  if (evidence.recoveryFlowToken && evidence.captureFlowToken === evidence.recoveryFlowToken) {
    return result(prediction, "DIRECT_RECOVERY", evidence.capturedAmount, 1);
  }

  if (evidence.capturedDuringGracePeriod) {
    return result(prediction, "NATURAL_LATE_CAPTURE", evidence.capturedAmount, 0);
  }

  return result(prediction, "UNATTRIBUTED_CAPTURE", evidence.capturedAmount, 0);
}

function emptyOutcome(prediction: RecoveryPrediction, category: AttributionCategory): AttributedOutcome {
  return { category, policyReward: 0, directRecoveredAmount: 0, naturalLateCaptureAmount: 0, unattributedCaptureAmount: 0, varianceFromExpected: -prediction.expectedRecoveryAmount };
}

function result(prediction: RecoveryPrediction, category: AttributionCategory, amount: number, policyReward: 0 | 1): AttributedOutcome {
  return {
    category,
    policyReward,
    directRecoveredAmount: category === "DIRECT_RECOVERY" ? amount : 0,
    naturalLateCaptureAmount: category === "NATURAL_LATE_CAPTURE" ? amount : 0,
    unattributedCaptureAmount: category === "UNATTRIBUTED_CAPTURE" ? amount : 0,
    varianceFromExpected: (category === "DIRECT_RECOVERY" ? amount : 0) - prediction.expectedRecoveryAmount,
  };
}
