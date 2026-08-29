"use client";
import { useEffect,useState } from "react";
type Entry={entityType:string;eventType:string;createdAt:string};
export function AuditTimeline(){const [entries,setEntries]=useState<Entry[]>([]);useEffect(()=>{fetch("/api/audit").then(r=>r.json()).then(x=>setEntries(x.entries??[])).catch(()=>undefined)},[]);return <section className="panel live-panel"><div className="panel-heading"><div><p className="card-label">Audit timeline</p><h2>Decision evidence</h2></div><span className="safe-pill">Immutable</span></div><div className="journey-list">{entries.map((e,i)=><div className="journey-row" key={i}><span>{e.entityType} · {e.eventType}</span><strong>{new Date(e.createdAt).toLocaleTimeString()}</strong></div>)}</div></section>}
