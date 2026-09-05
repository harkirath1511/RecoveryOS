"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon, StatusBadge } from "@/components/ui-primitives";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (response.ok) {
        router.replace("/command-center");
        router.refresh();
        return;
      }
      setError("That operator password was not accepted.");
    } catch {
      setError("Operator access is temporarily unavailable. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="shell login-shell">
      <section className="login-intro" aria-labelledby="login-title">
        <div className="login-mark"><Icon name="activity" width={22} height={22} /></div>
        <p className="eyebrow">RecoveryOS / operator access</p>
        <h1 id="login-title">Revenue recovery, with guardrails.</h1>
        <p className="lede">Sign in to investigate payment journeys, operate recovery queues, and review append-only evidence.</p>
        <div className="login-assurances" aria-label="Workspace assurances">
          <StatusBadge tone="warning">Test Mode</StatusBadge>
          <span><Icon name="shield" width={14} height={14} /> Safety-enforced actions</span>
          <span><Icon name="evidence" width={14} height={14} /> Auditable decisions</span>
        </div>
      </section>
      <form onSubmit={submit} aria-describedby={error ? "login-error" : undefined}>
        <div>
          <p className="card-label">Secure workspace</p>
          <h2>Enter the command center</h2>
        </div>
        <label htmlFor="operator-password">Operator password</label>
        <input id="operator-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter password" required />
        <p className="login-demo-password"><strong>Demo password:</strong> admin@123</p>
        <button className="recovery-button" type="submit" disabled={submitting}>{submitting ? "Verifying…" : "Sign in securely"}</button>
        {error && <p className="form-error" id="login-error" role="alert"><Icon name="warning" width={15} height={15} /> {error}</p>}
        <p className="panel-footnote">Access is session-scoped. No payment action occurs on sign-in.</p>
      </form>
    </main>
  );
}
