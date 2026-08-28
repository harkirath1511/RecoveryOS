export const paymentMethods = ["UPI", "CARD", "NETBANKING"] as const;
export const paymentProviders = ["HDFC", "ICICI", "SBI", "AXIS"] as const;
export const deviceCategories = ["ANDROID", "IOS", "WEB"] as const;
export const paymentErrorCodes = ["NONE", "TIMEOUT", "PAYMENT_FAILED"] as const;

export type PaymentMethod = (typeof paymentMethods)[number];
export type PaymentProvider = (typeof paymentProviders)[number];
export type DeviceCategory = (typeof deviceCategories)[number];
export type PaymentErrorCode = (typeof paymentErrorCodes)[number];

export type SimulatedPaymentAttempt = {
  id: string;
  occurredAt: number;
  amount: number;
  method: PaymentMethod;
  provider: PaymentProvider;
  device: DeviceCategory;
  errorCode: PaymentErrorCode;
  succeeded: boolean;
  period: "BASELINE" | "CURRENT";
};

export type DegradationScenario = {
  provider: PaymentProvider;
  method: PaymentMethod;
  device: DeviceCategory;
  failureRate: number;
  affectedShare: number;
};

export type PaymentSimulationConfig = {
  seed: number;
  baselineAttempts: number;
  currentAttempts: number;
  normalFailureRate: number;
  baselineStartAt: number;
  currentStartAt: number;
  intervalMs: number;
  scenario: DegradationScenario;
};

export const defaultSimulationConfig: PaymentSimulationConfig = {
  seed: 20260829,
  baselineAttempts: 1_000,
  currentAttempts: 400,
  normalFailureRate: 0.06,
  baselineStartAt: 0,
  currentStartAt: 60 * 60 * 1000,
  intervalMs: 2_000,
  scenario: {
    provider: "HDFC",
    method: "UPI",
    device: "ANDROID",
    failureRate: 0.69,
    affectedShare: 0.35,
  },
};

export function simulatePaymentAttempts(
  overrides: Partial<PaymentSimulationConfig> = {},
): SimulatedPaymentAttempt[] {
  const config = mergeConfig(overrides);
  const random = createSeededRandom(config.seed);

  return [
    ...createAttempts(config, random, "BASELINE", config.baselineAttempts),
    ...createAttempts(config, random, "CURRENT", config.currentAttempts),
  ];
}

function createAttempts(
  config: PaymentSimulationConfig,
  random: () => number,
  period: SimulatedPaymentAttempt["period"],
  count: number,
): SimulatedPaymentAttempt[] {
  const attempts: SimulatedPaymentAttempt[] = [];
  const startAt = period === "BASELINE" ? config.baselineStartAt : config.currentStartAt;

  for (let index = 0; index < count; index += 1) {
    const isAffected = period === "CURRENT" && random() < config.scenario.affectedShare;
    const method = isAffected ? config.scenario.method : pick(random, paymentMethods);
    const provider = isAffected ? config.scenario.provider : pick(random, paymentProviders);
    const device = isAffected ? config.scenario.device : pick(random, deviceCategories);
    const failureRate = isAffected ? config.scenario.failureRate : config.normalFailureRate;
    const succeeded = random() >= failureRate;

    attempts.push({
      id: `${period.toLowerCase()}-${index + 1}`,
      occurredAt: startAt + index * config.intervalMs,
      amount: randomAmount(random),
      method,
      provider,
      device,
      errorCode: succeeded ? "NONE" : isAffected ? "TIMEOUT" : "PAYMENT_FAILED",
      succeeded,
      period,
    });
  }

  return attempts;
}

function mergeConfig(overrides: Partial<PaymentSimulationConfig>): PaymentSimulationConfig {
  return {
    ...defaultSimulationConfig,
    ...overrides,
    scenario: {
      ...defaultSimulationConfig.scenario,
      ...overrides.scenario,
    },
  };
}

function randomAmount(random: () => number): number {
  const rupees = 500 + Math.floor(random() * 9_500);
  return rupees * 100;
}

function pick<T>(random: () => number, values: readonly T[]): T {
  return values[Math.floor(random() * values.length)]!;
}

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}
