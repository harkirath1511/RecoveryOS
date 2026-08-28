# RecoveryOS — Autonomous Payment Revenue Recovery

## 1. Purpose of this document

This document is the implementation source of truth for RecoveryOS. It defines the product, architecture, safety model, learning system, interfaces, data contracts, evaluation methodology, demo, and delivery sequence before application code is written.

RecoveryOS is being built for Razorpay's AI Revenue Recovery track. The submission must demonstrate a closed loop:

```text
Detect revenue loss
  → diagnose the actionable cause
  → choose a bounded recovery action
  → execute a supported workflow
  → observe the real payment outcome
  → attribute recovered revenue
  → learn from the result
```

RecoveryOS is not a chatbot and is not an LLM wrapper. Removing Gemini must not stop payment ingestion, incident detection, recovery decisions, safety checks, execution, attribution, benchmarking, or auditing.

---

## 2. Problem statement

A failed payment does not always require the same response.

| Situation | Safe, useful response |
| --- | --- |
| Temporary network timeout | Wait briefly, verify status, then offer a retry |
| Bank, issuer, or UPI provider degradation | Offer a supported alternate payment flow |
| Customer-correctable input error | Let the customer correct the input and retry |
| Insufficient funds | Do not repeatedly retry automatically |
| Possible late authorization | Wait and verify before creating another payment |
| Hard decline | Stop automated recovery and request review |

Traditional recovery often applies a static rule such as `payment failed → retry`. That wastes attempts, frustrates customers, ignores active payment degradation, and can initiate another payment while the original attempt is still becoming authorized.

RecoveryOS answers one operational question:

> Given this exact payment state, which permitted action is most likely to recover the outstanding revenue safely?

It then performs the supported recovery workflow and measures the verified result.

---

## 3. Product thesis

RecoveryOS is an event-driven revenue-recovery layer for a merchant's payment system. It combines:

- A payment state engine that tolerates duplicate, delayed, and out-of-order events.
- Statistical degradation detection across payment cohorts.
- Deterministic root-cause ranking based on excess failures.
- A contextual-bandit policy that ranks permitted recovery actions.
- A non-bypassable safety engine.
- Razorpay Test Mode recovery execution.
- Honest outcome attribution and reproducible benchmarking.
- A read-only Gemini investigation and explanation interface.

The operating loop is:

```text
Detect → Diagnose → Decide → Recover → Learn
```

The system works at two connected levels:

1. **Incident level:** identify where a merchant's success rate is degrading and how much revenue is exposed.
2. **Payment level:** decide whether and how each eligible failed payment should enter recovery.

An incident may influence eligibility and action scores, but it never bypasses payment-level safety checks.

---

## 4. Success criteria

The project is successful when it can:

1. Ingest signed Razorpay payment events idempotently.
2. Preserve the correct payment state when events are duplicated or out of order.
3. Detect a planted degradation in a sufficiently large payment cohort.
4. Rank the planted affected segment as the primary contributor.
5. Select only actions allowed by the safety engine.
6. Execute a real Razorpay Test Mode recovery through a supported checkout or Payment Link.
7. Observe the verified outcome through a webhook or payment fetch.
8. Separate direct recovery from late capture and unattributed success.
9. Benchmark RecoveryOS against static-retry and rules-only policies on identical unseen scenarios.
10. Report measured results without inventing a predetermined uplift.
11. Produce zero unsafe executed actions and zero duplicate recovery payments in the benchmark.
12. Explain every decision using stored evidence and an immutable audit trail.

---

## 5. Users and journeys

### 5.1 Merchant operator

The merchant opens the command center and sees:

- Current payment success rate and its baseline.
- Active revenue incidents.
- Revenue at risk, with assumptions and uncertainty visible.
- The most affected payment segment.
- Recovery actions proposed, blocked, executing, and completed.
- Expected recovery compared with verified actual recovery.
- An audit trail for every payment journey.

The merchant can inspect an incident, inspect an individual payment, run the simulator, compare policies, and ask Gemini to explain stored evidence.

### 5.2 Affected customer

The customer receives or opens an unguessable, expiring recovery URL in the demo. The page:

- Shows the outstanding amount and merchant reference.
- Does not expose internal failure details or model scores.
- Offers only the action approved for that journey.
- Opens the original or alternate Razorpay Test Mode checkout.
- Stops offering payment as soon as a valid capture is observed.

Automatic SMS and email delivery are outside the MVP. RecoveryOS generates and displays the recovery URL; it does not send customer communication automatically.

### 5.3 Buildathon judge

The judge can trigger a seeded scenario, watch degradation emerge, inspect the diagnosed cohort, observe the selected action and safety evaluation, complete a Test Mode recovery, and see the verified outcome update revenue and policy evidence.

---

## 6. Five-minute demonstration

1. **Normal state:** show approximately 94% simulated payment success.
2. **Incident:** inject a seeded degradation affecting one bank/provider, method, error, and device segment.
3. **Detection:** show the current rate fall, revenue at risk, and the top contributing segment.
4. **Decision:** open one failed payment and show all eligible actions, predicted success, expected value, exploration bonus, and blocked actions.
5. **Safety:** demonstrate that a hard decline or already-captured order cannot be retried.
6. **Execution:** create a Razorpay Test Mode recovery flow and complete it.
7. **Outcome:** receive the verified capture, stop the workflow, and record direct recovered revenue.
8. **Failure recovery:** replay a duplicate or late event and show that it cannot create a second payment.
9. **Evidence:** show the immutable audit timeline and ask Gemini why the action was selected.
10. **Benchmark:** compare static retry, rules-only recovery, and RecoveryOS on the same unseen seeds.

---

## 7. Scope and non-goals

### 7.1 MVP scope

- One Next.js application written entirely in TypeScript.
- Razorpay Test Mode only.
- Synthetic large-scale payment environment plus clearly separated Test Mode journeys.
- Hybrid incident and individual-payment recovery.
- LinUCB recovery policy implemented in TypeScript.
- Deterministic safety, state, attribution, and incident logic.
- Neon Postgres persistence.
- Upstash QStash delayed verification jobs.
- Direct Gemini API integration behind a provider interface.
- A merchant command center and customer recovery page.

### 7.2 Explicit non-goals

- No Python services, notebooks, or training pipeline.
- No live-money processing.
- No real customer or cardholder data.
- No autonomous SMS, email, or voice outreach.
- No Vercel AI Gateway or paid Vercel AI service.
- No general multi-agent framework.
- No RAG or vector database.
- No attempt to replace Razorpay's payment routing.
- No claim that a generic retry is always available as a direct Razorpay API operation.
- No offensive payment or fraud capability.
- No fabricated revenue, recovery rate, or model-accuracy claims.
- No production rollout claim based solely on synthetic evidence.

---

## 8. Technology decisions

| Area | Decision |
| --- | --- |
| Language | TypeScript with strict compiler settings |
| Application | Next.js App Router |
| Package manager | pnpm |
| Styling | Tailwind CSS and shadcn/ui |
| Charts | Recharts |
| Database | Neon Postgres |
| ORM and migrations | Drizzle ORM and Drizzle Kit |
| Delayed work | Upstash QStash |
| Validation | Zod at every external boundary |
| Numerical operations | A small tested matrix library for LinUCB |
| LLM | Gemini called directly with `@google/genai` |
| Authentication | Single-operator signed, HTTP-only session for the demo |
| Unit/integration tests | Vitest |
| Browser tests | Playwright |
| Hosting | Vercel |

The application uses Node.js server routes for cryptography, webhook verification, database access, and vendor integrations. Payment secrets and Gemini credentials never enter client bundles.

---

## 9. High-level architecture

```text
Razorpay webhooks / simulator events
                 │
                 ▼
      Signature + schema validation
                 │
                 ▼
       Idempotent event ingestion
                 │
                 ▼
       Payment journey state engine
          │                  │
          │                  └── late-authorization verification job
          ▼
 Cohort metrics + degradation detector
                 │
                 ▼
       Root-cause segment ranking
                 │
                 ▼
        Revenue-at-risk estimate
                 │
                 ▼
     Context builder + allowed actions
                 │
                 ▼
          LinUCB policy ranking
                 │
                 ▼
    Deterministic safety-policy engine
                 │
                 ▼
      Recovery workflow + Razorpay
                 │
                 ▼
       Verified payment outcome
          │                  │
          ▼                  ▼
 Outcome attribution     Immutable audit
          │
          ▼
    LinUCB policy update
```

Gemini sits beside this flow. It reads structured evidence through application services and produces explanations or communication drafts. It cannot call payment execution services.

---

## 10. Input data and privacy boundary

### 10.1 Payment context

The normalized context may contain:

- Internal journey and order identifiers.
- Amount in the smallest currency unit and currency.
- Payment method and provider/bank where available.
- Razorpay error code, source, step, and reason.
- Attempt number and time since failure.
- Current incident and downtime signals.
- Coarse device/network category supplied by the merchant demo frontend.

### 10.2 Data not collected

- Card number, CVV, UPI PIN, OTP, bank credentials, or authentication secrets.
- Real email addresses, phone numbers, addresses, or personal customer history.
- Raw production payment data.

Simulator customers use generated identifiers. Test Mode journeys use synthetic contact details approved for the demo.

---

## 11. Payment event and state engine

Payment providers may deliver events more than once, after a delay, or out of chronological order. The event engine therefore stores immutable events and derives journey state using explicit transitions.

### 11.1 Payment states

```text
CREATED
  → ATTEMPTED
  → FAILED_PENDING_VERIFICATION
  → RETRY_ELIGIBLE
  → AUTHORIZED
  → CAPTURED

Terminal alternatives:
  → HARD_DECLINED
  → EXPIRED
  → CANCELLED
  → MANUAL_REVIEW
```

`CAPTURED`, `EXPIRED`, and `CANCELLED` are terminal for automated recovery. An older failure event cannot move a captured journey backwards.

### 11.2 Event processing rules

- Verify the Razorpay signature against the raw request body before JSON parsing.
- Validate the parsed payload with Zod.
- Store the provider event identifier with a unique constraint.
- A duplicate delivery returns success without applying the transition twice.
- Store both provider occurrence time and server receipt time.
- Apply transitions inside a database transaction.
- Write an audit entry for accepted, ignored, conflicting, and invalid transitions.
- Schedule delayed status verification after a recoverable failure.
- Cancel or harmlessly no-op delayed jobs after capture.

### 11.3 Grace period

The grace period is configuration-driven and shortened for the live demonstration. It exists to detect late authorization before another payment is offered. Simulator time is virtual and can advance without wall-clock waiting.

---

## 12. Degradation detection

RecoveryOS maintains rolling success metrics for:

- Overall merchant traffic.
- Payment method.
- Bank, issuer, network, PSP, or provider where available.
- Error reason and source.
- Device category.
- Combinations that have sufficient observations.

For each candidate cohort, the detector compares a short current window with a longer baseline window.

An incident requires all of the following:

1. A configured minimum number of attempts.
2. A configured minimum absolute success-rate drop.
3. Statistical confidence that the drop is not ordinary sampling noise.
4. No existing open incident covering the same cohort and time range.

The exact thresholds are configuration values recorded with every benchmark run. Small cohorts cannot create incidents merely because one payment failed.

---

## 13. Root-cause ranking

Root-cause analysis is deterministic and evidence-based. Candidate segments are ranked by their contribution to excess failures:

```text
excess failures
  = current attempts × max(0, baseline success rate - current success rate)
```

The ranking also includes confidence, sample size, concentration within the incident, and any matching Razorpay downtime signal.

The detector does not claim a perfect causal explanation. It reports the most actionable affected segment, for example:

```text
Current success: 72.1%
Baseline success: 94.2%
Primary segment: HDFC + UPI + TIMEOUT + Android
Share of excess failures: 68%
Confidence: 89%
Downtime corroboration: present
```

Gemini may explain this evidence but cannot change the ranking.

---

## 14. Revenue at risk

Revenue at risk is not the sum of all failed payments and is not an LLM estimate.

For each eligible outstanding journey:

```text
incremental recoverability
  = max(0, best permitted action probability - no-action probability)

expected recoverable value
  = outstanding amount × incremental recoverability - intervention cost
```

Incident revenue at risk is the sum of expected recoverable value for eligible journeys. The dashboard displays:

- Total outstanding failed value.
- Estimated recoverable value.
- Confidence/calibration information.
- Actual verified recovery to date.
- The simulator or Test Mode source of the data.

The estimate must never be displayed as money already recovered.

---

## 15. Recovery action space

| Action | Meaning |
| --- | --- |
| `WAIT_AND_VERIFY` | Delay action and fetch/observe the original payment state |
| `RETRY_ORIGINAL_CHECKOUT` | Present a safe retry of the supported original checkout flow |
| `OFFER_ALTERNATE_CHECKOUT` | Present permitted alternate payment-method choices |
| `CREATE_PAYMENT_LINK` | Create a Razorpay Test Mode Payment Link for the outstanding amount |
| `MANUAL_REVIEW` | Stop automation and place the journey in an operator queue |
| `STOP_RECOVERY` | End recovery because the journey is terminal or unsafe |

RecoveryOS offers supported flows. It does not claim that it can silently reroute an arbitrary transaction or force a customer to complete a payment.

---

## 16. Contextual recovery policy

### 16.1 Why LinUCB

LinUCB is small enough to implement and audit in TypeScript while still being a real contextual bandit. It learns a separate linear reward model for each action and includes an uncertainty bonus during permitted exploration.

### 16.2 Context features

The fixed, versioned feature vector contains:

- Bias term.
- Normalized or bucketed transaction amount.
- Payment method.
- Provider/bank category.
- Error source, step, and reason.
- Attempt number.
- Time-since-failure bucket.
- Time-of-day bucket.
- Device category.
- Active incident indicators.
- Downtime indicator and severity.

Unknown categories map to explicit `OTHER` features. Feature schema changes require a new policy version.

### 16.3 Selection

For each action allowed by safety policy, LinUCB calculates:

- Predicted mean success reward.
- Uncertainty/exploration bonus.
- Selection score.
- Expected recovered value excluding the exploration bonus.

The dashboard displays the predicted mean and expected value separately from the exploration term so uncertainty is not misrepresented as revenue.

### 16.4 Reward

The learning reward is based on a verified capture attributable to the selected action. Intervention cost and attempt penalties are incorporated into action ranking and benchmark economics.

An unattributed capture does not become a positive learning reward.

---

## 17. Cold start and learning

The initial policy is warm-started using randomized logged interactions from the synthetic environment:

```text
Hidden simulator
  → randomized safe logging policy
  → historical interaction dataset
  → initial LinUCB state
  → unseen evaluation scenarios
```

The simulator defines outcome behavior independently of the policy implementation. Fixed training seeds and fixed held-out seeds must not overlap.

During the Buildathon:

- Exploration occurs only in the simulator and Razorpay Test Mode.
- Production mode, if represented, defaults to the best known permitted action.
- Every policy update is versioned and auditable.
- Benchmark results can be reproduced from a recorded seed and configuration hash.

---

## 18. Safety engine

Machine learning ranks only actions that deterministic policy allows. Safety rules cannot be changed by Gemini or bypassed by a higher bandit score.

Mandatory invariants:

- Never execute recovery after a valid capture for the order.
- Never request more than the outstanding order amount.
- Allow no more than two automated recovery actions per journey.
- Never automatically retry a hard decline.
- Respect the late-authorization grace period.
- Stop immediately after successful payment.
- Treat duplicate jobs and events idempotently.
- Require manual review for conflicting financial states.
- Record the context, candidate actions, rule results, decision, execution, and outcome.
- Do not explore an action prohibited for the current context.
- Do not send customer communication automatically in the MVP.

Safety evaluation returns a structured result with the rule identifier, pass/block state, and human-readable reason.

---

## 19. Recovery execution

The selected action creates a `RecoveryWorkflow`. Depending on the action, the workflow may:

- Schedule a delayed payment-status verification through QStash.
- Generate an expiring customer recovery token.
- Present the original supported checkout again.
- Present permitted alternate methods in the recovery page.
- Create a Razorpay Test Mode Payment Link for the exact outstanding amount.
- End in manual review or stopped state.

Every externally delivered job is signed and idempotent. Before execution, the worker reloads the latest journey state and safety policy rather than trusting stale queued data.

---

## 20. Expected versus actual outcome

Before execution, RecoveryOS records:

- Predicted success probability.
- Expected recovered amount.
- Chosen action and alternatives.
- Model and policy version.
- Safety checks.

After execution, it records only provider-verified facts:

- Final payment state.
- Captured amount.
- Payment and order identifiers.
- Event or API evidence.
- Attribution category.
- Time and attempts required.

The clean chain is:

```text
Prediction → permitted action → supported execution → verified outcome
```

---

## 21. Outcome attribution

| Category | Definition | Included in policy recovery? |
| --- | --- | --- |
| `DIRECT_RECOVERY` | Capture occurred through the RecoveryOS-generated flow | Yes |
| `NATURAL_LATE_CAPTURE` | Original attempt captured during verification/grace period | No; report as retained revenue |
| `UNATTRIBUTED_CAPTURE` | Capture occurred but cannot be causally linked to the action | No |
| `NOT_RECOVERED` | Workflow ended without a capture | No |
| `DUPLICATE_PREVENTED` | Safety stopped a conflicting second recovery | No; report prevented exposure |

Synthetic benchmark outcomes and Razorpay Test Mode outcomes are never combined into one headline number.

---

## 22. Gemini's role

Gemini is integrated directly through `@google/genai` behind a provider-neutral interface so it can later be replaced by Groq or another provider.

Allowed responsibilities:

- Explain an incident using stored metrics.
- Explain why an action was selected or blocked.
- Summarize a payment audit trail.
- Draft merchant or customer communication without sending it.
- Answer questions through read-only, explicitly defined data tools.

Forbidden responsibilities:

- Calculate ledger amounts.
- Change payment or recovery state.
- Approve an action blocked by safety policy.
- Create a Payment Link.
- Send a message.
- Invent missing evidence or outcome values.

Gemini responses use structured output validated by Zod. Explanations cite internal incident, decision, event, or audit identifiers. If Gemini is unavailable, deterministic explanations remain visible and the recovery loop continues normally.

---

## 23. Core data entities

### `PaymentJourney`

Tracks the merchant order, original amount, outstanding amount, current state, terminal outcome, and timestamps.

### `PaymentAttempt`

Stores each provider attempt, method/provider metadata, failure fields, and relationship to its journey.

### `PaymentEvent`

Stores immutable verified provider or simulator events, provider event identifier, occurrence time, receipt time, payload digest, and processing result.

### `Incident`

Stores baseline/current windows, affected segment, excess-failure contribution, confidence, downtime evidence, status, and configuration snapshot.

### `RecoveryDecision`

Stores the versioned context vector, candidate actions, policy estimates, selected action, safety results, and decision reason.

### `RecoveryWorkflow`

Stores execution state, scheduled checks, customer token digest, external resource identifiers, attempt count, expiry, and terminal reason.

### `RecoveryOutcome`

Stores the verified financial result, captured amount, attribution category, evidence identifiers, and learning reward.

### `BanditState`

Stores versioned LinUCB matrices and feature/action schema identifiers.

### `AuditEntry`

Stores append-only actor, action, reason, evidence references, previous state, new state, and timestamp.

### `BenchmarkRun`

Stores seed, policy, simulator configuration, policy version, dataset split, metrics, and reproducibility hash.

All money values are integers in the smallest currency unit. Floating-point values are restricted to model probabilities, confidence, and normalized features.

---

## 24. API boundaries

### External write boundaries

- Razorpay webhook endpoint: raw-body signature verification and idempotent event ingestion.
- QStash recovery-job endpoint: QStash signature verification and current-state revalidation.
- Razorpay checkout verification endpoint: server-side order lookup and signature verification.

### Protected operator boundaries

- Start or replay a simulator run.
- Start a benchmark run.
- Read incidents, journeys, decisions, outcomes, metrics, and audits.
- Request a Gemini explanation.
- Approve a manual-review action if the demo includes approval.

### Customer boundary

- Resolve a valid, unexpired recovery token.
- Read only the minimum display information.
- Start the already-approved Test Mode recovery flow.

Every boundary uses Zod validation, consistent error objects, request correlation identifiers, and explicit authorization.

---

## 25. Product surfaces

### Revenue incident command center

- Current and baseline payment success.
- Active incident count and severity.
- Outstanding and estimated recoverable value.
- Direct actual recovery and natural late capture.
- Affected cohorts and recovery funnel.

### Incident detail

- Timeline and statistical evidence.
- Ranked affected segments.
- Downtime corroboration.
- Eligible payments and action distribution.
- Expected versus actual recovery.

### Payment journey detail

- Financial state.
- Provider events in occurrence and receipt order.
- Recovery context and candidate actions.
- Safety checks.
- Execution and outcome.
- Immutable audit timeline.

### Recovery Lab

- Seed and volume controls.
- Degradation scenario selection.
- Static retry, rules-only, and RecoveryOS comparison.
- Revenue, recovery rate, attempts, blocked actions, duplicate prevention, and time-to-recovery metrics.

### Customer recovery page

- Merchant reference and outstanding amount.
- Approved recovery choice.
- Razorpay Test Mode checkout.
- Paid, expired, already-completed, and unavailable states.

### Explanation panel

- Suggested evidence-grounded questions.
- Structured Gemini explanation.
- Links to cited internal evidence.
- Deterministic fallback when Gemini is unavailable.

---

## 26. Simulator

The simulator generates payment contexts and outcomes using a hidden, versioned environment model. Outcome probabilities depend on interacting factors such as method, provider, error, amount, attempt number, downtime, device, time, and action.

Requirements:

- Deterministic output for a fixed seed and configuration.
- Separate training/logging and held-out evaluation seeds.
- Randomized safe logging policy for warm-start data.
- Virtual time for delayed events and late authorization.
- Duplicate and out-of-order event injection.
- Configurable degradation scenarios.
- No frontend access to hidden outcome parameters during a run.
- Persisted run configuration and reproducibility hash.

The simulator is evidence for comparative engineering performance, not evidence of real merchant revenue.

---

## 27. Benchmark

Run all policies against identical unseen scenarios:

1. **Static retry:** retry every eligible failure using one fixed strategy.
2. **Rules-only:** select actions from deterministic failure and downtime mappings.
3. **RecoveryOS:** rank permitted actions with LinUCB and enforce the same safety engine.

Primary metrics:

- Direct recovered amount.
- Incremental recovered amount versus baseline.
- Recovery rate.
- Attempts per successful recovery.
- Total automated actions.
- Unsafe recommendations blocked.
- Unsafe actions executed.
- Duplicate recovery attempts.
- Duplicate payments prevented.
- Natural late-capture amount.
- Unattributed capture amount.
- Median time to recovery.
- Predicted-versus-observed calibration.

The benchmark headline is written only after a completed reproducible run. No target uplift is embedded in product copy beforehand.

---

## 28. Testing strategy

### State and safety tests

- Valid event transitions update state once.
- Duplicate delivery does not repeat a transition or action.
- An older failure cannot reopen a captured journey.
- Late capture cancels or neutralizes queued recovery.
- Hard declines permit only stop or manual review.
- Attempt limits are enforced under concurrency.
- Requested recovery never exceeds outstanding value.
- Conflicting financial states enter manual review.

### Integration tests

- Accept valid Razorpay signatures and reject invalid signatures.
- Use the raw webhook body for signature verification.
- Verify checkout callbacks server-side.
- Verify QStash signatures.
- Make QStash retries idempotent.
- Create and fetch a Test Mode Payment Link through the adapter.
- Keep vendor errors from corrupting journey state.

### Detector and policy tests

- Do not trigger incidents below minimum volume.
- Detect a planted material degradation.
- Rank the planted affected segment first.
- Produce identical simulator output for the same seed.
- Prove training and evaluation seeds do not overlap.
- Prevent prohibited actions from entering LinUCB selection.
- Update only from attributable outcomes.
- Serialize and restore policy state without changing predictions.

### Product tests

- Operator routes reject unauthenticated access.
- Expired or invalid recovery tokens reveal no payment data.
- Customer page stops after capture.
- Gemini failure leaves deterministic evidence accessible.
- Dashboard labels simulator and Test Mode results correctly.
- One end-to-end browser test covers failure through verified recovery.

---

## 29. Acceptance criteria

- At least 500 held-out synthetic journeys are evaluated reproducibly.
- All three benchmark policies use identical scenarios.
- RecoveryOS improves recovered value or recovery efficiency over static retry using measured output.
- Zero unsafe actions are executed.
- Zero duplicate recovery payments are created.
- Direct, late, unattributed, and prevented outcomes are reported separately.
- One real Razorpay Test Mode recovery is completed and verified.
- Every decision has an inspectable audit record.
- The core application works with Gemini disabled.
- The public repository contains setup, architecture, benchmark, test, and demo instructions.

---

## 30. Environment variables

Only placeholder names belong in documentation or example environment files. Real values must never be committed.

```dotenv
# Application
APP_BASE_URL=
DEMO_ADMIN_PASSWORD=
SESSION_SECRET=

# Neon
DATABASE_URL=

# Razorpay Test Mode only
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=

# Upstash QStash
QSTASH_URL=
QSTASH_TOKEN=
QSTASH_CURRENT_SIGNING_KEY=
QSTASH_NEXT_SIGNING_KEY=

# Gemini
GEMINI_API_KEY=
GEMINI_MODEL=

# Recovery policy
RECOVERY_GRACE_SECONDS=
MAX_AUTOMATED_RECOVERY_ACTIONS=2
RECOVERY_TOKEN_TTL_SECONDS=
LINUCB_ALPHA=

# Simulator
SIMULATOR_DEFAULT_SEED=
SIMULATOR_DEFAULT_VOLUME=500
```

Secrets are configured in `.env.local` for local development and in the corresponding hosting dashboards for deployment.

---

## 31. Account and deployment setup

### Razorpay

1. Create a Razorpay account and switch to Test Mode.
2. Generate Test Mode API credentials.
3. Configure the deployed HTTPS webhook endpoint and webhook secret.
4. Subscribe only to the payment, order, and Payment Link events required by the implemented state machine.
5. Complete all demonstrations with test instruments and synthetic identities.

### Neon

1. Create a Neon project and database.
2. Copy the pooled/serverless connection string into `DATABASE_URL`.
3. Generate reviewed Drizzle migrations.
4. Apply migrations separately to development and deployed databases.

### Upstash QStash

1. Create a QStash account and obtain the token/signing keys.
2. Configure the deployed recovery-job endpoint as the destination.
3. Verify every delivered job before processing it.
4. Use per-journey idempotency keys and re-check current state on delivery.

### Gemini

1. Create a Gemini API key.
2. Store it only in server-side environment configuration.
3. Use the provider adapter and structured output validation.
4. Confirm the core demo still works with the key removed.

### Vercel

1. Connect the repository.
2. configure all server-side environment variables.
3. Deploy the Next.js application.
4. Use the resulting HTTPS URL for Razorpay and QStash callbacks.
5. Run the smoke test before recording the pitch.

---

## 32. Seven-day implementation order

### Day 1 — Foundation and contracts

- Scaffold strict TypeScript Next.js.
- Configure lint, formatting, tests, and environment validation.
- Add Neon/Drizzle and the initial schema.
- Add demo authentication and audit primitives.

### Day 2 — Payment truth

- Implement Razorpay signature verification and typed adapter.
- Implement idempotent event ingestion.
- Implement payment journey state transitions.
- Test duplicates, late events, and terminal-state invariants.

### Day 3 — Simulator and incidents

- Build deterministic virtual-time simulator.
- Generate randomized warm-start interactions.
- Implement rolling metrics, degradation detection, and segment ranking.
- Persist reproducible simulator runs.

### Day 4 — Recovery intelligence

- Implement rules-only baseline.
- Implement versioned LinUCB feature encoding, selection, persistence, and update.
- Implement safety evaluation and action eligibility.
- Run the first three-policy held-out benchmark.

### Day 5 — Execution loop

- Implement QStash delayed verification.
- Implement recovery tokens and customer page.
- Integrate Razorpay Test Mode Payment Links or supported checkout.
- Implement outcome attribution and policy updates.

### Day 6 — Command center and explanation

- Build command center, incident detail, payment timeline, and benchmark UI.
- Add expected-versus-actual and attribution visualizations.
- Add the direct Gemini provider and deterministic fallback.

### Day 7 — Reliability and submission

- Complete integration and browser tests.
- Run and record the final reproducible benchmark.
- Verify the deployed Test Mode flow.
- Finish README, architecture graphic, audit example, and demo script.
- Record the five-minute pitch.

If schedule pressure occurs, preserve the payment state engine, simulator, safety engine, benchmark, attribution, and one Test Mode recovery. Reduce Gemini and visual polish before reducing core correctness.

---

## 33. Implementation gate

No application code, dependency installation, generated configuration, or migration should be created until this specification and `WORKFLOW.md` are present and reviewed. Subsequent work must follow the repository workflow and commit checkpoints defined there.
