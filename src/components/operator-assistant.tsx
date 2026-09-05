"use client";

import { useState } from "react";
import { Icon } from "./ui-primitives";

type Result = {
  provider: "GROQ" | "DETERMINISTIC_FALLBACK";
  fallbackReason?: string;
  scope: string;
  evidenceCount: number;
  answer: { answer: string; limitations: string[]; citations: Array<{ type: string; id: string; claim: string }> };
};

export function OperatorAssistant({ initialJourney = "" }: { initialJourney?: string }) {
  const [question, setQuestion] = useState("Why are the latest recoverable payments still unpaid?");
  const [journey, setJourney] = useState(initialJourney);
  const [incidentId, setIncidentId] = useState("");
  const [result, setResult] = useState<Result>();
  const [error, setError] = useState("");
  const [asking, setAsking] = useState(false);

  async function ask() {
    setAsking(true); setError(""); setResult(undefined);
    try {
      const response = await fetch("/api/operator-assistant", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question, ...(journey.trim() ? { journey: journey.trim() } : {}), ...(incidentId.trim() ? { incidentId: incidentId.trim() } : {}) }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "The assistant could not read current evidence.");
      setResult(body);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The assistant could not read current evidence.");
    } finally { setAsking(false); }
  }

  return <>
    <section className="panel assistant-composer">
      <div className="panel-heading"><div><p className="card-label">Groq operator assistant</p><h2>Ask about payment evidence</h2></div><div className="assistant-presence"><span><Icon name="activity" /></span><small>Evidence ready</small></div><span className="safe-pill">Read-only</span></div>
      <p className="panel-footnote">The assistant receives only the bounded stored evidence shown by the selected scope. It cannot create recovery links, alter payment state, or override safety policy.</p>
      <label className="assistant-label">Question<textarea value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={1000} disabled={asking} placeholder="Ask why a payment failed, what action was chosen, or what the active incident means." /></label>
      <div className="assistant-scope"><label>Journey UUID or order ID (optional)<input value={journey} onChange={(event) => setJourney(event.target.value)} disabled={asking} placeholder="scenario:… or journey UUID" /></label><label>Incident UUID (optional)<input value={incidentId} onChange={(event) => setIncidentId(event.target.value)} disabled={asking} placeholder="Incident UUID" /></label></div>
      <div className="assistant-prompts"><button type="button" onClick={() => setQuestion("What is the current payment risk and what evidence supports it?")}>Explain current risk</button><button type="button" onClick={() => setQuestion("Why was this recovery action selected or blocked?")}>Explain a decision</button><button type="button" onClick={() => setQuestion("What should an operator inspect next?")}>Next investigation step</button></div>
      <button className="recovery-button" disabled={asking || question.trim().length < 3} onClick={ask}>{asking ? "Reading evidence with Groq…" : "Ask Groq"}</button>
      {error && <p className="state error-state">{error}</p>}
    </section>
    {result && <section className="panel assistant-answer"><div className="panel-heading"><div><p className="card-label">Answer</p><h2>{result.provider === "GROQ" ? "Groq evidence analysis" : "Deterministic evidence fallback"}</h2></div><span className="status-pill">{result.scope.replaceAll("_", " ")} · {result.evidenceCount} records</span></div><p className="assistant-response">{result.answer.answer}</p>{result.fallbackReason && <p className="panel-footnote">Fallback reason: {result.fallbackReason}</p>}{result.answer.limitations.length > 0 && <div className="assistant-limitations"><strong>Limits</strong>{result.answer.limitations.map((item) => <p key={item}>{item}</p>)}</div>}<div className="assistant-citations"><strong>Cited stored evidence</strong>{result.answer.citations.map((citation) => <p key={`${citation.type}:${citation.id}`}><code>{citation.type} {citation.id}</code> {citation.claim}</p>)}</div></section>}
  </>;
}
