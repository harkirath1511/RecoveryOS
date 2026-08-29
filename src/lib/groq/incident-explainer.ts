import type { PaymentIncident } from "@/lib/recovery/incident-detector";

export function buildIncidentExplanationPrompt(incident: PaymentIncident): string {
  return `You are a payments operations explainer. Explain only the supplied evidence, in plain language. Do not invent facts, promise recovery, suggest an unsafe action, or claim real revenue. Evidence: ${JSON.stringify({ baselineSuccess: incident.overallBaseline.successRate, currentSuccess: incident.overallCurrent.successRate, rootCause: incident.topSegment.label, drop: incident.topSegment.successRateDrop, excessFailures: incident.topSegment.excessFailures, confidenceZScore: incident.topSegment.zScore })}`;
}

export async function explainIncidentWithGroq(incident: PaymentIncident): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY is not configured.");
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", { method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, body: JSON.stringify({ model: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile", temperature: 0.1, messages: [{ role: "user", content: buildIncidentExplanationPrompt(incident) }] }) });
  if (!response.ok) throw new Error("Groq explanation request failed.");
  const body = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  return body.choices?.[0]?.message?.content?.trim() || "No explanation was returned.";
}
