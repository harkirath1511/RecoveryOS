import { NextResponse } from "next/server";
import { z } from "zod";
import { runHeldOutBenchmark } from "@/lib/recovery/benchmark";
import { requireOperator } from "@/lib/auth/session";
import { createDatabase } from "@/db/client";
import { benchmarkRuns } from "@/db/schema";
const requestSchema = z.object({ trainingSeed: z.number().int().nonnegative(), evaluationSeed: z.number().int().nonnegative(), volume: z.number().int().min(100).max(2_000) });
export async function GET() { const unauthorized=await requireOperator();if(unauthorized)return unauthorized; return NextResponse.json(runHeldOutBenchmark()); }
export async function POST(request: Request) { const unauthorized=await requireOperator();if(unauthorized)return unauthorized; try { const input=requestSchema.parse(await request.json()); const result=runHeldOutBenchmark(input.trainingSeed,input.evaluationSeed,input.volume); const [run]=await createDatabase().insert(benchmarkRuns).values({trainingSeed:result.trainingSeed,evaluationSeed:result.evaluationSeed,volume:result.volume,reproducibilityKey:result.reproducibilityKey,metrics:result.metrics}).returning({id:benchmarkRuns.id}); return NextResponse.json({...result,runId:run!.id}); } catch(error) { return NextResponse.json({error:error instanceof Error?error.message:"Invalid benchmark request."},{status:400}); } }
