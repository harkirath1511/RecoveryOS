# RecoveryOS

RecoveryOS is an operator workspace for investigating payment exceptions, verifying provider evidence, and managing controlled payment-recovery workflows. It keeps payment events, state transitions, safety decisions, workflow executions, and outcomes in one auditable record.

Built with Next.js 16, React 19, TypeScript, Drizzle ORM, Neon Postgres, Razorpay, and Upstash QStash.

## What it does

- Receives Razorpay `payment.authorized`, `payment.captured`, and `payment.failed` webhooks.
- Validates the Razorpay HMAC against the raw request body and deduplicates event IDs.
- Persists payment journeys, attempts, workflows, decisions, outcomes, and append-only audit evidence.
- Uses QStash to schedule delayed provider verification.
- Lets an operator investigate journeys and create safety-permitted recovery workflows.
- Creates exact-amount Razorpay **Test Mode** recovery links when persisted safety checks permit them.

## Architecture

```text
Razorpay webhook
      |
      v
/api/webhooks/razorpay
  - raw-body HMAC validation
  - event-id deduplication
  - transactional persistence
      |
      v
Neon Postgres <----> Operator workspace
      |
      v
QStash delayed verification --> /api/jobs/verify-payment --> Razorpay payment fetch
```

## Current scope: one merchant per deployment

RecoveryOS currently supports **one Razorpay merchant per deployment**. A deployment has one set of Razorpay API credentials, one webhook secret, and one public webhook endpoint.

This is an intentional first-release scope decision caused by current time and implementation constraints. It is **not** a limitation, incompatibility, or discrepancy in Razorpay or the RecoveryOS platform. The architecture can expand to support multiple merchants, workspaces, encrypted credentials, unique webhook endpoints, and Razorpay OAuth.

For now, deploy a separate RecoveryOS instance for each merchant that needs isolated data and credentials.

## Important release behavior

Recovery-link creation is deliberately restricted to Razorpay **Test Mode** credentials. The code checks for a key ID beginning with `rzp_test_` before creating a payment link. Do not use this version to initiate live customer recovery payments.

`AUTONOMOUS_RECOVERY_ENABLED` defaults to `false`. Keep it disabled until the entire webhook, delayed-verification, safety, and audit flow has been tested in your environment.

## Requirements

- Node.js 22 or newer
- pnpm 11
- PostgreSQL database; Neon is the intended serverless driver
- Razorpay Test Mode account and API credentials
- Upstash QStash account for delayed verification workflows

## Local setup

```bash
pnpm install
```

Copy the environment template:

```powershell
Copy-Item .env.example .env
```

Set the required values, then apply the included Drizzle migrations:

```powershell
$env:DATABASE_URL="your-postgres-connection-string"
pnpm exec drizzle-kit migrate
```

Start the app:

```bash
pnpm dev
```

## Environment variables

| Variable | Required | Purpose |
| --- | :---: | --- |
| `DATABASE_URL` | Yes | Neon/Postgres connection string. |
| `APP_BASE_URL` | Yes when deployed | Public HTTPS URL used for QStash callbacks. |
| `DEMO_ADMIN_PASSWORD` | Yes | Single operator password. Use a strong private value. |
| `SESSION_SECRET` | Yes | Signs the eight-hour operator session cookie. |
| `RAZORPAY_KEY_ID` | Yes | Razorpay **Test Mode** key ID for recovery links. |
| `RAZORPAY_KEY_SECRET` | Yes | Matching Razorpay Test Mode key secret. |
| `RAZORPAY_WEBHOOK_SECRET` | Yes | Dedicated secret configured on the Razorpay webhook. |
| `QSTASH_TOKEN` | Yes for delayed verification | Publishes delayed verification jobs. |
| `QSTASH_CURRENT_SIGNING_KEY` | Yes for delayed verification | Validates QStash deliveries. |
| `QSTASH_NEXT_SIGNING_KEY` | Yes for delayed verification | Supports QStash signing-key rotation. |
| `QSTASH_URL` | No | Optional custom QStash API base URL. |
| `RECOVERY_GRACE_PERIOD_SECONDS` | No | Verification delay; default `180`. |
| `MAX_AUTOMATED_RECOVERY_ACTIONS` | No | Safety limit; default `2`. |
| `RECOVERY_TOKEN_TTL_SECONDS` | No | Recovery token lifetime; default `86400`. |
| `AUTONOMOUS_RECOVERY_ENABLED` | No | Defaults to `false`. |
| `GROQ_API_KEY` | No | Enables the read-only AI explanation layer. |
| `GROQ_MODEL` | No | Defaults to `openai/gpt-oss-20b`. |

Generate a session secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Never commit `.env` files. Never expose database URLs, API keys, webhook secrets, QStash credentials, or production operator passwords in frontend code, screenshots, issues, or public documentation.

## Razorpay webhook setup

1. Deploy RecoveryOS to a public HTTPS domain.
2. In Razorpay Dashboard, open **Accounts & Settings → Webhooks**.
3. Add:

   ```text
   https://your-domain.com/api/webhooks/razorpay
   ```

4. Subscribe to `payment.authorized`, `payment.captured`, and `payment.failed`.
5. Create a dedicated webhook secret and set the same value as `RAZORPAY_WEBHOOK_SECRET`.
6. Use Razorpay Test Mode while validating the deployment.

The webhook handler calls `request.text()` before verification, so validation runs against the original payload. A unique Razorpay event ID makes repeated deliveries safe.

- [Configure payment webhooks](https://razorpay.com/docs/payments/dashboard/account-settings/webhooks/)
- [About Razorpay webhooks](https://razorpay.com/docs/webhooks/)
- [Validate and test webhooks](https://razorpay.com/docs/webhooks/validate-test/)

## Operator access

RecoveryOS currently has one operator password. A successful login creates a signed, HTTP-only, same-site session cookie lasting eight hours. Signed-in pages verify the session server-side and redirect unauthenticated visitors to `/login`.

For production, use a unique `DEMO_ADMIN_PASSWORD` and random `SESSION_SECRET`, and remove any visible demo-password hint from the login page.

## QStash delayed verification

When a failed payment enters the verification window, RecoveryOS schedules QStash to call:

```text
https://your-domain.com/api/jobs/verify-payment
```

The endpoint verifies the Upstash signature, refetches the Razorpay payment status, and persists the workflow result. It requires an HTTPS `APP_BASE_URL`.

## Deploying to Vercel

1. Push the repository to GitHub and import it as a Next.js project in Vercel.
2. Use Node.js 22 or newer and the standard build command:

   ```bash
   pnpm build
   ```

3. Provision Neon/Postgres and run migrations before the first production test.
4. Add the required production environment variables in Vercel.
5. Deploy, attach the final domain, set `APP_BASE_URL` to that domain, and deploy again.
6. Configure Razorpay and QStash with the final HTTPS URLs.
7. Test a real Razorpay Test Mode webhook, a duplicate delivery, QStash delayed verification, and operator sign-in.

Vercel environment-variable changes apply to new deployments, so redeploy after changing a production value. Keep `/api/webhooks/razorpay` publicly reachable; a blanket deployment password wall can block Razorpay deliveries.

## Quality checks

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

## Project structure

```text
src/app/                  Pages and API route handlers
src/app/api/webhooks/     Razorpay webhook ingestion
src/app/api/jobs/         QStash verification endpoint
src/components/           Landing page and operator UI
src/db/                   Drizzle schema and Neon client
src/lib/razorpay/         Razorpay client, event mapping, HMAC validation
src/lib/recovery/         Safety policy, workflow, outcome, and verification logic
src/lib/auth/             Operator session handling
drizzle/                  SQL migrations
```

## Future multi-business design

A multi-tenant release should add merchant and workspace records, individual operator accounts and roles, encrypted per-merchant credentials, unique webhook endpoints, strict tenant scoping for every query and job, webhook-secret rotation, and Razorpay OAuth where appropriate.

The current one-merchant deployment model is a focused starting point, not a permanent platform restriction.
