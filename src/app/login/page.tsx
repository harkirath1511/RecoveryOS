"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
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
    <main className="login-page"><header className="login-topbar"><Link className="site-brand" href="/"><BrandLogo /><span>recovery<span className="brand-os">os</span></span></Link><Link className="login-back" href="/">Back to website <Icon name="arrow" /></Link></header><div className="shell login-shell">
      <section className="login-intro" aria-labelledby="login-title">
        <p className="micro-label">A CLEARER VIEW OF YOUR PAYMENTS</p>
        <h1 id="login-title">Your next move,<br /><span>in focus.</span></h1>
        <p className="lede">Investigate payment journeys, manage recovery, and keep every decision connected to its evidence.</p>
        <div className="login-assurances" aria-label="Workspace assurances">
          <StatusBadge tone="warning">Test Mode</StatusBadge>
          <span><Icon name="shield" width={14} height={14} /> Safety-enforced actions</span>
          <span><Icon name="evidence" width={14} height={14} /> Auditable decisions</span>
        </div>
      </section>
      <form onSubmit={submit} aria-describedby={error ? "login-error" : undefined}>
        <div>
          <span className="login-form-index">01 / OPERATOR ACCESS</span>

          <h2>Good to have you back.</h2>
          <p className="panel-footnote">Enter your password to open your workspace.</p>
        </div>
        <label htmlFor="operator-password">Operator password</label>
        <input id="operator-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter password" required />
        <p className="login-demo-password"><strong>Demo password:</strong> admin@123</p>
        <button className="recovery-button" type="submit" disabled={submitting}>{submitting ? "Verifying…" : "Enter workspace"}<Icon name="arrow" /></button>
        {error && <p className="form-error" id="login-error" role="alert"><Icon name="warning" width={15} height={15} /> {error}</p>}
        <p className="panel-footnote">Access is session-scoped. No payment action occurs on sign-in.</p>
      </form>
    </div><footer className="login-footer"><span>© {new Date().getFullYear()} RecoveryOS</span><Link href="/guides/razorpay-setup">Need help getting connected? <Icon name="arrow" /></Link></footer></main>
  );
}
