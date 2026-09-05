"use client";

import { useState } from "react";
import { LoadingState } from "./loading-state";
import { Icon, StatusBadge } from "./ui-primitives";

type Metric = { policy: string; directRecoveredAmount: number; incrementalRecoveredAmount: number; netRecoveredAmount: number; recoveryRate: number; attemptsPerRecovery: number; unsafeActions: number; duplicatePreventions: number; medianTimeToRecoveryMinutes: number | null; calibrationBrierScore: number | null };
type Result = { trainingSeed: number; evaluationSeed: number; volume: number; reproducibilityKey: string; protocol: { heldOutJourneys: number }; metrics: Metric[] };
type Scenario = { scenarioRun: { id: string; configurationHash: string; virtualStartedAt: string; virtualEndedAt: string; result: { eventCount: number; duplicateEvents: number; outOfOrderDeliveries: number; delayedAuthorizations: number } }; results: Array<{ id: string; status: number; accepted: boolean }> };
const rupees = (paise: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(paise / 100);
const policyLabel = (value: string) => value.replaceAll("_", " ");

export function RecoveryLab() {
  const [trainingSeed, setTrainingSeed] = useState("101");
  const [evaluationSeed, setEvaluationSeed] = useState("202");
  const [volume, setVolume] = useState("500");
  const [result, setResult] = useState<Result>();
  const [benchmarkStatus, setBenchmarkStatus] = useState("");
  const [benchmarkRunning, setBenchmarkRunning] = useState(false);
  const [scenarioSeed, setScenarioSeed] = useState("42");
  const [delay, setDelay] = useState("0");
  const [duplicates, setDuplicates] = useState("0");
  const [outOfOrder, setOutOfOrder] = useState("0");
  const [scenario, setScenario] = useState<Scenario>();
  const [scenarioStatus, setScenarioStatus] = useState("");
  const [scenarioRunning, setScenarioRunning] = useState(false);
  const [replayStep, setReplayStep] = useState(0);

  async function runBenchmark() {
    setBenchmarkRunning(true); setBenchmarkStatus("Running isolated held-out benchmark…");
    try {
      const response = await fetch("/api/benchmark", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ trainingSeed: Number(trainingSeed), evaluationSeed: Number(evaluationSeed), volume: Number(volume) }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { setBenchmarkStatus(data.error ?? "Benchmark failed."); return; }
      setResult(data); setBenchmarkStatus("");
    } catch { setBenchmarkStatus("Benchmark request could not be completed. Please retry."); }
    finally { setBenchmarkRunning(false); }
  }

  async function runScenario() {
    const input = { seed: Number(scenarioSeed), baselineAttempts: 25, currentAttempts: 25, delayedAuthorizationMs: Number(delay), duplicateEventRate: Number(duplicates), outOfOrderEventRate: Number(outOfOrder) };
    if (!Number.isInteger(input.seed) || !Number.isInteger(input.delayedAuthorizationMs) || [input.duplicateEventRate, input.outOfOrderEventRate].some(value => !Number.isFinite(value) || value < 0 || value > 1)) { setScenarioStatus("Enter an integer seed and delay, with rates from 0 to 1."); return; }
    setScenarioRunning(true); setScenarioStatus("Replaying 50 synthetic payments through the virtual ingestion path…");
    try {
      const response = await fetch("/api/scenarios", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { setScenarioStatus(data.error ?? `Scenario request failed (${response.status}).`); return; }
      setScenario(data); setReplayStep(0); setScenarioStatus("");
    } catch { setScenarioStatus("Scenario request could not be completed. Please retry."); }
    finally { setScenarioRunning(false); }
  }

  const recoveryOs = result?.metrics.find(metric => metric.policy === "RECOVERYOS");
  return <div className="lab-workspace">
    <div className="lab-banner"><span><Icon name="flask" /></span><div><StatusBadge tone="synthetic">Synthetic evidence only</StatusBadge><h2>Safe experimentation, isolated from merchant outcomes.</h2><p>Every run is seeded and reproducible. Amounts below are simulated benchmark values and never represent recovered merchant revenue.</p></div></div>

    <section className="panel lab-panel"><div className="panel-heading"><div><p className="card-label">Scenario simulator</p><h2>Replay controlled payment conditions</h2><p className="panel-footnote">Signed synthetic events follow the same ingestion path while virtual time keeps the experiment deterministic.</p></div><StatusBadge tone="synthetic">50 synthetic payments</StatusBadge></div>
      <div className="lab-form-grid"><label>Seed<span>Deterministic run key</span><input disabled={scenarioRunning} value={scenarioSeed} onChange={event => setScenarioSeed(event.target.value)} inputMode="numeric" /></label><label>Authorization delay<span>Milliseconds</span><input disabled={scenarioRunning} value={delay} onChange={event => setDelay(event.target.value)} inputMode="numeric" /></label><label>Duplicate rate<span>0 to 1</span><input disabled={scenarioRunning} value={duplicates} onChange={event => setDuplicates(event.target.value)} inputMode="decimal" /></label><label>Out-of-order rate<span>0 to 1</span><input disabled={scenarioRunning} value={outOfOrder} onChange={event => setOutOfOrder(event.target.value)} inputMode="decimal" /></label></div>
      <button className="recovery-button lab-action" disabled={scenarioRunning} onClick={runScenario}>{scenarioRunning ? "Running synthetic scenario…" : <>Run scenario <Icon name="arrow" /></>}</button>
      {scenarioRunning && <LoadingState label="Processing virtual event deliveries…" />}{scenarioStatus && <p className="state">{scenarioStatus}</p>}
      {scenario && <div className="lab-results"><div className="lab-result-head"><div><p className="card-label">Latest run</p><strong>{scenario.scenarioRun.id}</strong><small>Configuration {scenario.scenarioRun.configurationHash.slice(0, 12)}</small></div><StatusBadge tone="synthetic">{scenario.results.filter(item => item.accepted).length}/{scenario.results.length} accepted</StatusBadge></div><div className="summary-grid compact"><ResultMetric label="Events" value={scenario.scenarioRun.result.eventCount} /><ResultMetric label="Duplicates" value={scenario.scenarioRun.result.duplicateEvents} /><ResultMetric label="Out of order" value={scenario.scenarioRun.result.outOfOrderDeliveries} /><ResultMetric label="Delayed auth" value={scenario.scenarioRun.result.delayedAuthorizations} /></div><ScenarioReplay step={replayStep} onStep={setReplayStep} result={scenario.scenarioRun.result} /><p className="panel-footnote">Virtual range {new Date(scenario.scenarioRun.virtualStartedAt).toLocaleString()} → {new Date(scenario.scenarioRun.virtualEndedAt).toLocaleString()}</p></div>}
    </section>

    <section className="panel lab-panel"><div className="panel-heading"><div><p className="card-label">Policy benchmark</p><h2>Compare recovery strategies</h2><p className="panel-footnote">Each policy runs against the same unseen synthetic journeys and the same deterministic safety engine.</p></div><StatusBadge tone="synthetic">Held-out evaluation</StatusBadge></div>
      <div className="lab-form-grid benchmark-grid"><label>Training seed<span>Policy learning set</span><input disabled={benchmarkRunning} value={trainingSeed} onChange={event => setTrainingSeed(event.target.value)} inputMode="numeric" /></label><label>Evaluation seed<span>Unseen comparison set</span><input disabled={benchmarkRunning} value={evaluationSeed} onChange={event => setEvaluationSeed(event.target.value)} inputMode="numeric" /></label><label>Held-out journeys<span>Minimum 500</span><input disabled={benchmarkRunning} value={volume} onChange={event => setVolume(event.target.value)} inputMode="numeric" min="500" /></label></div>
      <button className="recovery-button lab-action" disabled={benchmarkRunning} onClick={runBenchmark}>{benchmarkRunning ? "Running benchmark…" : <>Run benchmark <Icon name="arrow" /></>}</button>
      {benchmarkRunning && <LoadingState label="Evaluating safety-gated policies…" />}{benchmarkStatus && <p className="state">{benchmarkStatus}</p>}
      {result && <div className="lab-results"><div className="lab-result-head"><div><p className="card-label">Comparison</p><strong>{result.protocol.heldOutJourneys} held-out journeys</strong><small>Reproducibility key · {result.reproducibilityKey}</small></div><StatusBadge tone="synthetic">Incremental {rupees(recoveryOs?.incrementalRecoveredAmount ?? 0)}</StatusBadge></div><div className="table-wrap"><table className="benchmark-table"><thead><tr><th>Policy</th><th>Simulated net</th><th>Recovery rate</th><th>Attempts / recovery</th><th>Median time</th><th>Unsafe actions</th><th>Duplicate prevention</th><th>Calibration</th></tr></thead><tbody>{result.metrics.map(metric => <tr key={metric.policy} className={metric.policy === "RECOVERYOS" ? "benchmark-highlight" : ""}><td>{policyLabel(metric.policy)}{metric.policy === "RECOVERYOS" && <small>RecoveryOS policy</small>}</td><td>{rupees(metric.netRecoveredAmount)}</td><td>{(metric.recoveryRate * 100).toFixed(1)}%</td><td>{metric.attemptsPerRecovery.toFixed(2)}</td><td>{metric.medianTimeToRecoveryMinutes ?? "—"}m</td><td><StatusBadge tone={metric.unsafeActions ? "danger" : "success"}>{metric.unsafeActions}</StatusBadge></td><td>{metric.duplicatePreventions}</td><td>{metric.calibrationBrierScore?.toFixed(3) ?? "—"}</td></tr>)}</tbody></table></div></div>}
    </section>
  </div>;
}

function ResultMetric({ label, value }: { label: string; value: number }) { return <article className="metric-card"><p>{label}</p><strong>{value}</strong><small>Synthetic count</small></article>; }

function ScenarioReplay({ step, onStep, result }: { step: number; onStep: (step: number) => void; result: Scenario["scenarioRun"]["result"] }) {
  const stages = [
    ["Generated", `${result.eventCount} synthetic events were generated from this seed.`],
    ["Delivered", `${result.duplicateEvents} duplicate deliveries were recorded during virtual ingestion.`],
    ["Ordered", `${result.outOfOrderDeliveries} deliveries arrived out of order and were reconciled.`],
    ["Authorized", `${result.delayedAuthorizations} authorizations were delayed in virtual time.`],
    ["Recorded", "The replay result is isolated from merchant payment and recovery records."],
  ] as const;
  const [title, text] = stages[step] ?? stages[0];
  return <section className="scenario-replay" aria-labelledby="scenario-replay-title"><div><p className="card-label">Scenario replay</p><h3 id="scenario-replay-title">{title}</h3><p>{text}</p></div><label><span className="sr-only">Replay stage</span><input type="range" min="0" max="4" step="1" value={step} onChange={event => onStep(Number(event.target.value))} aria-valuetext={`${title}: ${text}`} /><span className="replay-labels" aria-hidden="true">{stages.map(([name], index) => <i key={name} className={index === step ? "active" : ""}>{name}</i>)}</span></label></section>;
}
