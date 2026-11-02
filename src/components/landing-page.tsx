import Link from "next/link";
import { Icon, type IconName } from "./ui-primitives";
import { BrandLogo } from "./brand-logo";
import { SiteNavbar } from "./site-navbar";

const steps: Array<{ number: string; icon: IconName; title: string; text: string }> = [
  { number: "01", icon: "activity", title: "Detect the exception.", text: "Signed provider events bring payment failures into a single, connected journey." },
  { number: "02", icon: "shield", title: "Establish the truth.", text: "Verify late captures, check for duplicates, and evaluate safety before taking action." },
  { number: "03", icon: "recovery", title: "Recover with confidence.", text: "Move eligible payments forward with controlled workflows and a complete evidence trail." },
];

function WorkspacePreview() {
  return <div className="product-scene" aria-label="Illustrative recovery workspace preview">
    <div className="scene-orbit orbit-one" /><div className="scene-orbit orbit-two" />
    <div className="preview-card">
      <div className="preview-topline"><span><BrandLogo /> Recovery overview</span><span className="preview-example">Illustrative view</span></div>
      <div className="preview-value"><div><span>Verified recovery</span><strong>₹1,24,850<span>.00</span></strong></div><span className="preview-verified"><Icon name="shield" /> Provider verified</span></div>
      <div className="preview-chart" aria-hidden="true"><div className="chart-guides"><span>150k</span><span>100k</span><span>50k</span><span>0</span></div><svg viewBox="0 0 520 195" preserveAspectRatio="none"><defs><linearGradient id="revenue-fill" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#d4b67c" stopOpacity=".25" /><stop offset="1" stopColor="#d4b67c" stopOpacity="0" /></linearGradient></defs><path className="chart-grid" d="M0 15H520M0 70H520M0 125H520M0 180H520" /><path d="M0 165C35 165 42 148 70 150S110 155 140 125S177 135 210 105S250 115 285 82S320 92 350 63S390 74 420 42S465 53 500 18L520 18V195H0Z" fill="url(#revenue-fill)" /><path className="chart-line" d="M0 165C35 165 42 148 70 150S110 155 140 125S177 135 210 105S250 115 285 82S320 92 350 63S390 74 420 42S465 53 500 18" /><circle cx="500" cy="18" r="5" fill="#e6cb96" /><circle cx="500" cy="18" r="11" fill="none" stroke="#e6cb96" strokeOpacity=".2" /></svg><div className="chart-days"><span>MON</span><span>TUE</span><span>WED</span><span>THU</span><span>FRI</span><span>SAT</span><span>SUN</span></div></div>
      <div className="preview-payment"><span className="preview-payment-icon"><Icon name="payments" /></span><div><strong>Payment journey</strong><small>Exception → verification → recovery</small></div><span className="preview-status"><Icon name="check" /> Verified</span></div>
    </div>
    <div className="verification-note"><span><Icon name="shield" /></span><div><strong>Evidence before every action.</strong><small>Checked. Connected. Accounted for.</small></div><Icon name="check" /></div>
    <div className="scene-caption"><span /> A clearer path from exception to outcome.</div>
  </div>;
}

export function LandingPage() {
  return <main className="landing-page">
    <a className="skip-link" href="#platform">Skip to content</a>
    <SiteNavbar />
    <section className="marketing-hero" id="platform">
      <div className="hero-grid-lines" aria-hidden="true" />
      <div className="marketing-hero-inner">
        <div className="marketing-hero-copy"><p className="gold-eyebrow"><span /> INTELLIGENT PAYMENT RECOVERY</p><h1>Recover revenue.<br />Retain <em>confidence.</em></h1><p className="marketing-lede">A considered approach to payment exceptions. Turn provider evidence into clear decisions, controlled recovery, and verified outcomes.</p><div className="marketing-actions"><Link className="button-gold" href="/login">Enter your workspace <Icon name="arrow" /></Link><a className="button-text" href="#how-it-works">Explore the platform <Icon name="chevron" /></a></div><div className="hero-assurance"><Icon name="shield" /><span>Provider-verified. Safety-enforced. Always traceable.</span></div></div>
        <WorkspacePreview />
      </div>
      <div className="hero-bottom"><span>PRECISION AT EVERY STEP</span><div><span><Icon name="payments" /> Payment intelligence</span><span><Icon name="shield" /> Controlled recovery</span><span><Icon name="evidence" /> Connected evidence</span></div><a href="#how-it-works" aria-label="Discover how it works">↓</a></div>
    </section>
    <section className="process-section" id="how-it-works"><div className="marketing-container"><header className="marketing-section-heading"><div><p className="gold-eyebrow">FROM EXCEPTION TO RESOLUTION</p><h2>Complex payments.<br /><em>A clear path forward.</em></h2></div><p>Give your operations team the context to act decisively, with every payment and every decision in view.</p></header><div className="process-grid">{steps.map(step => <article key={step.number}><div className="process-card-top"><span className="process-icon"><Icon name={step.icon} /></span><span>{step.number}</span></div><h3>{step.title}</h3><p>{step.text}</p></article>)}</div><div className="process-bottom"><span>One journey. Complete visibility.</span><Link href="/guides/razorpay-setup">Read the integration guide <Icon name="arrow" /></Link></div></div></section>
    <section className="evidence-section" id="evidence"><div className="marketing-container evidence-layout"><div className="evidence-copy"><p className="gold-eyebrow">CONFIDENCE, BY DESIGN</p><h2>Every decision<br />has <em>a foundation.</em></h2><p>Recovery should be explainable. Follow the original exception through provider verification, safety policy, and a confirmed result.</p><div className="evidence-features"><div><Icon name="shield" /><span><strong>Safety comes first</strong><small>Eligibility checks before an intervention.</small></span></div><div><Icon name="evidence" /><span><strong>A record you can follow</strong><small>Connected evidence at every stage.</small></span></div><div><Icon name="activity" /><span><strong>Clarity for your team</strong><small>Investigation, handoffs, and outcomes in one place.</small></span></div></div><Link href="/login" className="button-text">Discover your command center <Icon name="arrow" /></Link></div><div className="evidence-window"><div className="evidence-window-header"><span><Icon name="evidence" /> The decision record</span><small>ILLUSTRATIVE WORKFLOW</small></div><div className="evidence-record"><span className="record-icon"><Icon name="check" /></span><div><p>01 / PROVIDER VERIFICATION</p><h3>Payment status confirmed</h3><span>Signed provider evidence establishes whether a capture occurred.</span></div><small>Verified</small></div><div className="evidence-record"><span className="record-icon"><Icon name="shield" /></span><div><p>02 / SAFETY EVALUATION</p><h3>Recovery eligibility checked</h3><span>Amount, duplicate paths, and the grace window are evaluated.</span></div><small>Checked</small></div><div className="evidence-record record-pending"><span className="record-icon"><Icon name="clock" /></span><div><p>03 / VERIFIED OUTCOME</p><h3>The result stays on record</h3><span>Outcomes remain linked to the evidence and action that preceded them.</span></div><small>Traceable</small></div><div className="evidence-window-footer"><Icon name="shield" /> Evidence guides the action. The record stays connected.</div></div></div></section>
    <section className="closing-section"><div className="marketing-container"><span className="closing-mark"><BrandLogo /></span><p className="gold-eyebrow">TAKE A MORE CONSIDERED APPROACH</p><h2>Your revenue.<br /><em>Back in focus.</em></h2><Link href="/login" className="button-gold">Open your workspace <Icon name="arrow" /></Link><p>Payment recovery, with the clarity it deserves.</p></div></section>
    <footer className="site-footer"><div className="marketing-container"><Link className="site-brand" href="/"><BrandLogo /><span>Recovery<span className="brand-os">OS</span></span></Link><span>Clarity. Control. Confidence.</span><nav aria-label="Footer navigation"><Link href="/guides/razorpay-setup">Documentation</Link><Link href="/login">Operator sign in <Icon name="arrow" /></Link></nav></div><div className="marketing-container footer-bottom"><span>© {new Date().getFullYear()} RecoveryOS</span><span>Built for considered payment operations.</span></div></footer>
  </main>;
}
