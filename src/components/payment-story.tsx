"use client";

import { useState } from "react";
import { Icon } from "./ui-primitives";

const stages = [
  { label: "Detect", title: "An exception, understood.", status: "Payment failed", tone: "exception", event: "Signed provider event received", detail: "The original payment is kept in view. A failure opens an investigation, without initiating another payment.", code: "PAYMENT_FAILED", next: "Provider verification" },
  { label: "Verify", title: "The facts, before the action.", status: "Capture checked", tone: "verified", event: "Provider verification complete", detail: "Late captures, duplicate paths, and the grace window are checked before recovery is considered.", code: "PAYMENT_STATUS_VERIFIED", next: "Safety evaluation" },
  { label: "Recover", title: "A next step, with a record.", status: "Recovery eligible", tone: "eligible", event: "Deterministic safety checks passed", detail: "An eligible payment can move to a controlled recovery path. Its outcome remains connected to the original evidence.", code: "RETRY_ELIGIBLE", next: "Controlled recovery" },
];

export function FlowLines({ className = "" }: { className?: string }) {
  return <svg className={`flow-lines ${className}`} viewBox="0 0 800 600" fill="none" aria-hidden="true">{Array.from({ length: 18 }, (_, i) => <path key={i} d={`M${-100 + i * 15} 610V${280 - i * 8}Q${-100 + i * 15} ${180 - i * 8} ${i * 15} ${180 - i * 8}H${430 + i * 8}Q${560 + i * 8} ${180 - i * 8} ${560 + i * 8} ${50 - i * 8}V-100`} stroke="currentColor" strokeWidth="1" />)}</svg>;
}

export function PaymentStory() {
  const [selected, setSelected] = useState(1);
  const stage = stages[selected];

  return <div className="payment-story">
    <FlowLines />
    <div className="story-copy"><p className="micro-label">THE RECOVERY JOURNEY</p><h2>One payment.<br />A clear way<br />forward.</h2><p>Follow the evidence from the first exception to the next permitted action.</p><div className="story-controls" role="tablist" aria-label="Explore the recovery journey">{stages.map((item, i) => <button key={item.label} id={`story-tab-${i}`} type="button" role="tab" aria-selected={selected === i} aria-controls="story-panel" tabIndex={selected === i ? 0 : -1} onClick={() => setSelected(i)} onKeyDown={event => { if (event.key === "ArrowRight" || event.key === "ArrowLeft" || event.key === "Home" || event.key === "End") { event.preventDefault(); const next = event.key === "Home" ? 0 : event.key === "End" ? 2 : (selected + (event.key === "ArrowRight" ? 1 : 2)) % 3; setSelected(next); document.getElementById(`story-tab-${next}`)?.focus(); } }}><span>0{i + 1}</span>{item.label}<span className="story-tab-arrow">↗</span></button>)}</div></div>
    <div className="story-document" role="tabpanel" id="story-panel" aria-labelledby={`story-tab-${selected}`}>
      <header><span><Icon name="payments" /> Payment journey</span><small>ILLUSTRATIVE EXAMPLE</small></header>
      <div className="story-amount"><span>Original payment</span><strong>₹2,400<span>.00</span></strong><span className={`story-status story-${stage.tone}`}><i />{stage.status}</span></div>
      <dl className="story-reference"><div><dt>Provider</dt><dd>Razorpay · Test Mode</dd></div><div><dt>Reference</dt><dd>order_example_024</dd></div></dl>
      <div className="story-event" aria-live="polite"><span className="story-event-index">0{selected + 1}</span><div><p>{stage.event}</p><h3>{stage.title}</h3><p>{stage.detail}</p></div></div>
      <footer><span><Icon name="evidence" /> {stage.code}</span><span>Next: {stage.next} ↗</span></footer>
    </div>
  </div>;
}
