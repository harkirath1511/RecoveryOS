import { NextResponse } from "next/server";
import { runHeldOutBenchmark } from "@/lib/recovery/benchmark";
import { requireOperator } from "@/lib/auth/session";
export async function GET() { const unauthorized=await requireOperator();if(unauthorized)return unauthorized; return NextResponse.json(runHeldOutBenchmark()); }
