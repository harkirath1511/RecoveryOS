"use client";
import { useEffect, useState } from "react";

type Journey = { id: string; orderId: string | null; state: string; outstandingAmount: number };

export function RecoveryLinkConsole() {
  const [status, setStatus] = useState<string>("");
  const [journey, setJourney] = useState<Journey | null>(null);
  useEffect(() => { fetch("/api/journeys").then(r => r.json()).then(data => setJourney((data.journeys ?? []).find((item: Journey) => item.state === "RETRY_ELIGIBLE") ?? null)).catch(() => setStatus("Unable to load eligible recovery journeys.")); }, []);
  async function createLink() {
    if (!journey) { setStatus("No retry-eligible journey exists. RecoveryOS will only create a link after verification has elapsed."); return; }
    setStatus("Creating a safety-checked Test Mode link…");
    const response = await fetch("/api/recovery-links", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ journeyId: journey.id, customer: { name: "RecoveryOS Test", contact: "+919876543210" }, referenceId: `recovery-${journey.id.slice(0, 8)}-${Date.now()}` }) });
    const result = await response.json();
    setStatus(result.created ? result.recoveryUrl : result.error ?? result.safety?.reason ?? "Recovery link was blocked.");
  }
  return <section className="panel live-panel"><div className="panel-heading"><div><p className="card-label">Controlled execution</p><h2>Create Test Mode recovery link</h2></div><span className="safe-pill">Safety-gated</span></div><p className="panel-footnote">{journey ? `Eligible journey: ${journey.orderId ?? journey.id} · ₹${(journey.outstandingAmount / 100).toFixed(2)}` : "No eligible journey yet. Captured, authorized, or unverified failures are never bypassed."}</p><button className="recovery-button" onClick={createLink} disabled={!journey}>Create approved recovery link</button>{status && <p className="panel-footnote">{status.startsWith("http") ? <a href={status} target="_blank" rel="noreferrer">Open approved recovery link</a> : status}</p>}</section>;
}
