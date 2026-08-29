export const paymentJourneyStates = [
  "CREATED",
  "ATTEMPTED",
  "FAILED_PENDING_VERIFICATION",
  "RETRY_ELIGIBLE",
  "AUTHORIZED",
  "CAPTURED",
  "HARD_DECLINED",
  "EXPIRED",
  "CANCELLED",
  "MANUAL_REVIEW",
] as const;

export type PaymentJourneyState = (typeof paymentJourneyStates)[number];

export const paymentEventTypes = [
  "ATTEMPT_STARTED",
  "PAYMENT_FAILED",
  "PAYMENT_AUTHORIZED",
  "PAYMENT_CAPTURED",
  "VERIFICATION_EXPIRED",
  "HARD_DECLINE_DETECTED",
  "MANUAL_REVIEW_REQUIRED",
  "CANCELLED",
] as const;

export type PaymentEventType = (typeof paymentEventTypes)[number];

export type TransitionResult =
  | { accepted: true; state: PaymentJourneyState; reason: string }
  | { accepted: false; state: PaymentJourneyState; reason: string };

const terminalStates = new Set<PaymentJourneyState>([
  "CAPTURED",
  "EXPIRED",
  "CANCELLED",
]);

const transitions: Record<PaymentJourneyState, Partial<Record<PaymentEventType, PaymentJourneyState>>> = {
  CREATED: {
    ATTEMPT_STARTED: "ATTEMPTED",
    PAYMENT_AUTHORIZED: "AUTHORIZED",
    PAYMENT_CAPTURED: "CAPTURED",
    CANCELLED: "CANCELLED",
  },
  ATTEMPTED: {
    PAYMENT_FAILED: "FAILED_PENDING_VERIFICATION",
    PAYMENT_AUTHORIZED: "AUTHORIZED",
    PAYMENT_CAPTURED: "CAPTURED",
    HARD_DECLINE_DETECTED: "HARD_DECLINED",
    CANCELLED: "CANCELLED",
  },
  FAILED_PENDING_VERIFICATION: {
    PAYMENT_AUTHORIZED: "AUTHORIZED",
    PAYMENT_CAPTURED: "CAPTURED",
    VERIFICATION_EXPIRED: "RETRY_ELIGIBLE",
    HARD_DECLINE_DETECTED: "HARD_DECLINED",
    MANUAL_REVIEW_REQUIRED: "MANUAL_REVIEW",
    CANCELLED: "CANCELLED",
  },
  RETRY_ELIGIBLE: {
    ATTEMPT_STARTED: "ATTEMPTED",
    PAYMENT_AUTHORIZED: "AUTHORIZED",
    PAYMENT_CAPTURED: "CAPTURED",
    HARD_DECLINE_DETECTED: "HARD_DECLINED",
    MANUAL_REVIEW_REQUIRED: "MANUAL_REVIEW",
    CANCELLED: "CANCELLED",
  },
  AUTHORIZED: {
    PAYMENT_CAPTURED: "CAPTURED",
    MANUAL_REVIEW_REQUIRED: "MANUAL_REVIEW",
    CANCELLED: "CANCELLED",
  },
  CAPTURED: {},
  HARD_DECLINED: {
    MANUAL_REVIEW_REQUIRED: "MANUAL_REVIEW",
    PAYMENT_CAPTURED: "CAPTURED",
  },
  EXPIRED: {},
  CANCELLED: {},
  MANUAL_REVIEW: {
    PAYMENT_CAPTURED: "CAPTURED",
    VERIFICATION_EXPIRED: "RETRY_ELIGIBLE",
    CANCELLED: "CANCELLED",
  },
};

export function transitionPaymentJourney(
  state: PaymentJourneyState,
  event: PaymentEventType,
): TransitionResult {
  if (terminalStates.has(state)) {
    return {
      accepted: false,
      state,
      reason: `${state} is terminal; ${event} cannot reopen the journey.`,
    };
  }

  const nextState = transitions[state][event];

  if (!nextState) {
    return {
      accepted: false,
      state,
      reason: `${event} is not valid while the journey is ${state}.`,
    };
  }

  return {
    accepted: true,
    state: nextState,
    reason: `${event} moved the journey from ${state} to ${nextState}.`,
  };
}

export function isTerminalPaymentJourneyState(state: PaymentJourneyState): boolean {
  return terminalStates.has(state);
}
