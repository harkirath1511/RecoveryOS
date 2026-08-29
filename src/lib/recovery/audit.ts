export type AuditRecord = { entityType: "JOURNEY" | "DECISION" | "WORKFLOW"; entityId: string; eventType: string; evidence: Record<string, unknown> };
export function buildAuditRecord(record: AuditRecord): AuditRecord { return { ...record, evidence: structuredClone(record.evidence) }; }
