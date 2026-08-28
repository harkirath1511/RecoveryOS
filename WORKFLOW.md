# RecoveryOS Development Workflow

## 1. Purpose

This workflow is mandatory for RecoveryOS development. It keeps `main` stable, creates useful review checkpoints, protects secrets and payment data, and makes the repository history understandable to a human reviewer.

The guiding rule is:

> Commit coherent, verified progress. Use a branch when the implementation is uncertain, risky, experimental, or likely to be discarded.

---

## 2. Main branch policy

- Keep `main` in a runnable, reviewable state.
- Do not commit knowingly broken application code to record progress.
- Do not combine unrelated implementation areas in one commit.
- Do not rewrite or discard another contributor's changes without explicit agreement.
- Review the complete diff before every commit.
- Prefer small, meaningful milestones over one large final commit.
- A documentation-only change may be committed without application tests, but its rendered Markdown and links must be reviewed.

---

## 3. When to create a branch

Create a branch before work that is:

- Experimental or based on an unproven approach.
- Likely to require several alternative implementations.
- Risky to payment state, idempotency, money calculation, or safety policy.
- Large enough to leave `main` unstable during development.
- Dependent on uncertain third-party behavior.
- A refactor that could obscure functional changes.

Direct work on `main` is acceptable only for small, well-understood, independently verifiable changes when no conflicting work is in progress.

Suggested human branch names:

```text
feature/payment-state-engine
feature/recovery-dashboard
fix/webhook-idempotency
experiment/linucb-policy
```

When Codex creates a branch, it must use the required `codex/` prefix:

```text
codex/feature-payment-state-engine
codex/feature-recovery-dashboard
codex/fix-webhook-idempotency
codex/experiment-linucb-policy
```

Do not merge an abandoned, failing, or unverified experiment into `main`.

---

## 4. Experimental branch workflow

1. State the question the experiment is meant to answer.
2. Create a narrowly named branch.
3. Keep the experiment isolated from unrelated product work.
4. Add focused tests or a reproducible benchmark where applicable.
5. Record the result and trade-off in documentation, an issue, or the merge description.
6. Run the relevant verification commands.
7. Review the branch diff against `main`.
8. Merge only the useful, verified implementation.

If an experiment fails, preserve the conclusion in a short note when it prevents future repeated work. Do not merge its broken implementation merely to retain history.

---

## 5. Commit frequency

Commit after a meaningful implementation checkpoint when:

- The intended behavior is complete for that checkpoint.
- Relevant tests pass.
- Type checking and linting pass when those tools are available.
- The diff contains one understandable concern.
- No secret or environment value is included.

Do not commit after every tiny edit. Do not wait until the entire project is finished.

A reasonable development session may contain several coherent commits, for example:

1. Add the payment-event schema and migration.
2. Implement idempotent webhook ingestion with tests.
3. Implement valid payment state transitions with tests.
4. Add out-of-order event handling and audit evidence.

---

## 6. Required commit checkpoints

The expected project history should include checkpoints resembling the following. Combine adjacent checkpoints only when they are genuinely one atomic change.

1. **Documentation:** architecture, safety rules, and workflow.
2. **Foundation:** Next.js scaffold, strict TypeScript, linting, testing, and environment validation.
3. **Data model:** Neon/Drizzle schema and reviewed migrations.
4. **Webhook processing:** verification, validation, event deduplication, and audit storage.
5. **Payment state:** legal transitions, late authorization, and terminal-state protection.
6. **Simulator:** deterministic generation, virtual time, and reproducible seeds.
7. **Incident detection:** rolling metrics, degradation thresholds, and segment ranking.
8. **Recovery policy:** rules-only baseline, LinUCB selection, and persistence.
9. **Safety engine:** action eligibility, attempt limits, amount invariants, and blocking reasons.
10. **Execution:** QStash jobs, recovery tokens, and Razorpay Test Mode flow.
11. **Attribution:** verified outcomes, recovery categories, and policy updates.
12. **Dashboard:** command center, incident detail, payment timeline, and benchmark views.
13. **Gemini:** provider adapter, structured explanations, and deterministic fallback.
14. **Reliability:** integration tests, browser tests, error states, and security review.
15. **Deployment:** Vercel configuration, smoke test, and submission documentation.

---

## 7. Commit messages

Use concise, human-friendly imperative messages that describe the observable change.

Good examples:

```text
Document RecoveryOS architecture and safety rules
Add idempotent Razorpay webhook ingestion
Implement payment recovery state transitions
Block recovery after a captured payment
Detect payment degradation across provider cohorts
Compare RecoveryOS against static retry baseline
Explain recovery decisions with Gemini evidence
```

Avoid vague or mechanical messages:

```text
update
changes
stuff
fix code
WIP
more work
final changes
```

Guidelines:

- Start with a verb such as `Add`, `Implement`, `Prevent`, `Validate`, `Explain`, `Document`, or `Compare`.
- Describe the behavior or purpose, not the filenames touched.
- Keep the subject short enough to scan in `git log`.
- Use the commit body for important reasoning, constraints, migrations, or follow-up work.
- Do not claim a test, metric, or integration works unless it was verified.

---

## 8. Verification before committing

Once the application toolchain exists, run the relevant subset of:

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

Minimum expectations:

- Documentation: review rendered Markdown, headings, code fences, tables, and links.
- Domain logic: run focused unit tests and the full unit suite.
- Database changes: review generated SQL and test migration against a development database.
- API changes: test valid, invalid, duplicate, and unauthorized requests.
- UI changes: run component/browser tests and inspect the relevant responsive state.
- Integration changes: verify both success and vendor-failure behavior.
- Deployment changes: run a production build and deployed smoke test.

If a check cannot run, record why in the handoff or commit body. Do not silently describe an unrun check as passing.

---

## 9. Database and lockfile changes

- Commit a schema migration with the code that requires it.
- Review generated migration SQL before committing it.
- Do not edit an already-applied migration merely to make history look cleaner.
- Include `pnpm-lock.yaml` only when dependency declarations change.
- Keep dependency-only changes separate from unrelated behavior where practical.
- Explain unusual generated-file changes in the commit body.

---

## 10. Secrets and sensitive data

Never commit:

- `.env`, `.env.local`, or exported hosting environment files.
- Razorpay key secrets or webhook secrets.
- Gemini API keys.
- Neon connection strings or database passwords.
- QStash tokens or signing keys.
- Session secrets or administrator passwords.
- Real customer names, contacts, payment records, or identifiers.
- Raw webhook fixtures containing sensitive or production data.

Allowed repository content:

- `.env.example` containing variable names and empty or unmistakably fake placeholder values.
- Synthetic fixtures generated specifically for the simulator.
- Redacted webhook fixtures with invented identifiers.

Before committing, inspect both tracked and untracked files and search the staged diff for accidental credentials. If a real secret is ever committed, revoke and rotate it; deleting it from the latest file is not sufficient.

---

## 11. Reviewing and merging branches

Before merging:

1. Update the branch from the intended base without discarding unrelated work.
2. Run the required verification.
3. Review the diff for correctness, scope, generated files, and secrets.
4. Confirm migrations are safe and reversible where practical.
5. Confirm user-visible behavior matches `SETUP.md`.
6. Document important trade-offs or deviations from the specification.
7. Use a human-friendly merge or squash message.

For uncertain financial logic, require evidence from focused tests before merging. Passing UI behavior does not compensate for missing state, safety, or attribution tests.

---

## 12. Handoffs and unfinished work

When stopping before a feature is complete:

- Leave the stable branch passing its existing checks.
- Keep incomplete experiments on their branch.
- State what works, what remains, and what was actually tested.
- Record any external setup still required.
- Do not use a vague `WIP` commit on `main` as a substitute for a handoff note.

---

## 13. Documentation-first gate

`SETUP.md` and `WORKFLOW.md` must exist before application scaffolding, dependency installation, migrations, or source-code implementation begins.

The initial documentation commit message is:

```text
Document RecoveryOS architecture and development workflow
```

All later implementation must follow this workflow unless the repository owner explicitly revises it.
