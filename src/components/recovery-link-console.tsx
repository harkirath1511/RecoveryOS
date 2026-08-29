"use client";
import { useEffect, useState } from "react";

type Journey = { id: string; orderId: string | null; state: string; outstandingAmount: number };
type Checkout = { key: string; orderId: string; amount: number; currency: string; methods?: string[] };
declare global { interface Window { Razorpay?: new (options: Record<string, unknown>) => { open: () => void } } }

export function RecoveryLinkConsole() {
  const [status, setStatus] = useState<string>("");
  const [journey, setJourney] = useState<Journey | null>(null);
  useEffect(() => { fetch("/api/journeys").then(r => r.json()).then(data => setJourney((data.journeys ?? []).find((item: Journey) => item.state === "RETRY_ELIGIBLE") ?? null)).catch(() => setStatus("Unable to load eligible recovery journeys.")); }, []);
  async function createLink() {
    if (!journey) { setStatus("No retry-eligible journey exists. RecoveryOS will only create a link after verification has elapsed."); return; }
    setStatus("Creating a safety-checked Test Mode link…");
    const response = await fetch("/api/recovery-links", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ journeyId: journey.id, customer: { name: "RecoveryOS Test", contact: "+919876543210" }, referenceId: `recovery-${journey.id.slice(0, 8)}-${Date.now()}` }) });
    const result = await response.json();
    if (result.checkout) { await openCheckout(result.checkout as Checkout, setStatus); return; }
    setStatus(result.created ? result.recoveryUrl : result.error ?? result.safety?.reason ?? "Recovery link was blocked.");
  }
  return <section className="panel live-panel"><div className="panel-heading"><div><p className="card-label">Controlled execution</p><h2>Create Test Mode recovery link</h2></div><span className="safe-pill">Safety-gated</span></div><p className="panel-footnote">{journey ? `Eligible journey: ${journey.orderId ?? journey.id} · ₹${(journey.outstandingAmount / 100).toFixed(2)}` : "No eligible journey yet. Captured, authorized, or unverified failures are never bypassed."}</p><button className="recovery-button" onClick={createLink} disabled={!journey}>Create approved recovery link</button>{status && <p className="panel-footnote">{status.startsWith("http") ? <a href={status} target="_blank" rel="noreferrer">Open approved recovery link</a> : status}</p>}</section>;
}

async function openCheckout(checkout: Checkout, setStatus: (value: string) => void) {
  if (!window.Razorpay) await new Promise<void>((resolve, reject) => { const script = document.createElement("script"); script.src = "https://checkout.razorpay.com/v1/checkout.js"; script.onload = () => resolve(); script.onerror = () => reject(new Error("Unable to load Razorpay Checkout.")); document.head.append(script); });
  if (!window.Razorpay) { setStatus("Razorpay Checkout did not load."); return; }
  new window.Razorpay({ key: checkout.key, order_id: checkout.orderId, amount: checkout.amount, currency: checkout.currency, config: checkout.methods ? { display: { preferences: { show_default_blocks: true }, blocks: { methods: { name: "Alternate methods", instruments: checkout.methods.map(method => ({ method })) } }, sequence: ["block.methods"] } } : undefined, handler: async (payment: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => { const response = await fetch("/api/checkout/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payment) }); const result = await response.json(); setStatus(result.verified ? "Checkout payment verified." : result.error ?? "Checkout verification failed."); } }).open();
}
