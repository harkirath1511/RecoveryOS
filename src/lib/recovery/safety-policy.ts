import {
  isTerminalPaymentJourneyState,
  type PaymentJourneyState,
} from "./payment-journey";

export const recoveryActions = [
  "WAIT_AND_VERIFY",
  "RETRY_ORIGINAL_CHECKOUT",
  "OFFER_ALTERNATE_CHECKOUT",
  "CREATE_PAYMENT_LINK",
  "MANUAL_REVIEW",
  "STOP_RECOVERY",
] as const;

export type RecoveryAction = (typeof recoveryActions)[number];

export type RecoverySafetyContext = {
  journeyState: PaymentJourneyState;
  outstandingAmount: number;
  requestedAmount?: number;
  automatedRecoveryActions: number;
  maxAutomatedRecoveryActions: number;
  hardDeclineDetected: boolean;
  hasConflictingFinancialState: boolean;
  lateAuthorizationGracePeriodActive: boolean;
};

export type SafetyDecision = {
  action: RecoveryAction;
  allowed: boolean;
  ruleId: string;
  reason: string;
};

const moneyMovingActions = new Set<RecoveryAction>([
  "RETRY_ORIGINAL_CHECKOUT",
  "OFFER_ALTERNATE_CHECKOUT",
  "CREATE_PAYMENT_LINK",
]);

export function isMoneyMovingRecoveryAction(action: RecoveryAction): boolean {
  return moneyMovingActions.has(action);
}

export function evaluateRecoveryAction(
  context: RecoverySafetyContext,
  action: RecoveryAction,
): SafetyDecision {
  if (action === "STOP_RECOVERY") {
    return allow(action, "STOP_ALLOWED", "Stopping recovery is always safe.");
  }

  if (action === "MANUAL_REVIEW" && (context.hardDeclineDetected || context.journeyState === "HARD_DECLINED")) {
    return allow(action, "HARD_DECLINE_REQUIRES_REVIEW", "Hard decline is routed to manual review.");
  }

  if (isTerminalPaymentJourneyState(context.journeyState)) {
    return block(
      action,
      "TERMINAL_JOURNEY",
      `The journey is ${context.journeyState}; no recovery action may reopen it.`,
    );
  }

  if (context.outstandingAmount <= 0) {
    return block(action, "NO_OUTSTANDING_AMOUNT", "There is no outstanding amount to recover.");
  }

  if (
    isMoneyMovingRecoveryAction(action) &&
    context.requestedAmount !== undefined &&
    context.requestedAmount > context.outstandingAmount
  ) {
    return block(
      action,
      "AMOUNT_EXCEEDS_OUTSTANDING",
      "The requested recovery amount exceeds the outstanding amount.",
    );
  }

  if (context.hasConflictingFinancialState) {
    return action === "MANUAL_REVIEW"
      ? allow(action, "CONFLICT_REQUIRES_REVIEW", "A conflicting state requires manual review.")
      : block(
          action,
          "CONFLICT_REQUIRES_REVIEW",
          "Conflicting financial state blocks automated recovery.",
        );
  }

  if (context.hardDeclineDetected) {
    return block(
          action,
          "HARD_DECLINE",
          "Hard declines cannot trigger automated recovery.",
        );
  }

  if (context.lateAuthorizationGracePeriodActive) {
    return action === "WAIT_AND_VERIFY"
      ? allow(
          action,
          "LATE_AUTHORIZATION_GRACE",
          "Verification is required before another payment is offered.",
        )
      : block(
          action,
          "LATE_AUTHORIZATION_GRACE",
          "Wait for late-authorization verification before taking recovery action.",
        );
  }

  if (
    isMoneyMovingRecoveryAction(action) &&
    context.automatedRecoveryActions >= context.maxAutomatedRecoveryActions
  ) {
    return block(
      action,
      "AUTOMATED_ACTION_LIMIT",
      "The journey has reached its automated recovery-action limit.",
    );
  }

  return allow(action, "RECOVERY_ALLOWED", "The action satisfies all current safety rules.");
}

function allow(action: RecoveryAction, ruleId: string, reason: string): SafetyDecision {
  return { action, allowed: true, ruleId, reason };
}

function block(action: RecoveryAction, ruleId: string, reason: string): SafetyDecision {
  return { action, allowed: false, ruleId, reason };
}
