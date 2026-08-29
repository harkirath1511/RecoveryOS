import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createDatabase } from "@/db/client";
import { webhookEvents } from "@/db/schema";
export async function GET() { try { const events = await createDatabase().select({ id: webhookEvents.razorpayEventId, type: webhookEvents.eventType, receivedAt: webhookEvents.receivedAt }).from(webhookEvents).orderBy(desc(webhookEvents.receivedAt)).limit(15); return NextResponse.json({ events }); } catch { return NextResponse.json({ events: [] }); } }
