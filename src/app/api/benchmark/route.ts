import { NextResponse } from "next/server";
import { runHeldOutBenchmark } from "@/lib/recovery/benchmark";
export async function GET() { return NextResponse.json(runHeldOutBenchmark()); }
