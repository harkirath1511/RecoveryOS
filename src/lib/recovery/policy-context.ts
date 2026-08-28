import type { RecoveryAction } from "./safety-policy";

export const policyFeatureSchemaVersion = "recovery-v1";

const methods = ["UPI", "CARD", "NETBANKING"] as const;
const providers = ["HDFC", "ICICI", "SBI", "AXIS"] as const;
const errors = ["TIMEOUT", "PAYMENT_FAILED"] as const;
const devices = ["ANDROID", "IOS", "WEB"] as const;

export type RecoveryPolicyContext = {
  amount: number;
  attemptNumber: number;
  minutesSinceFailure: number;
  hourOfDay: number;
  method: string;
  provider: string;
  errorCode: string;
  device: string;
  activeIncident: boolean;
  downtimeSeverity: 0 | 1 | 2 | 3;
};

export type RecoveryPolicyDecision = {
  action: RecoveryAction;
  policy: "RULES" | "LINUCB";
  reason: string;
};

export function encodeRecoveryContext(context: RecoveryPolicyContext): number[] {
  return [
    1,
    clamp(context.amount / 1_000_000, 0, 1),
    clamp(context.attemptNumber / 2, 0, 1),
    ...oneHot(bucketMinutes(context.minutesSinceFailure), ["IMMEDIATE", "SOON", "LATER"]),
    ...oneHot(bucketHour(context.hourOfDay), ["NIGHT", "DAY", "EVENING"]),
    ...oneHot(context.method, methods),
    ...oneHot(context.provider, providers),
    ...oneHot(context.errorCode, errors),
    ...oneHot(context.device, devices),
    context.activeIncident ? 1 : 0,
    context.downtimeSeverity / 3,
  ];
}

function oneHot(value: string, knownValues: readonly string[]): number[] {
  const resolved = knownValues.includes(value) ? value : "OTHER";
  return [...knownValues, "OTHER"].map((candidate) => Number(candidate === resolved));
}

function bucketMinutes(minutes: number): string {
  if (minutes <= 5) return "IMMEDIATE";
  if (minutes <= 30) return "SOON";
  return "LATER";
}

function bucketHour(hour: number): string {
  const safeHour = ((Math.floor(hour) % 24) + 24) % 24;
  if (safeHour < 8) return "NIGHT";
  if (safeHour < 18) return "DAY";
  return "EVENING";
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
