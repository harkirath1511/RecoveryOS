import type { RecoveryAction } from "./safety-policy";

export function selectExecutableRecoveryActions(input: {
  safeActions: readonly RecoveryAction[];
  requestedAction?: RecoveryAction;
  autonomous: boolean;
}): RecoveryAction[] {
  const executable = input.autonomous ? ["CREATE_PAYMENT_LINK"] as const : input.safeActions;
  const candidates = input.requestedAction ? executable.filter(action => action === input.requestedAction) : executable;
  return candidates.filter(action => input.safeActions.includes(action));
}
