import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createDatabase } from "@/db/client";
import { webhookEvents } from "@/db/schema";
import { requireOperator } from "@/lib/auth/session";
export async function GET() { const unauthorized=await requireOperator();if(unauthorized)return unauthorized; try { const events = await createDatabase().select({ id: webhookEvents.razorpayEventId, type: webhookEvents.eventType, receivedAt: webhookEvents.receivedAt }).from(webhookEvents).orderBy(desc(webhookEvents.receivedAt)).limit(15); return NextResponse.json({ events }); } catch { return NextResponse.json({ events: [] }); } }
