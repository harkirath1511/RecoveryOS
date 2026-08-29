"use client";
import { useState } from "react";

export function RecoveryLinkConsole() {
  const [status, setStatus] = useState<string>("");
  async function createLink() {
    setStatus("Creating a safety-checked Test Mode link…");
    const response = await fetch("/api/recovery-links", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ journeyState: "RETRY_ELIGIBLE", outstandingAmount: 10_000, automatedRecoveryActions: 0, customer: { name: "RecoveryOS Test", contact: "+919876543210" }, referenceId: `dashboard-${Date.now()}` }) });
    const result = await response.json();
    setStatus(result.created ? result.url : result.error ?? result.safety?.reason ?? "Recovery link was blocked.");
  }
  return <section className="panel live-panel"><div className="panel-heading"><div><p className="card-label">Controlled execution</p><h2>Create Test Mode recovery link</h2></div><span className="safe-pill">Safety-gated</span></div><p className="panel-footnote">Creates one exact-amount Razorpay Test Mode link only after deterministic recovery rules allow it. No message is sent automatically.</p><button className="recovery-button" onClick={createLink}>Create ₹100 test recovery link</button>{status && <p className="panel-footnote">{status.startsWith("http") ? <a href={status} target="_blank" rel="noreferrer">Open approved recovery link</a> : status}</p>}</section>;
}
