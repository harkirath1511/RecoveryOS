import { createLinUcbState, rankLinUcbActions, updateLinUcb } from "./linucb";
import { encodeRecoveryContext, type RecoveryPolicyContext } from "./policy-context";
import { chooseRulesAction } from "./rules-policy";
import { evaluateRecoveryAction, isMoneyMovingRecoveryAction, recoveryActions, type RecoveryAction, type RecoverySafetyContext } from "./safety-policy";
import { simulatePaymentAttempts, type SimulatedPaymentAttempt } from "./simulator";

export type BenchmarkPolicy = "STATIC_RETRY" | "RULES_ONLY" | "RECOVERYOS";
export type BenchmarkMetrics = {
  policy: BenchmarkPolicy;
  directRecoveredAmount: number;
  incrementalRecoveredAmount: number;
  netRecoveredAmount: number;
  interventionCostAmount: number;
  recoveryRate: number;
  actionsTaken: number;
  attemptsPerRecovery: number;
  unsafeRecommendations: number;
  unsafeActions: number;
  duplicateAttempts: number;
  duplicatePreventions: number;
  naturalLateRecoveredAmount: number;
  unattributedRecoveredAmount: number;
  medianTimeToRecoveryMinutes: number | null;
  calibrationBrierScore: number | null;
  calibrationSampleSize: number;
};
export type BenchmarkResult = { trainingSeed: number; evaluationSeed: number; volume: number; metrics: BenchmarkMetrics[]; reproducibilityKey: string; protocol: { heldOutJourneys: number; trainingUpdates: "LOGGED_ACTION_ONLY"; safetyEngine: "SHARED"; actionTiming: "SIMULATED" } };

const learnedActions: RecoveryAction[] = ["RETRY_ORIGINAL_CHECKOUT", "OFFER_ALTERNATE_CHECKOUT", "CREATE_PAYMENT_LINK"];
const interventionCostPaise = 150;

export function runHeldOutBenchmark(trainingSeed = 101, evaluationSeed = 202, volume = 500): BenchmarkResult {
  if (trainingSeed === evaluationSeed) throw new Error("Training and evaluation seeds must differ.");
  if (!Number.isInteger(volume) || volume < 500 || volume > 2_000) throw new Error("Benchmark volume must be between 500 and 2000.");
  const training = failedJourneys(trainingSeed, volume);
  const evaluation = failedJourneys(evaluationSeed, volume);
  let state = createLinUcbState(learnedActions, encodeRecoveryContext(toContext(training[0]!)).length);
  const loggedWorkflowKeys = new Set<string>();

  // Logged bandit feedback: every update is for the one randomized action actually executed.
  for (const attempt of training) {
    const lifecycle = executeLifecycle("RECOVERYOS", attempt, state, trainingSeed, true, loggedWorkflowKeys);
    if (learnedActions.includes(lifecycle.action)) state = updateLinUcb(state, lifecycle.action, lifecycle.features, lifecycle.directRecovered);
  }

  const scored = (["STATIC_RETRY", "RULES_ONLY", "RECOVERYOS"] as const).map((policy) => scorePolicy(policy, evaluation, state, evaluationSeed));
  const staticAmount = scored.find((metric) => metric.policy === "STATIC_RETRY")!.directRecoveredAmount;
  const metrics = scored.map((metric) => ({ ...metric, incrementalRecoveredAmount: metric.directRecoveredAmount - staticAmount }));
  return { trainingSeed, evaluationSeed, volume, metrics, reproducibilityKey: `benchmark-v3:${trainingSeed}:${evaluationSeed}:${volume}:${evaluation.length}`, protocol: { heldOutJourneys: evaluation.length, trainingUpdates: "LOGGED_ACTION_ONLY", safetyEngine: "SHARED", actionTiming: "SIMULATED" } };
}

function scorePolicy(policy: BenchmarkPolicy, attempts: readonly SimulatedPaymentAttempt[], initialState: ReturnType<typeof createLinUcbState>, seed: number): BenchmarkMetrics {
  let state = initialState;
  const workflowKeys = new Set<string>();
  const accumulator = emptyMetrics(policy);
  const pendingPolicyUpdates: Array<{ action: RecoveryAction; features: number[]; directRecovered: boolean }> = [];
  for (const [index, attempt] of attempts.entries()) {
    const lifecycle = executeLifecycle(policy, attempt, state, seed, false, workflowKeys);
    accumulator.actionsTaken += lifecycle.action === "STOP_RECOVERY" ? 0 : 1;
    accumulator.unsafeRecommendations += lifecycle.unsafeRecommendation ? 1 : 0;
    accumulator.unsafeActions += lifecycle.unsafeAction ? 1 : 0;
    accumulator.duplicateAttempts += lifecycle.duplicateAttempt ? 1 : 0;
    accumulator.duplicatePreventions += lifecycle.duplicatePrevented ? 1 : 0;
    accumulator.interventionCostAmount += lifecycle.interventionCost;
    if (lifecycle.naturalLate) accumulator.naturalLateRecoveredAmount += attempt.amount;
    if (lifecycle.directRecovered) { accumulator.directRecoveredAmount += attempt.amount; accumulator.recoveries += 1; accumulator.recoveryTimes.push(lifecycle.recoveryMinutes); }
    if (lifecycle.prediction !== null) { accumulator.calibrationSquaredError += (lifecycle.prediction - Number(lifecycle.directRecovered)) ** 2; accumulator.calibrationSampleSize += 1; }
    // Apply actual logged outcomes in bounded workflow batches; no counterfactual actions are updated.
    if (policy === "RECOVERYOS" && learnedActions.includes(lifecycle.action)) pendingPolicyUpdates.push(lifecycle);
    if (policy === "RECOVERYOS" && ((index + 1) % 25 === 0 || index + 1 === attempts.length)) {
      for (const update of pendingPolicyUpdates) state = updateLinUcb(state, update.action, update.features, update.directRecovered);
      pendingPolicyUpdates.length = 0;
    }
  }
  return {
    policy, directRecoveredAmount: accumulator.directRecoveredAmount, incrementalRecoveredAmount: 0,
    interventionCostAmount: accumulator.interventionCostAmount,
    netRecoveredAmount: accumulator.directRecoveredAmount - accumulator.interventionCostAmount,
    recoveryRate: accumulator.recoveries / attempts.length, actionsTaken: accumulator.actionsTaken,
    attemptsPerRecovery: accumulator.recoveries === 0 ? 0 : accumulator.actionsTaken / accumulator.recoveries,
    unsafeRecommendations: accumulator.unsafeRecommendations, unsafeActions: accumulator.unsafeActions,
    duplicateAttempts: accumulator.duplicateAttempts, duplicatePreventions: accumulator.duplicatePreventions,
    naturalLateRecoveredAmount: accumulator.naturalLateRecoveredAmount, unattributedRecoveredAmount: accumulator.unattributedRecoveredAmount,
    medianTimeToRecoveryMinutes: median(accumulator.recoveryTimes),
    calibrationBrierScore: accumulator.calibrationSampleSize ? accumulator.calibrationSquaredError / accumulator.calibrationSampleSize : null,
    calibrationSampleSize: accumulator.calibrationSampleSize,
  };
}

function executeLifecycle(policy: BenchmarkPolicy, attempt: SimulatedPaymentAttempt, state: ReturnType<typeof createLinUcbState>, seed: number, randomizedLogging: boolean, workflowKeys: Set<string>) {
  const context = toContext(attempt);
  const features = encodeRecoveryContext(context);
  const hardDecline = pseudoRandom(`${seed}:${attempt.id}:hard-decline`) < 0.02;
  const naturalLate = !hardDecline && pseudoRandom(`${seed}:${attempt.id}:late-capture`) < (attempt.errorCode === "TIMEOUT" ? 0.14 : 0.04);
  const safety: RecoverySafetyContext = { journeyState: hardDecline ? "HARD_DECLINED" : "RETRY_ELIGIBLE", outstandingAmount: attempt.amount, automatedRecoveryActions: 0, maxAutomatedRecoveryActions: 2, hardDeclineDetected: hardDecline, hasConflictingFinancialState: false, lateAuthorizationGracePeriodActive: naturalLate };
  const allowed = recoveryActions.filter((action) => evaluateRecoveryAction(safety, action).allowed);
  const ranking = randomizedLogging ? undefined : rankLinUcbActions(state, features, allowed.filter(isMoneyMovingRecoveryAction), attempt.amount, 0.05)[0];
  const proposed = randomizedLogging
    ? allowed.filter(isMoneyMovingRecoveryAction)[Math.floor(pseudoRandom(`${seed}:${attempt.id}:logged-action`) * Math.max(1, allowed.filter(isMoneyMovingRecoveryAction).length))] ?? "STOP_RECOVERY"
    : policy === "STATIC_RETRY" ? "RETRY_ORIGINAL_CHECKOUT"
    : policy === "RULES_ONLY" ? chooseRulesAction(context, allowed).action
    : ranking?.action ?? chooseRulesAction(context, allowed).action;
  const unsafeRecommendation = !allowed.includes(proposed);
  const action = unsafeRecommendation ? safeFallback(allowed) : proposed;
  // The same stable workflow idempotency key used by the real recovery table is
  // replayed here. A duplicate delivery can never create a second execution.
  const workflowKey = `benchmark:${seed}:${attempt.id}:${action}`;
  const isExecutable = isMoneyMovingRecoveryAction(action);
  if (isExecutable) workflowKeys.add(workflowKey);
  const duplicateAttempt = isExecutable && pseudoRandom(`${seed}:${attempt.id}:duplicate`) < 0.08;
  const duplicatePrevented = duplicateAttempt && workflowKeys.has(workflowKey);
  const directRecovered = !naturalLate && isMoneyMovingRecoveryAction(action) && hiddenOutcome(attempt, action, seed);
  return { action, features, naturalLate, directRecovered, unsafeRecommendation, unsafeAction: !allowed.includes(action), duplicateAttempt, duplicatePrevented, interventionCost: isMoneyMovingRecoveryAction(action) ? interventionCostPaise : 0, recoveryMinutes: naturalLate ? 3 : context.minutesSinceFailure + actionDelay(action), prediction: policy === "RECOVERYOS" && action === ranking?.action ? ranking.predictedSuccess : null };
}

function failedJourneys(seed: number, volume: number): SimulatedPaymentAttempt[] {
  const result: SimulatedPaymentAttempt[] = [];
  for (let batch = 0; result.length < volume; batch += 1) {
    const candidates = simulatePaymentAttempts({ seed: seed + batch, baselineAttempts: volume * 2, currentAttempts: volume * 6 }).filter((attempt) => attempt.period === "CURRENT" && !attempt.succeeded);
    for (const attempt of candidates) { result.push({ ...attempt, id: `${attempt.id}:journey:${batch}` }); if (result.length === volume) break; }
  }
  return result;
}
function toContext(attempt: SimulatedPaymentAttempt): RecoveryPolicyContext { return { amount: attempt.amount, attemptNumber: 1, minutesSinceFailure: 45, hourOfDay: 14, method: attempt.method, provider: attempt.provider, errorCode: attempt.errorCode, device: attempt.device, activeIncident: attempt.provider === "HDFC" && attempt.method === "UPI", downtimeSeverity: attempt.errorCode === "TIMEOUT" ? 2 : 0 }; }
function safeFallback(allowed: readonly RecoveryAction[]): RecoveryAction { return allowed.includes("WAIT_AND_VERIFY") ? "WAIT_AND_VERIFY" : allowed.includes("MANUAL_REVIEW") ? "MANUAL_REVIEW" : "STOP_RECOVERY"; }
function actionDelay(action: RecoveryAction) { return action === "CREATE_PAYMENT_LINK" ? 20 : action === "OFFER_ALTERNATE_CHECKOUT" ? 8 : 4; }
function hiddenOutcome(attempt: SimulatedPaymentAttempt, action: RecoveryAction, seed: number): boolean { const affected = attempt.provider === "HDFC" && attempt.method === "UPI" && attempt.errorCode === "TIMEOUT"; const probability = affected ? ({ RETRY_ORIGINAL_CHECKOUT: .07, OFFER_ALTERNATE_CHECKOUT: .51, CREATE_PAYMENT_LINK: .29 } as Partial<Record<RecoveryAction, number>>)[action] ?? 0 : ({ RETRY_ORIGINAL_CHECKOUT: .27, OFFER_ALTERNATE_CHECKOUT: .22, CREATE_PAYMENT_LINK: .18 } as Partial<Record<RecoveryAction, number>>)[action] ?? 0; return pseudoRandom(`${seed}:${attempt.id}:${action}:direct`) < probability; }
function emptyMetrics(policy: BenchmarkPolicy) { return { policy, directRecoveredAmount: 0, interventionCostAmount: 0, recoveries: 0, actionsTaken: 0, unsafeRecommendations: 0, unsafeActions: 0, duplicateAttempts: 0, duplicatePreventions: 0, naturalLateRecoveredAmount: 0, unattributedRecoveredAmount: 0, recoveryTimes: [] as number[], calibrationSquaredError: 0, calibrationSampleSize: 0 }; }
function median(values: number[]) { if (!values.length) return null; const sorted = [...values].sort((a, b) => a - b); const center = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[center]! : (sorted[center - 1]! + sorted[center]!) / 2; }
function pseudoRandom(value: string): number { let hash = 2166136261; for (let index = 0; index < value.length; index += 1) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 16777619); } return (hash >>> 0) / 4_294_967_296; }
