"use client";

import { useEffect, useState } from "react";
type Case = { id: string; orderId: string | null; outstandingAmount: number; workflows: Array<{ action: string; status: string; terminalReason: string | null }> };

export function ManualReviewQueue() {
  const [queue, setQueue] = useState<Case[]>([]);
  useEffect(() => { fetch("/api/manual-review").then(response => response.json()).then(data => setQueue(data.queue ?? [])).catch(() => undefined); }, []);
  return <section className="panel live-panel"><div className="panel-heading"><div><p className="card-label">Manual review</p><h2>Operator-required cases</h2></div><span className="status-pill">No auto-approval</span></div>{queue.length ? <div className="journey-list">{queue.map(item => <div className="journey-row" key={item.id}><span>{item.orderId ?? item.id} · ₹{(item.outstandingAmount / 100).toFixed(2)}</span><strong>{item.workflows[0]?.terminalReason ?? "Review required"}</strong></div>)}</div> : <p className="panel-footnote">No journeys require manual review. RecoveryOS never auto-approves conflicts or hard declines.</p>}</section>;
}
