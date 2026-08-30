import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createDatabase } from "@/db/client";
import { auditEntries } from "@/db/schema";
import { requireOperator } from "@/lib/auth/session";
export async function GET() {
  const unauthorized = await requireOperator();
  if (unauthorized) return unauthorized;
  try {
    const entries = await createDatabase().select({ entityType: auditEntries.entityType, eventType: auditEntries.eventType, createdAt: auditEntries.createdAt }).from(auditEntries).orderBy(desc(auditEntries.createdAt)).limit(20);
    return NextResponse.json({ entries });
  } catch {
    return NextResponse.json({ entries: [], error: "Audit evidence is temporarily unavailable. Retry shortly." });
  }
}
