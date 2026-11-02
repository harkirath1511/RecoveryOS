import Link from "next/link";
import { BrandLogo } from "./brand-logo";
import { SiteNavbar } from "./site-navbar";
import { PaymentStory } from "./payment-story";

const principles = [
  { number: "01", title: "Know what actually happened.", description: "Keep signed provider events and the original payment in one journey. Check for late captures before assuming a payment is still unpaid.", tag: "Provider-first verification" },
  { number: "02", title: "Make the right next move.", description: "Evaluate eligibility, duplicates, and exact amounts before a recovery path is created. Keep uncertain cases with an operator.", tag: "Deterministic safety checks" },
  { number: "03", title: "Keep the whole story connected.", description: "Follow every decision, workflow, and verified outcome back to its evidence. Give the next person the context they need.", tag: "Connected audit evidence" },
];

export function LandingPage() {
  return <main className="landing-page">
    <a className="skip-link" href="#platform">Skip to content</a>
    <SiteNavbar />
    <section className="editorial-hero" id="platform">
      <div className="hero-overline"><span className="micro-label">PAYMENT RECOVERY, WITH PERSPECTIVE.</span><span className="hero-edition">Built for the people behind payments ↙</span></div>
      <div className="hero-editorial-grid"><h1>A failed payment.<br /><span>A better next move.</span></h1><div className="hero-description"><p>Turn payment exceptions into informed decisions. Investigate the failure, verify the facts, and bring recovery into focus.</p><Link href="/login" className="button-ink">Open workspace <span>↗</span></Link><a href="#how-it-works" className="quiet-link">A closer look <span>↓</span></a></div></div>
      <PaymentStory />
      <div className="hero-foundations"><span>Built on evidence.</span><p>Signed events <i>/</i> Safety-enforced actions <i>/</i> Verified outcomes</p><Link href="/guides/razorpay-setup">Connect Razorpay ↗</Link></div>
    </section>
    <section className="principles-section" id="how-it-works"><div className="principles-heading"><p className="micro-label">A MORE COMPLETE PICTURE</p><h2>First, understand.<br />Then, act.</h2><p>Good recovery starts with context.<br />Keep yours in one place.</p></div><div className="principles-list">{principles.map(item => <article key={item.number}><span className="principle-number">{item.number}</span><div><span className="micro-label">{item.tag}</span><h3>{item.title}</h3><p>{item.description}</p></div><span className="principle-arrow" aria-hidden="true">↗</span></article>)}</div></section>
    <section className="record-section" id="evidence"><div className="record-section-copy"><p className="micro-label">EVERY ACTION LEAVES A RECORD</p><h2>The details<br />make the<br /><span>difference.</span></h2><p>From the original exception to a confirmed result, your team can see what happened, why it happened, and what comes next.</p><Link href="/login" className="quiet-link">Explore your workspace <span>↗</span></Link></div><div className="record-paper"><header><span className="micro-label">A CONNECTED EVIDENCE TRAIL</span><small>Example record / 024</small></header><div className="record-paper-row"><time>09:41:02</time><div><span>PROVIDER EVENT</span><h3>The exception is recorded.</h3><p>Signed payment evidence opens a journey.</p></div><b>01</b></div><div className="record-paper-row"><time>09:44:02</time><div><span>VERIFICATION</span><h3>The payment is checked.</h3><p>Provider truth establishes the capture state.</p></div><b>02</b></div><div className="record-paper-row"><time>09:44:03</time><div><span>SAFETY POLICY</span><h3>The next action is evaluated.</h3><p>Eligibility is determined before intervention.</p></div><b>03</b></div><footer><span className="record-square" /><p>Evidence stays connected.<br /><strong>So does your team.</strong></p><BrandLogo /></footer></div></section>
    <section className="editorial-close"><p className="micro-label">CLARITY FOR YOUR NEXT MOVE.</p><div><h2>Get back to<br />moving forward.</h2><Link href="/login" className="closing-arrow" aria-label="Open your RecoveryOS workspace">↗</Link></div><p>Your payments. Your evidence. One workspace.</p></section>
    <footer className="site-footer"><div className="footer-main"><Link className="site-brand" href="/"><BrandLogo /><span>recovery<span className="brand-os">os</span></span></Link><span>Every payment has a story.</span><nav aria-label="Footer navigation"><Link href="/guides/razorpay-setup">Documentation ↗</Link><Link href="/login">Sign in ↗</Link></nav></div><div className="footer-bottom"><span>© {new Date().getFullYear()} RecoveryOS</span><span>Payment recovery. Clearly considered.</span></div></footer>
  </main>;
}
