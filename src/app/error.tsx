"use client";
import { Icon } from "@/components/ui-primitives";

export default function Error({ reset }: { reset: () => void }) {
  return <main className="shell standalone-state"><section className="state-card"><div className="state-icon"><Icon name="warning" width={20} height={20} /></div><p className="eyebrow">RecoveryOS / safe failure</p><h1>This screen is temporarily unavailable.</h1><p className="lede">No payment action has been taken. Retry to reload the stored evidence.</p><button className="recovery-button" onClick={reset}><Icon name="recovery" width={15} height={15} /> Retry safely</button></section></main>;
}
