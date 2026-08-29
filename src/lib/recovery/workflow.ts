import type { RecoveryAction, SafetyDecision } from "./safety-policy";
export type RecoveryWorkflow = { id: string; journeyId: string; action: RecoveryAction; status: "PENDING" | "EXECUTED" | "STOPPED" | "MANUAL_REVIEW" };
export function createWorkflow(id: string, journeyId: string, safety: SafetyDecision): RecoveryWorkflow { return { id, journeyId, action: safety.action, status: !safety.allowed || safety.action === "STOP_RECOVERY" ? "STOPPED" : safety.action === "MANUAL_REVIEW" ? "MANUAL_REVIEW" : "PENDING" }; }
