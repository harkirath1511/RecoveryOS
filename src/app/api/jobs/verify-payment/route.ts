import { NextResponse } from "next/server";
import { z } from "zod";
import { createDatabase } from "@/db/client";
import { paymentJourneys } from "@/db/schema";
import { eq } from "drizzle-orm";
import { transitionPaymentJourney } from "@/lib/recovery/payment-journey";
import { verifyQStashSignature } from "@/lib/qstash/verify";

const jobSchema = z.object({ journeyId: z.string().uuid(), expectedState: z.literal("FAILED_PENDING_VERIFICATION") });
export async function POST(request: Request) { try { const raw=await request.text(); const verified=await verifyQStashSignature({body:raw,signature:request.headers.get("upstash-signature"),currentSigningKey:process.env.QSTASH_CURRENT_SIGNING_KEY,nextSigningKey:process.env.QSTASH_NEXT_SIGNING_KEY}); if(!verified)return NextResponse.json({processed:false,error:"Invalid or unconfigured QStash signature."},{status:401});const job=jobSchema.parse(JSON.parse(raw)); const db=createDatabase(); const [journey]=await db.select().from(paymentJourneys).where(eq(paymentJourneys.id,job.journeyId)).limit(1); if(!journey) return NextResponse.json({processed:false,reason:"Journey not found"},{status:404}); if(journey.state!==job.expectedState) return NextResponse.json({processed:false,reason:"Stale job safely ignored"}); const transition=transitionPaymentJourney(journey.state,"VERIFICATION_EXPIRED"); if(transition.accepted) await db.update(paymentJourneys).set({state:transition.state,updatedAt:new Date()}).where(eq(paymentJourneys.id,journey.id)); return NextResponse.json({processed:transition.accepted,state:transition.state}); } catch(error) { return NextResponse.json({processed:false,error:error instanceof Error?error.message:"Invalid job"},{status:400}); } }
