import Link from "next/link";
import { Icon } from "./ui-primitives";
import { SplineRecoveryBot } from "./spline-recovery-bot";

const steps = [
  ["01", "Detect the exception", "Signed provider events open a journey without taking a recovery action."],
  ["02", "Verify before intervening", "Late capture and duplicate checks decide whether value is still at risk."],
  ["03", "Recover with a record", "Every permitted action, outcome, and operator handoff remains traceable."],
];

export function LandingPage() {
  return <main className="landing-page">
    <div className="landing-ribbon"><span>YOUR PAYMENTS. BACK ON TRACK.</span><span>VERIFY. RECOVER. REPEAT.</span><span>YOUR PAYMENTS. BACK ON TRACK.</span></div>
    <nav className="landing-nav" aria-label="Main navigation"><Link className="landing-brand" href="/"><span><Icon name="loop" /></span>RecoveryOS</Link><div className="landing-links"><a href="#how-it-works">How it works</a><a href="#evidence">Evidence</a><Link href="/login" className="landing-login">Operator sign in <Icon name="arrow" /></Link></div></nav>
    <section className="landing-hero"><div className="landing-copy"><p className="landing-kicker"><span className="landing-dot">↻</span> PAYMENT RECOVERY, UNSTUCK</p><h1>PAYMENTS.<br />UNSTUCK.</h1><p className="landing-lede">Every payment exception gets a clear path from provider evidence to a verified outcome.</p><div className="landing-actions"><Link href="/login" className="landing-primary">OPEN YOUR WORKSPACE <Icon name="arrow" /></Link><a href="#how-it-works" className="landing-secondary">SEE THE FLOW <Icon name="chevron" /></a></div><p className="landing-note"><span />Provider-verified recovery. No hidden retries.</p></div><div className="landing-spline-stage" aria-label="Animated RecoveryOS assistant"><SplineRecoveryBot /><span className="landing-spline-credit">R4X Bot by Vlad Kolokolnikov · CC BY 4.0</span></div></section>
    <section className="landing-intro" id="how-it-works"><p>ONE SOURCE OF TRUTH FOR EVERY PAYMENT EXCEPTION.</p><h2>FIND IT.<br />VERIFY IT.<br /><span>RECOVER IT.</span></h2><div><p>RecoveryOS gives the people behind payment operations a clear record, a real decision path, and a confident next action.</p><Link href="/login">START RECOVERING <Icon name="arrow" /></Link></div></section>
    <section className="landing-steps">{steps.map(([number, title, description]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{description}</p><i aria-hidden="true">↗</i></article>)}</section>
    <section className="landing-proof"><div><strong>ONE RECORD</strong><span>Provider events, decisions, and outcomes stay connected.</span></div><div><strong>SAFETY FIRST</strong><span>Only eligible payments can enter a recovery path.</span></div><div><strong>FULL RECEIPT</strong><span>Every intervention remains inspectable after the fact.</span></div></section>
    <section className="landing-evidence" id="evidence"><div><p className="landing-kicker">EVERY ACTION. ON RECORD.</p><h2>RECOVERY THAT CAN EXPLAIN ITSELF.</h2><p>Trace a payment from its first exception through evidence, policy, workflow, and a verified result.</p><Link href="/login" className="landing-primary">EXPLORE RECOVERYOS <Icon name="arrow" /></Link></div><aside><p>PAYMENT STATUS / VERIFIED</p><strong>Provider found no capture</strong><small>Razorpay Test Mode · signed provider response</small><hr /><p>SAFETY EVALUATION / PASS</p><strong>Recovery eligible</strong><small>Exact amount, no duplicate path, grace window complete</small><hr /><p>OUTCOME / AWAITING</p><strong>Waiting for a confirmed result</strong><small>Workflow remains fully auditable</small></aside></section>
    <footer className="landing-footer"><Link className="landing-brand" href="/"><span><Icon name="loop" /></span>RecoveryOS</Link><span>PAYMENT RECOVERY, UNSTUCK.</span><Link href="/login">OPERATOR SIGN IN <Icon name="arrow" /></Link></footer>
  </main>;
}
