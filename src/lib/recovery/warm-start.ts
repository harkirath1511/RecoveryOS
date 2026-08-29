import { createLinUcbState, updateLinUcb, type LinUcbState } from "./linucb";
import { encodeRecoveryContext, type RecoveryPolicyContext } from "./policy-context";
import type { RecoveryAction } from "./safety-policy";
import { simulatePaymentAttempts, type SimulatedPaymentAttempt } from "./simulator";

export const warmStartPolicyVersion = "recovery-v1";
const safeLoggingActions: RecoveryAction[] = ["RETRY_ORIGINAL_CHECKOUT", "OFFER_ALTERNATE_CHECKOUT", "CREATE_PAYMENT_LINK"];
export type LoggedInteraction = { seed: number; context: RecoveryPolicyContext; action: RecoveryAction; directRecovery: boolean };
export type WarmStartResult = { policyVersion: string; state: LinUcbState; interactions: LoggedInteraction[]; trainingSeed: number; evaluationSeed: number };

export function generateSafeLoggedInteractions(trainingSeed: number, evaluationSeed: number, count = 250): LoggedInteraction[] {
  if (trainingSeed === evaluationSeed) throw new Error("Training and evaluation seeds must differ.");
  const candidates = simulatePaymentAttempts({ seed: trainingSeed, baselineAttempts: count, currentAttempts: count }).filter((attempt) => attempt.period === "CURRENT" && !attempt.succeeded);
  const random = seededRandom(trainingSeed ^ 0x9e3779b9);
  return candidates.map((attempt) => { const context = toContext(attempt); const action = safeLoggingActions[Math.floor(random() * safeLoggingActions.length)]!; return { seed: trainingSeed, context, action, directRecovery: hiddenOutcome(attempt, action, trainingSeed) }; });
}

export function warmStartBandit(trainingSeed = 101, evaluationSeed = 202, count = 250): WarmStartResult {
  const interactions = generateSafeLoggedInteractions(trainingSeed, evaluationSeed, count);
  const featureCount = encodeRecoveryContext(interactions[0]?.context ?? emptyContext()).length;
  let state = createLinUcbState(safeLoggingActions, featureCount, warmStartPolicyVersion);
  for (const interaction of interactions) state = updateLinUcb(state, interaction.action, encodeRecoveryContext(interaction.context), interaction.directRecovery);
  return { policyVersion: warmStartPolicyVersion, state, interactions, trainingSeed, evaluationSeed };
}

function toContext(attempt: SimulatedPaymentAttempt): RecoveryPolicyContext { return { amount: attempt.amount, attemptNumber: 1, minutesSinceFailure: 45, hourOfDay: 14, method: attempt.method, provider: attempt.provider, errorCode: attempt.errorCode, device: attempt.device, activeIncident: attempt.provider === "HDFC" && attempt.method === "UPI", downtimeSeverity: attempt.errorCode === "TIMEOUT" ? 2 : 0 }; }
function emptyContext(): RecoveryPolicyContext { return { amount: 0, attemptNumber: 0, minutesSinceFailure: 0, hourOfDay: 0, method: "OTHER", provider: "OTHER", errorCode: "OTHER", device: "OTHER", activeIncident: false, downtimeSeverity: 0 }; }
// Hidden synthetic environment: it is never sent to UI, policy contexts, or logged evidence.
function hiddenOutcome(attempt: SimulatedPaymentAttempt, action: RecoveryAction, seed: number): boolean { const affected=attempt.provider==="HDFC"&&attempt.method==="UPI"&&attempt.errorCode==="TIMEOUT"; const probability=affected?(({RETRY_ORIGINAL_CHECKOUT:.07,OFFER_ALTERNATE_CHECKOUT:.51,CREATE_PAYMENT_LINK:.29} as Partial<Record<RecoveryAction,number>>)[action]??0):(({RETRY_ORIGINAL_CHECKOUT:.27,OFFER_ALTERNATE_CHECKOUT:.22,CREATE_PAYMENT_LINK:.18} as Partial<Record<RecoveryAction,number>>)[action]??0); return seededRandom(hash(`${seed}:${attempt.id}:${action}`))()<probability; }
function seededRandom(seed:number){let value=seed>>>0;return()=>{value+=0x6d2b79f5;let x=value;x=Math.imul(x^(x>>>15),x|1);x^=x+Math.imul(x^(x>>>7),x|61);return((x^(x>>>14))>>>0)/4294967296;};}
function hash(value:string){let hash=2166136261;for(const character of value){hash^=character.charCodeAt(0);hash=Math.imul(hash,16777619);}return hash>>>0;}
