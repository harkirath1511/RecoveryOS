"use client";

import { useEffect, useState } from "react";

type Operations = { outcomeTotals: Record<string, number> };
const rupees = (paise: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(paise / 100);

export function OutcomeTotals() {
  const [totals, setTotals] = useState<Record<string, number>>({});
  useEffect(() => { fetch("/api/operations").then(response => response.json()).then((data: Operations) => setTotals(data.outcomeTotals ?? {})).catch(() => undefined); }, []);
  return <section className="audit-strip"><div><span>Directly recovered</span><strong>{rupees(totals.DIRECT_RECOVERY ?? 0)}</strong></div><div><span>Natural late captures</span><strong>{rupees(totals.NATURAL_LATE_CAPTURE ?? 0)}</strong></div><div><span>Unattributed captures</span><strong>{rupees(totals.UNATTRIBUTED_CAPTURE ?? 0)}</strong></div><p>Razorpay Test Mode outcomes only. Synthetic benchmark results are reported separately.</p></section>;
}
