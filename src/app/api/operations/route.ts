import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createDatabase } from "@/db/client";
import { paymentJourneys, webhookEvents } from "@/db/schema";
import { requireOperator } from "@/lib/auth/session";
export async function GET() { const unauthorized=await requireOperator();if(unauthorized)return unauthorized; try { const db = createDatabase(); const [journeys, events, captured] = await Promise.all([db.select({ count: sql<number>`count(*)` }).from(paymentJourneys), db.select({ count: sql<number>`count(*)` }).from(webhookEvents), db.select({ count: sql<number>`count(*)` }).from(paymentJourneys).where(eq(paymentJourneys.state, "CAPTURED"))]); return NextResponse.json({ journeys: Number(journeys[0]?.count ?? 0), signedEvents: Number(events[0]?.count ?? 0), capturedJourneys: Number(captured[0]?.count ?? 0) }); } catch { return NextResponse.json({ journeys: 0, signedEvents: 0, capturedJourneys: 0 }); } }
