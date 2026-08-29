import type { RecoveryAction } from "./safety-policy";

export type LinUcbActionState = {
  covariance: number[][];
  rewards: number[];
};

export type LinUcbState = {
  version: string;
  featureCount: number;
  actions: Partial<Record<RecoveryAction, LinUcbActionState>>;
};

export type RankedRecoveryAction = {
  action: RecoveryAction;
  predictedSuccess: number;
  explorationBonus: number;
  score: number;
  expectedRecoveryAmount: number;
};

export function createLinUcbState(
  actions: readonly RecoveryAction[],
  featureCount: number,
  version = "recovery-v1",
): LinUcbState {
  return {
    version,
    featureCount,
    actions: Object.fromEntries(actions.map((action) => [action, emptyActionState(featureCount)])),
  };
}

export function rankLinUcbActions(
  state: LinUcbState,
  context: readonly number[],
  allowedActions: readonly RecoveryAction[],
  outstandingAmount: number,
  explorationAlpha = 0.2,
  actionCosts: Partial<Record<RecoveryAction, number>> = {},
): RankedRecoveryAction[] {
  validateContext(state, context);

  return allowedActions
    .flatMap((action) => {
      const actionState = state.actions[action];
      if (!actionState) return [];

      const inverse = invert(actionState.covariance);
      const theta = multiplyMatrixVector(inverse, actionState.rewards);
      const predictedSuccess = clamp(dot(theta, context), 0, 1);
      const uncertainty = Math.sqrt(Math.max(0, dot(context, multiplyMatrixVector(inverse, context))));
      const explorationBonus = explorationAlpha * uncertainty;
      // Costs are currency amounts, never probability adjustments.
      const cost = actionCosts[action] ?? 0;
      const expectedRecoveryAmount = Math.round(Math.max(0, predictedSuccess * outstandingAmount - cost));
      const score = outstandingAmount > 0
        ? predictedSuccess + explorationBonus - cost / outstandingAmount
        : predictedSuccess + explorationBonus;

      return [{ action, predictedSuccess, explorationBonus, score, expectedRecoveryAmount }];
    })
    .sort((left, right) => right.score - left.score || left.action.localeCompare(right.action));
}

export function updateLinUcb(
  state: LinUcbState,
  action: RecoveryAction,
  context: readonly number[],
  attributableCapture: boolean,
): LinUcbState {
  validateContext(state, context);
  const actionState = state.actions[action];
  if (!actionState) throw new Error(`Action ${action} is not configured for this policy.`);

  const reward = attributableCapture ? 1 : 0;
  const covariance = actionState.covariance.map((row, rowIndex) =>
    row.map((value, columnIndex) => value + context[rowIndex]! * context[columnIndex]!),
  );
  const rewards = actionState.rewards.map((value, index) => value + reward * context[index]!);

  return {
    ...state,
    actions: { ...state.actions, [action]: { covariance, rewards } },
  };
}

function emptyActionState(featureCount: number): LinUcbActionState {
  return {
    covariance: Array.from({ length: featureCount }, (_, row) =>
      Array.from({ length: featureCount }, (_, column) => Number(row === column)),
    ),
    rewards: Array.from({ length: featureCount }, () => 0),
  };
}

function validateContext(state: LinUcbState, context: readonly number[]): void {
  if (context.length !== state.featureCount) {
    throw new Error(`Expected ${state.featureCount} features, received ${context.length}.`);
  }
}

function multiplyMatrixVector(matrix: number[][], vector: readonly number[]): number[] {
  return matrix.map((row) => dot(row, vector));
}

function dot(left: readonly number[], right: readonly number[]): number {
  return left.reduce((total, value, index) => total + value * right[index]!, 0);
}

function invert(matrix: number[][]): number[][] {
  const size = matrix.length;
  const augmented = matrix.map((row, index) => [
    ...row,
    ...Array.from({ length: size }, (_, column) => Number(index === column)),
  ]);

  for (let pivotIndex = 0; pivotIndex < size; pivotIndex += 1) {
    let bestRow = pivotIndex;
    for (let row = pivotIndex + 1; row < size; row += 1) {
      if (Math.abs(augmented[row]![pivotIndex]!) > Math.abs(augmented[bestRow]![pivotIndex]!)) bestRow = row;
    }
    if (Math.abs(augmented[bestRow]![pivotIndex]!) < 1e-12) throw new Error("LinUCB covariance matrix is singular.");
    [augmented[pivotIndex], augmented[bestRow]] = [augmented[bestRow]!, augmented[pivotIndex]!];

    const pivot = augmented[pivotIndex]![pivotIndex]!;
    augmented[pivotIndex] = augmented[pivotIndex]!.map((value) => value / pivot);
    for (let row = 0; row < size; row += 1) {
      if (row === pivotIndex) continue;
      const factor = augmented[row]![pivotIndex]!;
      augmented[row] = augmented[row]!.map((value, column) => value - factor * augmented[pivotIndex]![column]!);
    }
  }
  return augmented.map((row) => row.slice(size));
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
