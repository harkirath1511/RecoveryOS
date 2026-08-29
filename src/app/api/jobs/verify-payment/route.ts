import { NextResponse } from "next/server";
import { z } from "zod";
import { createDatabase } from "@/db/client";
import { paymentJourneys, recoveryWorkflows } from "@/db/schema";
import { eq } from "drizzle-orm";
import { transitionPaymentJourney } from "@/lib/recovery/payment-journey";
import { verifyQStashSignature } from "@/lib/qstash/verify";

const jobSchema = z.object({ journeyId: z.string().uuid(), workflowId: z.string().uuid(), expectedState: z.literal("FAILED_PENDING_VERIFICATION") });
export async function POST(request: Request) {
  try {
    const raw = await request.text();
    const verified = await verifyQStashSignature({ body: raw, signature: request.headers.get("upstash-signature"), currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY, nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY });
    if (!verified) return NextResponse.json({ processed: false, error: "Invalid or unconfigured QStash signature." }, { status: 401 });
    const job = jobSchema.parse(JSON.parse(raw));
    const db = createDatabase();
    const [journeyRows, workflowRows] = await Promise.all([db.select().from(paymentJourneys).where(eq(paymentJourneys.id, job.journeyId)).limit(1), db.select().from(recoveryWorkflows).where(eq(recoveryWorkflows.id, job.workflowId)).limit(1)]);
    const journey = journeyRows[0];
    const workflow = workflowRows[0];
    if (!journey || !workflow || workflow.journeyId !== job.journeyId) return NextResponse.json({ processed: false, reason: "Journey or workflow not found" }, { status: 404 });
    if (journey.state !== job.expectedState) {
      await db.update(recoveryWorkflows).set({ status: "STOPPED", terminalReason: "STALE_JOB", updatedAt: new Date() }).where(eq(recoveryWorkflows.id, workflow.id));
      return NextResponse.json({ processed: false, reason: "Stale job safely ignored" });
    }
    const transition = transitionPaymentJourney(journey.state, "VERIFICATION_EXPIRED");
    if (transition.accepted) {
      await db.update(paymentJourneys).set({ state: transition.state, updatedAt: new Date() }).where(eq(paymentJourneys.id, journey.id));
      await db.update(recoveryWorkflows).set({ status: "EXECUTED", executedAt: new Date(), updatedAt: new Date() }).where(eq(recoveryWorkflows.id, workflow.id));
    }
    return NextResponse.json({ processed: transition.accepted, state: transition.state });
  } catch (error) {
    return NextResponse.json({ processed: false, error: error instanceof Error ? error.message : "Invalid job" }, { status: 400 });
  }
}
