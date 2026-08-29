import type { SimulatedPaymentAttempt } from "./simulator";

/** The detector deliberately only needs normalized payment facts, not simulator data. */
export type DetectablePaymentAttempt = {
  id: string;
  method: string;
  provider: string;
  device: string;
  errorCode: string;
  succeeded: boolean;
  period: "BASELINE" | "CURRENT";
};

export type IncidentDetectorConfig = {
  minAttempts: number;
  minAbsoluteSuccessRateDrop: number;
  minZScore: number;
};

export type CohortMetrics = {
  attempts: number;
  successes: number;
  successRate: number;
};

export type IncidentSegment = {
  key: string;
  label: string;
  baseline: CohortMetrics;
  current: CohortMetrics;
  successRateDrop: number;
  excessFailures: number;
  zScore: number;
};

export type PaymentIncident = {
  overallBaseline: CohortMetrics;
  overallCurrent: CohortMetrics;
  topSegment: IncidentSegment;
  totalExcessFailures: number;
};

export const defaultIncidentDetectorConfig: IncidentDetectorConfig = {
  minAttempts: 30,
  minAbsoluteSuccessRateDrop: 0.1,
  minZScore: 2.33,
};

export function detectPaymentIncident(
  attempts: readonly DetectablePaymentAttempt[],
  config: Partial<IncidentDetectorConfig> = {},
): PaymentIncident | null {
  const detectorConfig = { ...defaultIncidentDetectorConfig, ...config };
  const baselineAttempts = attempts.filter((attempt) => attempt.period === "BASELINE");
  const currentAttempts = attempts.filter((attempt) => attempt.period === "CURRENT");
  const overallBaseline = summarize(baselineAttempts);
  const overallCurrent = summarize(currentAttempts);

  if (!hasMaterialDrop(overallBaseline, overallCurrent, detectorConfig)) {
    return null;
  }

  const segments = buildSegments(baselineAttempts, currentAttempts)
    .map((segment) => scoreSegment(segment, detectorConfig))
    .filter((segment): segment is IncidentSegment => segment !== null)
    .sort((left, right) => {
      if (right.excessFailures !== left.excessFailures) {
        return right.excessFailures - left.excessFailures;
      }

      return right.zScore - left.zScore;
    });

  const topSegment = segments[0];

  if (!topSegment) {
    return null;
  }

  return {
    overallBaseline,
    overallCurrent,
    topSegment,
    totalExcessFailures: Math.round(
      overallCurrent.attempts * Math.max(0, overallBaseline.successRate - overallCurrent.successRate),
    ),
  };
}

function buildSegments(
  baseline: readonly DetectablePaymentAttempt[],
  current: readonly DetectablePaymentAttempt[],
): Array<{ key: string; label: string; baseline: CohortMetrics; current: CohortMetrics }> {
  const segmenters: Array<{
    key: string;
    groupKey: (attempt: DetectablePaymentAttempt) => string;
    label: (groupKey: string, currentGroup: readonly DetectablePaymentAttempt[]) => string;
  }> = [
    {
      key: "provider",
      groupKey: (attempt) => attempt.provider,
      label: (groupKey) => `Provider: ${groupKey}`,
    },
    {
      key: "method",
      groupKey: (attempt) => attempt.method,
      label: (groupKey) => `Method: ${groupKey}`,
    },
    {
      key: "device",
      groupKey: (attempt) => attempt.device,
      label: (groupKey) => `Device: ${groupKey}`,
    },
    {
      key: "error",
      groupKey: (attempt) => attempt.errorCode,
      label: (groupKey) => `Error: ${groupKey}`,
    },
    {
      key: "provider-method-device",
      groupKey: (attempt) => `${attempt.provider}|${attempt.method}|${attempt.device}`,
      label: (groupKey, currentGroup) => {
        const [provider, method, device] = groupKey.split("|");
        const error = dominantValue(currentGroup.filter((attempt) => !attempt.succeeded), (attempt) => attempt.errorCode);
        return `Provider: ${provider} · Method: ${method} · Device: ${device} · Error: ${error}`;
      },
    },
    {
      key: "provider-error",
      groupKey: (attempt) => `${attempt.provider}|${attempt.errorCode}`,
      label: (groupKey) => `Provider · error: ${groupKey.replaceAll("|", " · ")}`,
    },
    {
      key: "provider-method",
      groupKey: (attempt) => `${attempt.provider}|${attempt.method}`,
      label: (groupKey, currentGroup) => {
        const [provider, method] = groupKey.split("|");
        const failedAttempts = currentGroup.filter((attempt) => !attempt.succeeded);
        const dominantError = dominantValue(failedAttempts, (attempt) => attempt.errorCode);
        const dominantDevice = dominantValue(currentGroup, (attempt) => attempt.device);

        return `Provider: ${provider} · Method: ${method} · Device: ${dominantDevice} · Error: ${dominantError}`;
      },
    },
  ];

  return segmenters.flatMap((segmenter) => {
    const baselineGroups = groupByLabel(baseline, segmenter.groupKey);
    const currentGroups = groupByLabel(current, segmenter.groupKey);
    const labels = new Set([...baselineGroups.keys(), ...currentGroups.keys()]);

    return [...labels].map((label) => {
      const currentGroup = currentGroups.get(label) ?? [];

      return {
        key: `${segmenter.key}:${label}`,
        label: segmenter.label(label, currentGroup),
        baseline: summarize(baselineGroups.get(label) ?? []),
        current: summarize(currentGroup),
      };
    });
  });
}

function scoreSegment(
  segment: { key: string; label: string; baseline: CohortMetrics; current: CohortMetrics },
  config: IncidentDetectorConfig,
): IncidentSegment | null {
  if (!hasMaterialDrop(segment.baseline, segment.current, config)) {
    return null;
  }

  const successRateDrop = segment.baseline.successRate - segment.current.successRate;

  return {
    ...segment,
    successRateDrop,
    excessFailures: Math.round(segment.current.attempts * successRateDrop),
    zScore: calculateZScore(segment.baseline, segment.current),
  };
}

function hasMaterialDrop(
  baseline: CohortMetrics,
  current: CohortMetrics,
  config: IncidentDetectorConfig,
): boolean {
  if (baseline.attempts < config.minAttempts || current.attempts < config.minAttempts) {
    return false;
  }

  const successRateDrop = baseline.successRate - current.successRate;

  return (
    successRateDrop >= config.minAbsoluteSuccessRateDrop &&
    calculateZScore(baseline, current) >= config.minZScore
  );
}

function summarize(attempts: readonly DetectablePaymentAttempt[]): CohortMetrics {
  const successes = attempts.filter((attempt) => attempt.succeeded).length;

  return {
    attempts: attempts.length,
    successes,
    successRate: attempts.length === 0 ? 0 : successes / attempts.length,
  };
}

function calculateZScore(baseline: CohortMetrics, current: CohortMetrics): number {
  if (baseline.attempts === 0 || current.attempts === 0) {
    return 0;
  }

  const pooledSuccessRate =
    (baseline.successes + current.successes) / (baseline.attempts + current.attempts);
  const standardError = Math.sqrt(
    pooledSuccessRate *
      (1 - pooledSuccessRate) *
      (1 / baseline.attempts + 1 / current.attempts),
  );

  if (standardError === 0) {
    return 0;
  }

  return (baseline.successRate - current.successRate) / standardError;
}

function groupByLabel(
  attempts: readonly DetectablePaymentAttempt[],
  labelForAttempt: (attempt: DetectablePaymentAttempt) => string,
): Map<string, DetectablePaymentAttempt[]> {
  return attempts.reduce((groups, attempt) => {
    const label = labelForAttempt(attempt);
    const group = groups.get(label) ?? [];
    group.push(attempt);
    groups.set(label, group);
    return groups;
  }, new Map<string, DetectablePaymentAttempt[]>());
}

function dominantValue<T extends string>(
  attempts: readonly DetectablePaymentAttempt[],
  valueForAttempt: (attempt: DetectablePaymentAttempt) => T,
): T | "UNKNOWN" {
  const counts = new Map<T, number>();

  for (const attempt of attempts) {
    const value = valueForAttempt(attempt);
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  const winner = [...counts.entries()].sort((left, right) => right[1] - left[1])[0];
  return winner?.[0] ?? "UNKNOWN";
}
