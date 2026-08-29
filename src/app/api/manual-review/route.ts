import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createDatabase } from "@/db/client";
import { paymentJourneys, recoveryWorkflows } from "@/db/schema";
import { requireOperator } from "@/lib/auth/session";

export async function GET() {
  const unauthorized = await requireOperator();
  if (unauthorized) return unauthorized;
  try {
    const database = createDatabase();
    const journeys = await database.select({ id: paymentJourneys.id, orderId: paymentJourneys.razorpayOrderId, outstandingAmount: paymentJourneys.outstandingAmount, updatedAt: paymentJourneys.updatedAt }).from(paymentJourneys).where(eq(paymentJourneys.state, "MANUAL_REVIEW")).orderBy(desc(paymentJourneys.updatedAt)).limit(25);
    const queue = await Promise.all(journeys.map(async journey => ({ ...journey, workflows: await database.select({ action: recoveryWorkflows.action, status: recoveryWorkflows.status, terminalReason: recoveryWorkflows.terminalReason }).from(recoveryWorkflows).where(eq(recoveryWorkflows.journeyId, journey.id)) })));
    return NextResponse.json({ queue });
  } catch {
    return NextResponse.json({ queue: [] });
  }
}
