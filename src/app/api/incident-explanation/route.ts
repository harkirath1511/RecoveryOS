import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOperator } from "@/lib/auth/session";
import { createDatabase } from "@/db/client";
import { auditEntries, incidents, recoveryDecisions } from "@/db/schema";
import { explainIncident, type EvidenceCitation } from "@/lib/groq/incident-explainer";
import type { PaymentIncident } from "@/lib/recovery/incident-detector";

const requestSchema = z.object({ incidentId: z.string().uuid().optional() }).default({});
const metricsSchema = z.object({ attempts: z.number(), successes: z.number(), successRate: z.number() });
const segmentSchema = z.object({ key: z.string(), label: z.string(), baseline: metricsSchema, current: metricsSchema, successRateDrop: z.number(), excessFailures: z.number(), zScore: z.number() });

export async function POST(request: Request) {
  const unauthorized = await requireOperator();
  if (unauthorized) return unauthorized;
  try {
    const input = requestSchema.parse(await request.json().catch(() => ({})));
    const database = createDatabase();
    const [incident] = input.incidentId ? await database.select().from(incidents).where(eq(incidents.id, input.incidentId)).limit(1) : await database.select().from(incidents).where(eq(incidents.status, "OPEN")).orderBy(desc(incidents.openedAt)).limit(1);
    if (!incident) return NextResponse.json({ error: "No open incident with stored evidence is available." }, { status: 404 });
    const paymentIncident: PaymentIncident = { overallBaseline: metricsSchema.parse(incident.baselineWindow), overallCurrent: metricsSchema.parse(incident.currentWindow), topSegment: segmentSchema.parse(incident.affectedSegment), totalExcessFailures: incident.excessFailureContribution };
    const [decisions, audits] = await Promise.all([database.select().from(recoveryDecisions).orderBy(desc(recoveryDecisions.createdAt)).limit(3), database.select().from(auditEntries).orderBy(desc(auditEntries.createdAt)).limit(5)]);
    const citations: EvidenceCitation[] = [{ type: "INCIDENT", id: incident.id, claim: `Open incident for ${paymentIncident.topSegment.label}.` }, ...decisions.map((decision) => ({ type: "DECISION" as const, id: decision.id, claim: `${decision.action} selected by ${decision.policy}.` })), ...audits.map((audit) => ({ type: "AUDIT" as const, id: audit.id, claim: `${audit.eventType}: ${audit.reason ?? "stored audit event"}.` }))];
    return NextResponse.json(await explainIncident({ incident: paymentIncident, citations }));
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Explanation unavailable." }, { status: 400 }); }
}
