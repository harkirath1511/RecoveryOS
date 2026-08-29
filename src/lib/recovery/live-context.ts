import type { RecoveryPolicyContext } from "./policy-context";

type PaymentEntity = {
  order_id?: unknown;
  method?: unknown;
  bank?: unknown;
  error_code?: unknown;
  error_reason?: unknown;
  notes?: unknown;
};

export function buildLiveRecoveryContext(input: {
  amount: number;
  attemptNumber: number;
  failureReceivedAt?: Date;
  failurePayload?: unknown;
  now?: Date;
}): RecoveryPolicyContext {
  const entity = paymentEntity(input.failurePayload);
  const errorCode = text(entity?.error_code) ?? text(entity?.error_reason) ?? "OTHER";
  const method = text(entity?.method) ?? "OTHER";

  return {
    amount: input.amount,
    attemptNumber: input.attemptNumber,
    minutesSinceFailure: input.failureReceivedAt ? Math.max(0, Math.floor(((input.now ?? new Date()).getTime() - input.failureReceivedAt.getTime()) / 60_000)) : 0,
    hourOfDay: (input.now ?? new Date()).getHours(),
    method,
    provider: text(entity?.bank) ?? "OTHER",
    errorCode,
    device: note(entity?.notes, "device") ?? "OTHER",
    activeIncident: errorCode === "TIMEOUT",
    downtimeSeverity: errorCode === "TIMEOUT" ? 2 : 0,
  };
}

function paymentEntity(payload: unknown): PaymentEntity | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as { payload?: { payment?: { entity?: PaymentEntity } } };
  return root.payload?.payment?.entity ?? null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value.toUpperCase() : null;
}

function note(value: unknown, key: string): string | null {
  return value && typeof value === "object" ? text((value as Record<string, unknown>)[key]) : null;
}
