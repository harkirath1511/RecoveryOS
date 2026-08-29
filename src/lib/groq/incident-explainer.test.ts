import { describe, expect, it } from "vitest";
import { buildIncidentExplanationPrompt, explainIncident, type IncidentExplanationProvider } from "./incident-explainer";

const input = { incident: { overallBaseline: { attempts: 10, successes: 9, successRate: .9 }, overallCurrent: { attempts: 10, successes: 5, successRate: .5 }, topSegment: { key: "x", label: "Provider: HDFC", baseline: { attempts: 1, successes: 1, successRate: 1 }, current: { attempts: 1, successes: 0, successRate: 0 }, successRateDrop: 1, excessFailures: 1, zScore: 3 }, totalExcessFailures: 4 }, citations: [{ type: "INCIDENT" as const, id: "incident-1", claim: "Stored incident." }, { type: "AUDIT" as const, id: "audit-1", claim: "Stored audit." }] };

describe("structured incident explanation", () => {
  it("contains evidence and safety boundaries", () => { const prompt = buildIncidentExplanationPrompt(input); expect(prompt).toContain("Provider: HDFC"); expect(prompt).toContain("Do not invent facts"); expect(prompt).toContain("incident-1"); });
  it("returns deterministic cited evidence when a provider fails", async () => { const failing: IncidentExplanationProvider = { explain: async () => { throw new Error("unavailable"); } }; const result = await explainIncident(input, failing); expect(result.provider).toBe("DETERMINISTIC_FALLBACK"); expect(result.explanation.citations).toEqual(input.citations); expect(result.explanation.summary).toContain("Provider: HDFC"); });
});
