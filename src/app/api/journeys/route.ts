import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createDatabase } from "@/db/client";
import { paymentJourneys } from "@/db/schema";

export async function GET() {
  try {
    const journeys = await createDatabase().select({ id: paymentJourneys.id, orderId: paymentJourneys.razorpayOrderId, state: paymentJourneys.state, outstandingAmount: paymentJourneys.outstandingAmount, updatedAt: paymentJourneys.updatedAt }).from(paymentJourneys).orderBy(desc(paymentJourneys.updatedAt)).limit(10);
    return NextResponse.json({ journeys });
  } catch { return NextResponse.json({ journeys: [] }); }
}
