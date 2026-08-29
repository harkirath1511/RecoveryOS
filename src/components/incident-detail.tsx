"use client";

import { useEffect, useState } from "react";
type Incident = { topSegment: { label: string; excessFailures: number; successRateDrop: number; zScore: number }; totalExcessFailures: number };
type Detail = { incident: Incident | null; revenueAtRisk?: number; source?: string };

export function IncidentDetail() {
  const [detail, setDetail] = useState<Detail>();
  useEffect(() => { fetch("/api/incidents").then(response => response.json()).then(setDetail).catch(() => undefined); }, []);
  if (!detail?.incident) return null;
  const incident = detail.incident;
  return <section className="panel live-panel"><div className="panel-heading"><div><p className="card-label">Incident evidence</p><h2>Ranked degradation evidence</h2></div><span className="status-pill">Synthetic</span></div><div className="journey-list"><div className="journey-row"><span>Root cohort</span><strong>{incident.topSegment.label}</strong></div><div className="journey-row"><span>Excess failures</span><strong>{incident.topSegment.excessFailures}</strong></div><div className="journey-row"><span>Confidence</span><strong>{incident.topSegment.zScore.toFixed(1)}σ</strong></div><div className="journey-row"><span>Revenue at risk</span><strong>₹{((detail.revenueAtRisk ?? 0) / 100).toFixed(0)}</strong></div></div><p className="panel-footnote">Computed from reproducible baseline-versus-current simulator windows; not a real merchant revenue claim.</p></section>;
}
