import { NextResponse } from "next/server";
import { requireOperator } from "@/lib/auth/session";
import { detectPaymentIncident } from "@/lib/recovery/incident-detector";
import { simulatePaymentAttempts } from "@/lib/recovery/simulator";

export async function GET() {
  const unauthorized = await requireOperator();
  if (unauthorized) return unauthorized;
  const attempts = simulatePaymentAttempts();
  const incident = detectPaymentIncident(attempts);
  if (!incident) return NextResponse.json({ incident: null });
  const affected = attempts.filter(attempt => attempt.period === "CURRENT" && !attempt.succeeded && attempt.provider === "HDFC" && attempt.method === "UPI" && attempt.device === "ANDROID");
  const averageAmount = affected.length ? Math.round(affected.reduce((total, attempt) => total + attempt.amount, 0) / affected.length) : 0;
  return NextResponse.json({ incident, revenueAtRisk: incident.topSegment.excessFailures * averageAmount, source: "SYNTHETIC_SIMULATOR" });
}
