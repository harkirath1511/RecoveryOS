import { desc, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createDatabase } from "@/db/client";
import { auditEntries } from "@/db/schema";
import { requireOperator } from "@/lib/auth/session";
const querySchema = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(10).max(100).default(50) });
export async function GET(request: Request) {
  const unauthorized = await requireOperator();
  if (unauthorized) return unauthorized;
  try {
    const input = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const database = createDatabase();
    const [entries, count] = await Promise.all([
      database.select({ id:auditEntries.id, journeyId:auditEntries.journeyId, webhookEventId:auditEntries.webhookEventId, decisionId:auditEntries.decisionId, outcomeId:auditEntries.outcomeId, actor:auditEntries.actor, entityType: auditEntries.entityType, entityId:auditEntries.entityId, action:auditEntries.action, eventType: auditEntries.eventType, reason:auditEntries.reason, previousState:auditEntries.previousState, nextState:auditEntries.nextState, evidence:auditEntries.evidence, createdAt: auditEntries.createdAt }).from(auditEntries).orderBy(desc(auditEntries.createdAt)).limit(input.pageSize).offset((input.page - 1) * input.pageSize),
      database.select({ count: sql<number>`count(*)` }).from(auditEntries),
    ]);
    const total = Number(count[0]?.count ?? 0); const totalPages = Math.max(1, Math.ceil(total / input.pageSize));
    return NextResponse.json({ entries, pagination: { page: Math.min(input.page, totalPages), pageSize: input.pageSize, total, totalPages } });
  } catch {
    return NextResponse.json({ error: "Audit evidence is temporarily unavailable because the database cannot be reached." }, { status: 503 });
  }
}
