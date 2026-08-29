# RecoveryOS Learning Guide

## How to use this guide

Do not try to study everything before building. Read each priority block immediately before the matching implementation milestone, then apply it in code.

The goal is to understand enough to build a safe, demonstrable payment-recovery system—not to become a payment processor, data scientist, or distributed-systems researcher in one week.

---

## P0 — Know this before touching payment code

### 1. Payment states are not browser states

**Learn:** A customer seeing a failed checkout page does not prove the payment is permanently failed. Server-side payment state is authoritative, and a late authorization/capture can arrive after an earlier failure.

**Why RecoveryOS needs it:** The most serious failure would be creating a second payment while the first one is still becoming captured.

**Read:**

- [Razorpay Webhooks overview](https://razorpay.com/docs/webhooks/)
- [Razorpay payment webhook events](https://razorpay.com/docs/webhooks/payments/?preferred-country=IN)
- [Razorpay webhook FAQs](https://razorpay.com/docs/webhooks/faqs/)

**You should be able to explain:**

```text
payment.failed
  → FAILED_PENDING_VERIFICATION
  → payment.authorized or payment.captured
  → stop recovery; do not offer a second payment
```

### 2. Webhooks are at-least-once, asynchronous delivery

**Learn:** Webhook requests can be retried, duplicated, delayed, and arrive out of order. They must be signature-verified using the raw request body, deduplicated using the provider event identifier, persisted, and acknowledged quickly.

**Why RecoveryOS needs it:** A webhook handler that blindly reacts to every request can create duplicate recovery workflows or corrupt payment state.

**Read:**

- [Razorpay webhook best practices](https://razorpay.com/docs/webhooks/best-practices/?preferred-country=IN)
- [Razorpay Node.js checkout integration](https://razorpay.com/docs/payments/server-integration/nodejs/integration-steps/?preferred-country=US)

**You should be able to implement:**

1. Read the raw body.
2. Verify the HMAC signature with the webhook secret.
3. Check whether the event id is already stored.
4. Store a new event and apply one valid state transition in one database transaction.
5. Return a 2XX response quickly; do heavy work asynchronously.

### 3. Test Mode is real integration, not fake production revenue

**Learn:** Razorpay Test Mode lets you exercise the payment flow without moving real money. It is appropriate for the end-to-end demo, but it does not prove actual merchant recovery uplift.

**Why RecoveryOS needs it:** The submission must separate simulator findings from verified Test Mode outcomes.

**Read:**

- [Razorpay Test and Live Modes](https://razorpay.com/docs/payments/dashboard/test-live-modes/?preferred-country=IN)
- [Razorpay Standard Checkout testing](https://razorpay.com/docs/developer-tools/integrations/standard-checkout/)

**Rule:** Never call Test Mode recovery results “real revenue recovered.” Label them `Razorpay Test Mode verified outcome`.

### 4. Payment Links are an execution mechanism, not routing magic

**Learn:** A Payment Link is a hosted collection URL. RecoveryOS can create, fetch, update, cancel, and observe a Payment Link, but it cannot silently force a customer onto a particular payment rail.

**Why RecoveryOS needs it:** This keeps the demo honest: `CREATE_PAYMENT_LINK` is a supported recovery action.

**Read:**

- [Razorpay Payment Links API](https://razorpay.com/docs/api/payments/payment-links/)
- [Payment Link webhook events](https://razorpay.com/docs/webhooks/payment-links/?preferred-country=US)

---

## P1 — Understand this while implementing the recovery loop

### 5. Idempotency and state machines

**Learn:** Idempotency means repeating the same request has the same effective result as handling it once. A state machine limits which transitions are legal.

**Why RecoveryOS needs it:** These are the core protection against duplicate webhooks, repeated QStash jobs, and older events reopening captured payments.

**Required invariants:**

- `CAPTURED` never reopens.
- A recovery action never exceeds the outstanding amount.
- A terminal journey cannot automatically start another recovery workflow.
- Duplicate provider events create audit evidence but do not cause a second transition.
- Delayed jobs re-check the current database state before acting.

**Practice exercise:** Write tests for `failure → late capture`, duplicate failure, capture followed by delayed failure, hard decline, and two concurrent recovery attempts.

### 6. Payment degradation and cohort metrics

**Learn:** A success-rate drop must be measured relative to a baseline and a sufficient sample size. A few failures are noise; a concentrated failure pattern can be an incident.

**Why RecoveryOS needs it:** The command center should say which segment is actually leaking revenue, not merely display a red chart.

**Core terms:**

- **Current window:** recent attempts, for example the last five virtual minutes.
- **Baseline window:** earlier normal behavior.
- **Cohort:** a meaningful segment such as `UPI + provider + timeout + Android`.
- **Absolute drop:** baseline success rate minus current success rate.
- **Excess failures:** current attempts × the positive success-rate drop.
- **Minimum sample size:** prevents an incident from one random failure.

**Read:**

- [Razorpay Payment Downtime API](https://razorpay.com/docs/api/payments/downtime/?preferred-country=IN)
- [Razorpay payment downtime webhook events](https://razorpay.com/docs/webhooks/payments/?preferred-country=IN)

**Rule:** Treat Razorpay downtime information as corroborating evidence, not a replacement for the merchant's own observed success-rate data.

### 7. Revenue at risk is expected value, not a dramatic total

**Learn:** Do not call the total failed amount “recoverable.” Estimate the incremental value of each permitted action compared with no action.

```text
incremental recoverability
  = max(0, P(best permitted action succeeds) - P(no action succeeds))

expected recoverable value
  = outstanding amount × incremental recoverability - intervention cost
```

**Why RecoveryOS needs it:** Judges should see that the product distinguishes potential loss, expected recovery, and money actually verified as captured.

---

## P2 — Contextual bandits for RecoveryOS

### 8. Multi-armed bandit versus contextual bandit

**Learn:** A regular bandit learns which action is best overall. A contextual bandit learns which action is best for the current situation.

For RecoveryOS:

```text
Context: bank, method, error, amount, downtime, time, attempt count
Actions: wait, retry checkout, alternate checkout, payment link, manual review
Reward: verified, attributable recovery outcome
```

The bandit does not decide whether an action is legal. The safety engine filters illegal actions first.

**Read:**

- [LinUCB original paper: A Contextual-Bandit Approach to Personalized News Article Recommendation](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/02/p661.pdf)

Read the problem setup and LinUCB algorithm first. You do not need to master every proof before implementation.

### 9. LinUCB in plain English

For every allowed action, LinUCB maintains a simple linear estimate of how likely it is to succeed for a context. It selects the action that balances:

```text
known expected reward + uncertainty bonus
```

The uncertainty bonus permits carefully constrained exploration of actions with little evidence.

**What you need to understand:**

- Feature vector `x`: numerical representation of the current payment context.
- One model per action.
- Matrix `A`: how much evidence exists for contexts seen by an action.
- Vector `b`: accumulated outcome evidence.
- Estimated parameters: `theta = inverse(A) × b`.
- Upper-confidence score: expected estimate plus `alpha` times uncertainty.
- `alpha`: exploration strength; higher values explore more.

**RecoveryOS-specific rule:** Do not include the exploration bonus when displaying expected recovered money. Display the predicted mean separately, otherwise uncertainty is mislabeled as value.

### 10. Reward and attribution

**Learn:** The bandit can only learn from outcomes that can credibly be linked to its action.

| Outcome | Reward for the selected recovery action? |
| --- | --- |
| Payment completes through a RecoveryOS-created Payment Link | Yes |
| Original payment captures during the grace period | No; natural late capture |
| Customer pays later through an unrelated route | No; unattributed capture |
| No capture | No |

**Why RecoveryOS needs it:** Giving the model credit for a payment it did not cause makes the benchmark dishonest.

### 11. Offline evaluation and simulator discipline

**Learn:** You cannot compare policies fairly if one policy sees easier cases. Use identical held-out seeds and keep the simulator's hidden outcome parameters separate from the policy.

**Minimum benchmark:**

1. Generate randomized historical interactions for warm start.
2. Train/warm-start on only those seeds.
3. Run static retry, rules-only, and RecoveryOS on the same unseen seeds.
4. Compare direct recovered value, attempts, blocks, duplicates, and time to recovery.
5. Persist the seed and configuration hash.

**Do not claim:** “RecoveryOS improves recovery by 31%” until a completed run produces that number.

---

## P3 — Platform knowledge needed for this codebase

### 12. Next.js server versus client boundaries

**Learn:** Razorpay secrets, database access, HMAC verification, QStash signing, and Gemini calls run only on the server. Browser components only receive safe, minimal data.

**Apply it:**

- Use Route Handlers for webhook, job, payment verification, and protected operator APIs.
- Keep raw webhook handling server-side.
- Do not put secrets in `NEXT_PUBLIC_*` variables.
- Use an unguessable token for the customer recovery page.

**Read:**

- [Next.js Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers)

### 13. Neon and database transactions

**Learn:** Financial state changes must be atomic. Store the provider event, state transition, and audit entry together whenever possible.

**Read:**

- [Drizzle with Neon](https://orm.drizzle.team/docs/get-started/neon-new)
- [Neon serverless driver](https://neon.com/docs/serverless/serverless-driver)

**Practice exercise:** Design a unique database constraint for the provider event id and a transaction that either stores the event plus transition or stores neither.

### 14. QStash delayed work

**Learn:** A serverless web request cannot sleep while waiting for late authorization. QStash delivers a signed message later, and the receiver must verify it and remain idempotent.

**Read:**

- [QStash TypeScript overview](https://upstash.com/docs/qstash/sdks/ts/overview)
- [Publish delayed messages](https://upstash.com/docs/qstash/sdks/ts/examples/publish)

**Required rule:** A delayed job must reload the payment journey and safety policy before acting. Queued data is a hint, not the source of truth.

### 15. Gemini structured output and boundaries

**Learn:** Structured output gives JSON-shaped answers, not guaranteed correct business facts. Validate with Zod and constrain Gemini to evidence explanation.

**Read:**

- [Gemini structured output for JavaScript](https://ai.google.dev/gemini-api/docs/structured-output)

**Required rule:** Gemini cannot create payment links, select an action, modify state, or override a safety block.

---

## P4 — Security checklist

- Store Razorpay, Neon, QStash, Gemini, and session secrets only in server-side environment variables.
- Verify Razorpay webhook signatures using the raw request body.
- Use timing-safe comparison for signatures.
- Deduplicate provider event identifiers.
- Verify QStash job signatures.
- Protect operator routes with a signed session.
- Make recovery tokens opaque, high-entropy, and expiring.
- Store only a token digest, not a reusable raw token.
- Use only synthetic customer and transaction data in the project.
- Never expose payment keys, webhook payloads with secrets, or Test Mode credentials in screenshots or commits.

---

## Suggested seven-day learning order

| Day | Read and understand | Apply immediately |
| --- | --- | --- |
| 1 | Payment states, Test Mode, webhook behavior | Payment journey state engine |
| 2 | HMAC, idempotency, transactions | Webhook ingestion and audit trail |
| 3 | Cohorts, baseline, excess failures | Simulator and incident detector |
| 4 | Contextual bandits, LinUCB, attribution | Rules baseline and policy engine |
| 5 | QStash and Payment Links | Delayed verification and recovery flow |
| 6 | Server boundaries and Gemini structured output | Dashboard and explanation panel |
| 7 | Security, evidence, demo narrative | End-to-end Test Mode rehearsal |

---

## What to skip for this Buildathon MVP

You do **not** need to learn these before a strong submission:

- Deep reinforcement learning.
- Neural networks for payment recovery.
- Kubernetes, Kafka, or a microservice fleet.
- Fine-tuning an LLM.
- Full-scale fraud detection.
- Building a generic agent framework.
- Real-time mobile payment routing.
- Sending real customer WhatsApp, email, or voice communications.
- Production data warehousing.

Build a trustworthy, measured recovery loop first. A modest, well-tested LinUCB system with clear safety boundaries is stronger than a complex “AI agent” that cannot prove what it did.
