import type { RecoveryAction } from "./safety-policy";
import type { RecoveryPolicyContext, RecoveryPolicyDecision } from "./policy-context";

export function chooseRulesAction(
  context: RecoveryPolicyContext,
  allowedActions: readonly RecoveryAction[],
): RecoveryPolicyDecision {
  const preferredActions = priorityFor(context);
  const action = preferredActions.find((candidate) => allowedActions.includes(candidate));

  if (!action) {
    return {
      action: "STOP_RECOVERY",
      policy: "RULES",
      reason: "No recovery action is permitted by the safety engine.",
    };
  }

  return {
    action,
    policy: "RULES",
    reason: `Selected ${action} from deterministic recovery rules.`,
  };
}

function priorityFor(context: RecoveryPolicyContext): RecoveryAction[] {
  if (context.errorCode === "TIMEOUT" || context.activeIncident || context.downtimeSeverity > 0) {
    return ["WAIT_AND_VERIFY", "OFFER_ALTERNATE_CHECKOUT", "CREATE_PAYMENT_LINK", "MANUAL_REVIEW"];
  }

  if (context.attemptNumber > 1) {
    return ["OFFER_ALTERNATE_CHECKOUT", "CREATE_PAYMENT_LINK", "MANUAL_REVIEW"];
  }

  return ["RETRY_ORIGINAL_CHECKOUT", "OFFER_ALTERNATE_CHECKOUT", "CREATE_PAYMENT_LINK", "MANUAL_REVIEW"];
}
