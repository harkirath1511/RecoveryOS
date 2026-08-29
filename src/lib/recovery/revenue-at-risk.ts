export type JourneyRecoveryEstimate = {
  journeyId: string;
  outstandingAmount: number;
  baselineRecoveryProbability: number;
  selectedRecoveryProbability: number;
  interventionCost: number;
  policySamples: number;
};

export type RevenueAtRiskEstimate = {
  amount: number;
  eligibleJourneyCount: number;
  confidence: number;
  calibration: "CALIBRATED" | "LOW_SAMPLE" | "UNAVAILABLE";
  assumptions: {
    baselineRecoveryProbability: number;
    interventionCostPaise: number;
    formula: string;
  };
  journeys: Array<JourneyRecoveryEstimate & { incrementalRecoverability: number }>;
};

/**
 * Risk is the recoverable value still exposed across actual eligible journeys, not
 * an incident-volume proxy. A journey contributes only its incremental recoverability.
 */
export function estimateRevenueAtRisk(
  journeys: readonly JourneyRecoveryEstimate[],
  assumptions: { baselineRecoveryProbability: number; interventionCostPaise: number },
): RevenueAtRiskEstimate {
  const enriched = journeys.map((journey) => ({
    ...journey,
    incrementalRecoverability: Math.max(
      0,
      Math.round(
        (journey.selectedRecoveryProbability - journey.baselineRecoveryProbability) * journey.outstandingAmount - journey.interventionCost,
      ),
    ),
  }));
  const totalSamples = enriched.reduce((total, journey) => total + journey.policySamples, 0);
  const confidence = enriched.length === 0 ? 0 : Math.min(0.95, totalSamples / (totalSamples + 100));
  return {
    amount: enriched.reduce((total, journey) => total + journey.incrementalRecoverability, 0),
    eligibleJourneyCount: enriched.length,
    confidence,
    calibration: totalSamples >= 100 ? "CALIBRATED" : totalSamples > 0 ? "LOW_SAMPLE" : "UNAVAILABLE",
    assumptions: { ...assumptions, formula: "Σ max(0, (p(policy) − p(no intervention)) × outstanding amount − intervention cost)" },
    journeys: enriched,
  };
}
