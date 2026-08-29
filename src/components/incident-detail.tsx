"use client";

import { useEffect, useState } from "react";

type Detail = {
  incident: null | { overallBaseline: { successRate: number }; overallCurrent: { successRate: number }; topSegment: { label: string; excessFailures: number; successRateDrop: number; zScore: number } };
  revenueAtRisk: { amount: number; eligibleJourneyCount: number; confidence: number; calibration: string; assumptions: { formula: string; baselineRecoveryProbability: number; interventionCostPaise: number } };
  source: string;
  downtimeEvidence?: { corroborated: boolean; signals: unknown[] };
};

export function IncidentDetail() {
  const [detail, setDetail] = useState<Detail>();
  useEffect(() => { fetch("/api/incidents").then((response) => response.json()).then(setDetail).catch(() => undefined); }, []);
  if (!detail) return <section className="panel live-panel"><p className="panel-footnote">Loading rolling payment metrics…</p></section>;
  if (!detail.incident) return <section className="panel live-panel"><div className="panel-heading"><div><p className="card-label">Incident evidence</p><h2>No active degradation</h2></div><span className="safe-pill">Live metrics</span></div><p className="panel-footnote">No cohort passed the configured volume, absolute-drop, and z-score gates in the current rolling window.</p></section>;
  const incident = detail.incident;
  return <section className="panel live-panel"><div className="panel-heading"><div><p className="card-label">Incident evidence</p><h2>Ranked degradation evidence</h2></div><span className="status-pill">Live</span></div><div className="journey-list"><div className="journey-row"><span>Root cohort</span><strong>{incident.topSegment.label}</strong></div><div className="journey-row"><span>Baseline → current</span><strong>{(incident.overallBaseline.successRate * 100).toFixed(1)}% → {(incident.overallCurrent.successRate * 100).toFixed(1)}%</strong></div><div className="journey-row"><span>Excess failures</span><strong>{incident.topSegment.excessFailures}</strong></div><div className="journey-row"><span>Evidence confidence</span><strong>{incident.topSegment.zScore.toFixed(1)}σ{detail.downtimeEvidence?.corroborated ? " · downtime corroborated" : ""}</strong></div><div className="journey-row"><span>Revenue at risk</span><strong>₹{(detail.revenueAtRisk.amount / 100).toFixed(0)}</strong></div></div><p className="panel-footnote">{detail.revenueAtRisk.assumptions.formula}. {detail.revenueAtRisk.eligibleJourneyCount} eligible journeys; policy calibration: {detail.revenueAtRisk.calibration.toLowerCase()} ({(detail.revenueAtRisk.confidence * 100).toFixed(0)}% confidence). Baseline recovery {(detail.revenueAtRisk.assumptions.baselineRecoveryProbability * 100).toFixed(0)}%; intervention cost ₹{(detail.revenueAtRisk.assumptions.interventionCostPaise / 100).toFixed(0)}.</p></section>;
}
