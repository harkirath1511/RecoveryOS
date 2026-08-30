"use client";
import { useEffect, useState } from "react";

type Entry = { entityType: string; eventType: string; createdAt: string };

export function AuditTimeline() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/audit")
      .then(async response => ({ ok: response.ok, body: await response.json() }))
      .then(({ ok, body }) => {
        setEntries(body.entries ?? []);
        setError(!ok || body.error ? body.error ?? "Audit evidence is temporarily unavailable. Retry shortly." : "");
      })
      .catch(() => setError("Audit evidence is temporarily unavailable. Retry shortly."));
  }, []);

  return <section className="panel live-panel"><div className="panel-heading"><div><p className="card-label">Audit timeline</p><h2>Decision evidence</h2></div><span className="safe-pill">Immutable</span></div>{error ? <p className="panel-footnote">{error}</p> : <div className="journey-list">{entries.map((entry, index) => <div className="journey-row" key={index}><span>{entry.entityType} · {entry.eventType}</span><strong>{new Date(entry.createdAt).toLocaleTimeString()}</strong></div>)}</div>}</section>;
}
