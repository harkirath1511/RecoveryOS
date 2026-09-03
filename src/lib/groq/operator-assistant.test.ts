import { afterEach, describe, expect, it, vi } from "vitest";
import { answerOperatorQuestion, buildOperatorAssistantPrompt, GroqOperatorAssistantProvider, type OperatorAssistantProvider } from "./operator-assistant";

const input = {
  question: "Why is this journey still unpaid?",
  evidence: { journey: { state: "RETRY_ELIGIBLE" } },
  citations: [{ type: "JOURNEY" as const, id: "journey-1", claim: "Journey journey-1 is RETRY_ELIGIBLE." }],
};

describe("Groq operator assistant", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("includes only the bounded question and evidence in its prompt", () => {
    const prompt = buildOperatorAssistantPrompt(input);
    expect(prompt).toContain(input.question);
    expect(prompt).toContain("RETRY_ELIGIBLE");
  });

  it("returns a provider answer only when every citation was supplied", async () => {
    const provider: OperatorAssistantProvider = { answer: async () => ({ answer: "The payment is eligible for recovery.", limitations: [], citations: input.citations }) };
    await expect(answerOperatorQuestion(input, provider)).resolves.toMatchObject({ provider: "GROQ", answer: { answer: "The payment is eligible for recovery." } });
  });

  it("falls back when a provider cites evidence it was not given", async () => {
    const provider: OperatorAssistantProvider = { answer: async () => ({ answer: "Unsupported claim", limitations: [], citations: [{ type: "AUDIT", id: "not-supplied", claim: "Invented" }] }) };
    await expect(answerOperatorQuestion(input, provider)).resolves.toMatchObject({ provider: "DETERMINISTIC_FALLBACK" });
  });

  it("reserves completion tokens for a JSON answer on GPT-OSS reasoning models", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ answer: "The journey is retry eligible.", limitations: [], citations: input.citations }) } }],
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(new GroqOperatorAssistantProvider("test-key", "openai/gpt-oss-20b").answer(input)).resolves.toMatchObject({ answer: "The journey is retry eligible." });

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject({
      max_completion_tokens: 1_200,
      reasoning_effort: "low",
      reasoning_format: "hidden",
      response_format: { type: "json_object" },
    });
  });
});
