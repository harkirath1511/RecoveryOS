import { createLinUcbState, rankLinUcbActions, updateLinUcb } from "./linucb";
import { encodeRecoveryContext, type RecoveryPolicyContext } from "./policy-context";
import { chooseRulesAction } from "./rules-policy";
import type { RecoveryAction } from "./safety-policy";
import { simulatePaymentAttempts, type SimulatedPaymentAttempt } from "./simulator";

export type BenchmarkPolicy = "STATIC_RETRY" | "RULES_ONLY" | "RECOVERYOS";
export type BenchmarkMetrics = { policy: BenchmarkPolicy; directRecoveredAmount: number; recoveryRate: number; actionsTaken: number; attemptsPerRecovery: number };
export type BenchmarkResult = { trainingSeed: number; evaluationSeed: number; metrics: BenchmarkMetrics[]; reproducibilityKey: string };

const actions: RecoveryAction[] = ["RETRY_ORIGINAL_CHECKOUT", "OFFER_ALTERNATE_CHECKOUT", "CREATE_PAYMENT_LINK"];

export function runHeldOutBenchmark(trainingSeed = 101, evaluationSeed = 202): BenchmarkResult {
  if (trainingSeed === evaluationSeed) throw new Error("Training and evaluation seeds must differ.");
  const training = failedAttempts(trainingSeed);
  const evaluation = failedAttempts(evaluationSeed);
  let state = createLinUcbState(actions, encodeRecoveryContext(toContext(training[0]!)).length);

  for (const attempt of training) {
    const context = encodeRecoveryContext(toContext(attempt));
    for (const action of actions) state = updateLinUcb(state, action, context, recoveryOutcome(attempt, action, trainingSeed));
  }

  const policies: BenchmarkPolicy[] = ["STATIC_RETRY", "RULES_ONLY", "RECOVERYOS"];
  const metrics = policies.map((policy) => scorePolicy(policy, evaluation, state, evaluationSeed));
  return { trainingSeed, evaluationSeed, metrics, reproducibilityKey: `benchmark-v1:${trainingSeed}:${evaluationSeed}:${evaluation.length}` };
}

function scorePolicy(policy: BenchmarkPolicy, attempts: SimulatedPaymentAttempt[], state: ReturnType<typeof createLinUcbState>, seed: number): BenchmarkMetrics {
  let recovered = 0;
  for (const attempt of attempts) {
    const context = toContext(attempt);
    const action = policy === "STATIC_RETRY" ? "RETRY_ORIGINAL_CHECKOUT" : policy === "RULES_ONLY"
      ? chooseRulesAction(context, actions).action
      : rankLinUcbActions(state, encodeRecoveryContext(context), actions, attempt.amount, 0.05)[0]!.action;
    if (recoveryOutcome(attempt, action, seed)) recovered += attempt.amount;
  }
  const successfulRecoveries = recovered === 0 ? 0 : attempts.filter((attempt) => {
    const context = toContext(attempt);
    const action = policy === "STATIC_RETRY" ? "RETRY_ORIGINAL_CHECKOUT" : policy === "RULES_ONLY" ? chooseRulesAction(context, actions).action : rankLinUcbActions(state, encodeRecoveryContext(context), actions, attempt.amount, 0.05)[0]!.action;
    return recoveryOutcome(attempt, action, seed);
  }).length;
  return { policy, directRecoveredAmount: recovered, recoveryRate: successfulRecoveries / attempts.length, actionsTaken: attempts.length, attemptsPerRecovery: successfulRecoveries === 0 ? 0 : attempts.length / successfulRecoveries };
}

function failedAttempts(seed: number): SimulatedPaymentAttempt[] {
  return simulatePaymentAttempts({ seed, baselineAttempts: 300, currentAttempts: 300 }).filter((attempt) => attempt.period === "CURRENT" && !attempt.succeeded);
}

function toContext(attempt: SimulatedPaymentAttempt): RecoveryPolicyContext {
  return { amount: attempt.amount, attemptNumber: 1, minutesSinceFailure: 45, hourOfDay: 14, method: attempt.method, provider: attempt.provider, errorCode: attempt.errorCode, device: attempt.device, activeIncident: attempt.provider === "HDFC" && attempt.method === "UPI", downtimeSeverity: attempt.errorCode === "TIMEOUT" ? 2 : 0 };
}

// Deliberately internal simulator behavior; policies never receive these probabilities.
function recoveryOutcome(attempt: SimulatedPaymentAttempt, action: RecoveryAction, seed: number): boolean {
  const affectedTimeout = attempt.provider === "HDFC" && attempt.method === "UPI" && attempt.errorCode === "TIMEOUT";
  const probability = affectedTimeout
    ? ({ RETRY_ORIGINAL_CHECKOUT: .07, OFFER_ALTERNATE_CHECKOUT: .51, CREATE_PAYMENT_LINK: .29 } as Partial<Record<RecoveryAction, number>>)[action] ?? 0
    : ({ RETRY_ORIGINAL_CHECKOUT: .27, OFFER_ALTERNATE_CHECKOUT: .22, CREATE_PAYMENT_LINK: .18 } as Partial<Record<RecoveryAction, number>>)[action] ?? 0;
  return pseudoRandom(`${seed}:${attempt.id}:${action}`) < probability;
}

function pseudoRandom(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0) / 4_294_967_296;
}
