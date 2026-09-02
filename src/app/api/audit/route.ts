import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createDatabase } from "@/db/client";
import { auditEntries } from "@/db/schema";
import { requireOperator } from "@/lib/auth/session";
export async function GET() {
  const unauthorized = await requireOperator();
  if (unauthorized) return unauthorized;
  try {
    const entries = await createDatabase().select({ id:auditEntries.id, journeyId:auditEntries.journeyId, webhookEventId:auditEntries.webhookEventId, decisionId:auditEntries.decisionId, outcomeId:auditEntries.outcomeId, actor:auditEntries.actor, entityType: auditEntries.entityType, entityId:auditEntries.entityId, action:auditEntries.action, eventType: auditEntries.eventType, reason:auditEntries.reason, previousState:auditEntries.previousState, nextState:auditEntries.nextState, evidence:auditEntries.evidence, createdAt: auditEntries.createdAt }).from(auditEntries).orderBy(desc(auditEntries.createdAt)).limit(100);
    return NextResponse.json({ entries });
  } catch {
    return NextResponse.json({ error: "Audit evidence is temporarily unavailable because the database cannot be reached." }, { status: 503 });
  }
}
