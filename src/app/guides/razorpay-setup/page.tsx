import type { Metadata } from "next";
import { SlushNavbar } from "@/components/slush-navbar";

export const metadata: Metadata = {
  title: "Razorpay setup guide | RecoveryOS",
  description: "Connect Razorpay and configure RecoveryOS operator access.",
};

export default function RazorpaySetupGuide() {
  return <main className="guide-page">
    <SlushNavbar />
    <section className="guide-hero"><p>RecoveryOS documentation</p><h1>RAZORPAY.<br />SET UP.</h1><span>Connect one merchant safely, then give your operator a protected workspace.</span></section>
    <section className="guide-content">
      <article className="guide-section"><p className="guide-eyebrow">Single-merchant setup</p><h2>Connect Razorpay</h2><ol className="guide-steps"><li>Deploy RecoveryOS to a public HTTPS URL.</li><li>Add <code>https://your-domain.com/api/webhooks/razorpay</code> in the Razorpay Dashboard.</li><li>Subscribe to <code>payment.authorized</code>, <code>payment.captured</code>, and <code>payment.failed</code>.</li><li>Use a separate Razorpay webhook secret.</li><li>Configure <code>APP_BASE_URL</code>, <code>DEMO_ADMIN_PASSWORD</code>, <code>SESSION_SECRET</code>, <code>RAZORPAY_KEY_ID</code>, <code>RAZORPAY_KEY_SECRET</code>, and <code>RAZORPAY_WEBHOOK_SECRET</code> on the server.</li></ol></article>
      <article className="guide-section"><p className="guide-eyebrow">Webhook handling</p><h2>What RecoveryOS checks</h2><p>RecoveryOS validates the Razorpay HMAC signature using the raw request body and deduplicates webhook events before processing them.</p><p>Never expose API keys or webhook secrets in frontend code, screenshots, or public documentation.</p></article>
      <article className="guide-scope"><p className="guide-eyebrow">First-release scope</p><h2>One merchant per deployment</h2><p>RecoveryOS currently supports one Razorpay merchant per deployment. This is an intentional first-release scope decision caused by current time and implementation constraints. It is not a limitation, incompatibility, or discrepancy in Razorpay or the RecoveryOS platform.</p><strong>Multi-tenancy is not a platform limitation. The architecture can expand later to support multiple merchants, workspaces, and webhook connections.</strong></article>
      <article className="guide-section guide-two-column"><div><p className="guide-eyebrow">Operator access</p><h2>Login behavior</h2><p>The current version uses one operator password, an eight-hour session cookie, and server-side protection for post-login pages.</p></div><div><p className="guide-eyebrow">For multiple businesses</p><h2>Future expansion</h2><p>A multi-business version should use individual accounts, workspaces, encrypted credentials, unique webhook endpoints, and Razorpay OAuth.</p></div></article>
      <article className="guide-section guide-resources"><p className="guide-eyebrow">Official resources</p><h2>Razorpay documentation</h2><a href="https://razorpay.com/docs/webhooks/" target="_blank" rel="noreferrer">Set up webhooks ↗</a><a href="https://razorpay.com/docs/webhooks/validate-test/" target="_blank" rel="noreferrer">Validate signatures ↗</a></article>
    </section>
  </main>;
}
