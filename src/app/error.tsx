"use client";
export default function Error({ reset }: { reset: () => void }) { return <main className="shell"><p className="eyebrow">RecoveryOS</p><h1>This screen is temporarily unavailable.</h1><p className="lede">No payment action has been taken. Retry to reload the stored evidence.</p><button className="recovery-button" onClick={reset}>Retry</button></main>; }
