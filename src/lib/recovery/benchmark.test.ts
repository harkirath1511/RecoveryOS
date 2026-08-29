import { describe, expect, it } from "vitest";
import { runHeldOutBenchmark } from "./benchmark";

describe("held-out benchmark", () => {
  it("is reproducible and separates training from evaluation", () => {
    expect(runHeldOutBenchmark(12, 34)).toEqual(runHeldOutBenchmark(12, 34));
    expect(() => runHeldOutBenchmark(12, 12)).toThrow("must differ");
    expect(() => runHeldOutBenchmark(12, 34, 499)).toThrow("between 500");
  }, 60_000);
  it("compares exactly the three declared policies", () => {
    const result = runHeldOutBenchmark();
    expect(result.metrics.map((metric) => metric.policy)).toEqual(["STATIC_RETRY", "RULES_ONLY", "RECOVERYOS"]);
    expect(result.metrics.every((metric) => metric.actionsTaken > 0 && metric.recoveryRate >= 0 && metric.recoveryRate <= 1)).toBe(true);
    expect(result.volume).toBeGreaterThanOrEqual(500);
    expect(result.protocol.heldOutJourneys).toBe(result.volume);
    expect(result.metrics.every((metric) => metric.unsafeActions === 0 && metric.duplicatePreventions >= 0)).toBe(true);
    expect(result.metrics.find((metric) => metric.policy === "RECOVERYOS")?.calibrationSampleSize).toBeGreaterThan(0);
  }, 60_000);
});
