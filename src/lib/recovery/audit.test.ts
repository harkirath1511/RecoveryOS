import { describe, expect, it } from "vitest";
import { buildAuditRecord } from "./audit";
describe("audit records", () => { it("copies evidence to protect the audit snapshot", () => { const evidence={action:"CREATE_PAYMENT_LINK"}; const record=buildAuditRecord({entityType:"DECISION",entityId:"d1",eventType:"CREATED",evidence}); evidence.action="STOP"; expect(record.evidence.action).toBe("CREATE_PAYMENT_LINK"); }); });
