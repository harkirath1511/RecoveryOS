import { NextResponse } from "next/server";
import { detectPaymentIncident } from "@/lib/recovery/incident-detector";
import { simulatePaymentAttempts } from "@/lib/recovery/simulator";
import { explainIncidentWithGroq } from "@/lib/groq/incident-explainer";
export async function POST() { try { const incident = detectPaymentIncident(simulatePaymentAttempts()); if (!incident) return NextResponse.json({ error: "No incident detected." }, { status: 404 }); return NextResponse.json({ explanation: await explainIncidentWithGroq(incident) }); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Explanation unavailable." }, { status: 503 }); } }
