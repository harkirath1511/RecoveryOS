import { describe, expect, it } from "vitest";
import { estimateRevenueAtRisk } from "./revenue-at-risk";

describe("estimateRevenueAtRisk", () => {
  it("sums each eligible journey's incremental recoverability after cost", () => {
    const estimate = estimateRevenueAtRisk([
      { journeyId: "a", outstandingAmount: 10_000, baselineRecoveryProbability: 0.1, selectedRecoveryProbability: 0.4, interventionCost: 200, policySamples: 100 },
      { journeyId: "b", outstandingAmount: 5_000, baselineRecoveryProbability: 0.3, selectedRecoveryProbability: 0.2, interventionCost: 0, policySamples: 100 },
    ], { baselineRecoveryProbability: 0.1, interventionCostPaise: 200 });
    expect(estimate.amount).toBe(2_800);
    expect(estimate.journeys[1]?.incrementalRecoverability).toBe(0);
    expect(estimate.calibration).toBe("CALIBRATED");
  });
});
