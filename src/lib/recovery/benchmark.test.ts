import { describe, expect, it } from "vitest";
import { runHeldOutBenchmark } from "./benchmark";

describe("held-out benchmark", () => {
  it("is reproducible and separates training from evaluation", () => {
    expect(runHeldOutBenchmark(12, 34)).toEqual(runHeldOutBenchmark(12, 34));
    expect(() => runHeldOutBenchmark(12, 12)).toThrow("must differ");
  });
  it("compares exactly the three declared policies", () => {
    const result = runHeldOutBenchmark();
    expect(result.metrics.map((metric) => metric.policy)).toEqual(["STATIC_RETRY", "RULES_ONLY", "RECOVERYOS"]);
    expect(result.metrics.every((metric) => metric.actionsTaken > 0 && metric.recoveryRate >= 0 && metric.recoveryRate <= 1)).toBe(true);
  });
});
