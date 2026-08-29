import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { runHeldOutBenchmark } from "@/lib/recovery/benchmark";
import { requireOperator } from "@/lib/auth/session";
import { createDatabase } from "@/db/client";
import { benchmarkRuns } from "@/db/schema";
import { policyFeatureSchemaVersion } from "@/lib/recovery/policy-context";
const requestSchema = z.object({ trainingSeed: z.number().int().nonnegative(), evaluationSeed: z.number().int().nonnegative(), volume: z.number().int().min(500).max(2_000) });
export async function GET() { const unauthorized=await requireOperator();if(unauthorized)return unauthorized; try { const result=runHeldOutBenchmark(); return NextResponse.json({...result,runId:await persistBenchmark(result)}); } catch(error) { return NextResponse.json({error:error instanceof Error?error.message:"Benchmark unavailable."},{status:400}); } }
export async function POST(request: Request) { const unauthorized=await requireOperator();if(unauthorized)return unauthorized; try { const input=requestSchema.parse(await request.json()); const result=runHeldOutBenchmark(input.trainingSeed,input.evaluationSeed,input.volume); return NextResponse.json({...result,runId:await persistBenchmark(result)}); } catch(error) { return NextResponse.json({error:error instanceof Error?error.message:"Invalid benchmark request."},{status:400}); } }
async function persistBenchmark(result: ReturnType<typeof runHeldOutBenchmark>) { const database=createDatabase(); const [existing]=await database.select({id:benchmarkRuns.id}).from(benchmarkRuns).where(eq(benchmarkRuns.reproducibilityKey,result.reproducibilityKey)).limit(1); if(existing)return existing.id; const [run]=await database.insert(benchmarkRuns).values({trainingSeed:result.trainingSeed,evaluationSeed:result.evaluationSeed,volume:result.volume,policyVersion:policyFeatureSchemaVersion,datasetSplit:"HELD_OUT",configurationSnapshot:{featureSchema:policyFeatureSchemaVersion,trainingSeed:result.trainingSeed,evaluationSeed:result.evaluationSeed,volume:result.volume,protocol:result.protocol},reproducibilityKey:result.reproducibilityKey,metrics:result.metrics}).returning({id:benchmarkRuns.id}); return run!.id; }
