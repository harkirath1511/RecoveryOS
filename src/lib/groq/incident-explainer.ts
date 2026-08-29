import { z } from "zod";
import type { PaymentIncident } from "@/lib/recovery/incident-detector";
import { env } from "@/lib/env";

const citationSchema = z.object({ type: z.enum(["INCIDENT", "DECISION", "AUDIT"]), id: z.string().min(1), claim: z.string().min(1).max(240) });
export const incidentExplanationSchema = z.object({ summary: z.string().min(1).max(600), findings: z.array(z.string().min(1).max(360)).min(1).max(4), recommendedNextStep: z.string().min(1).max(240), citations: z.array(citationSchema).min(1).max(12) });
export type IncidentExplanation = z.infer<typeof incidentExplanationSchema>;
export type EvidenceCitation = z.infer<typeof citationSchema>;
export type ExplanationResult = { explanation: IncidentExplanation; provider: "GROQ" | "DETERMINISTIC_FALLBACK"; fallbackReason?: string };
export type IncidentExplanationInput = { incident: PaymentIncident; citations: EvidenceCitation[] };
export interface IncidentExplanationProvider { explain(input: IncidentExplanationInput): Promise<IncidentExplanation>; }

export function buildIncidentExplanationPrompt(input: IncidentExplanationInput): string {
  return `Explain only this stored payment evidence. Do not invent facts, promise recovery, recommend an unsafe action, or claim real merchant revenue. Return JSON matching this schema: {summary:string,findings:string[],recommendedNextStep:string,citations:[{type:"INCIDENT"|"DECISION"|"AUDIT",id:string,claim:string}]}. Cite only the exact citation IDs supplied.\nEvidence: ${JSON.stringify({ baselineSuccess: input.incident.overallBaseline.successRate, currentSuccess: input.incident.overallCurrent.successRate, rootCause: input.incident.topSegment.label, drop: input.incident.topSegment.successRateDrop, excessFailures: input.incident.topSegment.excessFailures, confidenceZScore: input.incident.topSegment.zScore, citations: input.citations })}`;
}

export class GroqIncidentExplanationProvider implements IncidentExplanationProvider {
  constructor(private readonly apiKey: string, private readonly model = env.GROQ_MODEL) {}
  async explain(input: IncidentExplanationInput): Promise<IncidentExplanation> {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", { method: "POST", headers: { authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" }, body: JSON.stringify({ model: this.model, temperature: 0, response_format: { type: "json_object" }, messages: [{ role: "user", content: buildIncidentExplanationPrompt(input) }] }) });
    if (!response.ok) throw new Error("Groq explanation request failed.");
    const body = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const parsed = incidentExplanationSchema.parse(JSON.parse(body.choices?.[0]?.message?.content ?? ""));
    const allowedIds = new Set(input.citations.map((citation) => citation.id));
    if (parsed.citations.some((citation) => !allowedIds.has(citation.id))) throw new Error("Groq cited evidence that was not supplied.");
    return parsed;
  }
}

export async function explainIncident(input: IncidentExplanationInput, provider?: IncidentExplanationProvider): Promise<ExplanationResult> {
  const selected = provider ?? (env.GROQ_API_KEY ? new GroqIncidentExplanationProvider(env.GROQ_API_KEY) : undefined);
  if (!selected) return { explanation: deterministicIncidentExplanation(input), provider: "DETERMINISTIC_FALLBACK", fallbackReason: "GROQ_API_KEY is not configured." };
  try { return { explanation: await selected.explain(input), provider: "GROQ" }; }
  catch (error) { return { explanation: deterministicIncidentExplanation(input), provider: "DETERMINISTIC_FALLBACK", fallbackReason: error instanceof Error ? error.message : "Groq explanation failed." }; }
}

export function deterministicIncidentExplanation(input: IncidentExplanationInput): IncidentExplanation { const { incident } = input; return { summary: `Success rate declined from ${(incident.overallBaseline.successRate * 100).toFixed(1)}% to ${(incident.overallCurrent.successRate * 100).toFixed(1)}% in the current window. The highest-contributing cohort is ${incident.topSegment.label}.`, findings: [`The cohort contributes ${incident.topSegment.excessFailures} estimated excess failures.`, `The observed success-rate drop is ${(incident.topSegment.successRateDrop * 100).toFixed(1)} percentage points with a ${incident.topSegment.zScore.toFixed(1)}σ signal.`], recommendedNextStep: "Inspect the cited safety decision and audit evidence before executing any recovery action.", citations: input.citations }; }
