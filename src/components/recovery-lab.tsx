"use client";

import { useState } from "react";

type Result = { trainingSeed: number; evaluationSeed: number; volume: number; reproducibilityKey: string; metrics: Array<{ policy: string; directRecoveredAmount: number; recoveryRate: number; attemptsPerRecovery: number }> };
const rupees = (paise: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(paise / 100);

export function RecoveryLab() {
  const [trainingSeed, setTrainingSeed] = useState("101");
  const [evaluationSeed, setEvaluationSeed] = useState("202");
  const [volume, setVolume] = useState("300");
  const [result, setResult] = useState<Result>();
  const [status, setStatus] = useState("");
  async function runBenchmark() { setStatus("Running isolated held-out benchmark…"); const response=await fetch("/api/benchmark",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({trainingSeed:Number(trainingSeed),evaluationSeed:Number(evaluationSeed),volume:Number(volume)})}); const data=await response.json(); if(!response.ok){setStatus(data.error??"Benchmark failed.");return;} setResult(data);setStatus(""); }
  const baseline=result?.metrics.find(metric=>metric.policy==="STATIC_RETRY"); const recoveryOs=result?.metrics.find(metric=>metric.policy==="RECOVERYOS");
  return <section className="panel live-panel"><div className="panel-heading"><div><p className="card-label">Recovery Lab</p><h2>Reproducible policy benchmark</h2></div><span className="status-pill">Synthetic only</span></div><p className="panel-footnote">Uses identical unseen scenarios for static retry, rules-only, and RecoveryOS. This is simulator evidence, never claimed as merchant revenue.</p><div className="ops-grid"><label>Training seed<input value={trainingSeed} onChange={event=>setTrainingSeed(event.target.value)} inputMode="numeric" /></label><label>Held-out seed<input value={evaluationSeed} onChange={event=>setEvaluationSeed(event.target.value)} inputMode="numeric" /></label><label>Attempts/window<input value={volume} onChange={event=>setVolume(event.target.value)} inputMode="numeric" /></label></div><button className="recovery-button" onClick={runBenchmark}>Run held-out benchmark</button>{status&&<p className="panel-footnote">{status}</p>}{result&&<div className="journey-list">{result.metrics.map(metric=><div className="journey-row" key={metric.policy}><span>{metric.policy.replaceAll("_"," ")} · {rupees(metric.directRecoveredAmount)}</span><strong>{(metric.recoveryRate*100).toFixed(1)}%</strong></div>)}<p className="panel-footnote">Incremental RecoveryOS recovery versus static retry: {rupees((recoveryOs?.directRecoveredAmount??0)-(baseline?.directRecoveredAmount??0))}. Reproducibility key: {result.reproducibilityKey}</p></div>}</section>;
}
