import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOperator } from "@/lib/auth/session";
import { createDatabase } from "@/db/client";
import { downtimeSignals } from "@/db/schema";

const signalSchema = z.object({ provider: z.string().min(1).max(80).optional(), method: z.string().min(1).max(80).optional(), status: z.enum(["ACTIVE", "RESOLVED"]), source: z.enum(["RAZORPAY_STATUS", "PROVIDER_STATUS", "OPERATOR_CONFIRMED"]), observedAt: z.coerce.date(), evidence: z.record(z.string(), z.unknown()).default({}) });
export async function POST(request: Request) { const unauthorized=await requireOperator(); if(unauthorized)return unauthorized; try { const input=signalSchema.parse(await request.json()); const [signal]=await createDatabase().insert(downtimeSignals).values({provider:input.provider?.toUpperCase(),method:input.method?.toUpperCase(),status:input.status,source:input.source,observedAt:input.observedAt,resolvedAt:input.status==="RESOLVED"?new Date():null,evidence:input.evidence}).returning(); return NextResponse.json({signal}); } catch(error) { return NextResponse.json({error:error instanceof Error?error.message:"Invalid downtime signal."},{status:400}); } }
