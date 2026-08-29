CREATE EXTENSION IF NOT EXISTS pgcrypto;
--> statement-breakpoint
ALTER TABLE "payment_journeys" ADD COLUMN "provider_payment_id" text;
ALTER TABLE "payment_journeys" ADD COLUMN "original_amount" bigint;
ALTER TABLE "payment_journeys" ADD COLUMN "currency" text NOT NULL DEFAULT 'INR';
ALTER TABLE "payment_journeys" ADD COLUMN "payment_method" text;
ALTER TABLE "payment_journeys" ADD COLUMN "provider" text;
ALTER TABLE "payment_journeys" ADD COLUMN "device_category" text;
ALTER TABLE "payment_journeys" ADD COLUMN "terminal_outcome" text;
UPDATE "payment_journeys" SET "original_amount" = "outstanding_amount" WHERE "original_amount" IS NULL;
--> statement-breakpoint
CREATE TABLE "payment_attempts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "journey_id" uuid NOT NULL REFERENCES "payment_journeys"("id"),
  "provider_payment_id" text UNIQUE,
  "provider_order_id" text,
  "amount" bigint NOT NULL,
  "currency" text NOT NULL DEFAULT 'INR',
  "method" text,
  "provider" text,
  "device_category" text,
  "status" text NOT NULL,
  "error_code" text,
  "error_source" text,
  "error_step" text,
  "error_reason" text,
  "provider_occurred_at" timestamp with time zone,
  "received_at" timestamp with time zone DEFAULT now() NOT NULL,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "webhook_events" ADD COLUMN "journey_id" uuid REFERENCES "payment_journeys"("id");
ALTER TABLE "webhook_events" ADD COLUMN "payment_attempt_id" uuid REFERENCES "payment_attempts"("id");
ALTER TABLE "webhook_events" ADD COLUMN "provider_occurred_at" timestamp with time zone;
ALTER TABLE "webhook_events" ADD COLUMN "receipt_sequence" bigserial;
ALTER TABLE "webhook_events" ADD COLUMN "payload_digest" text;
ALTER TABLE "webhook_events" ADD COLUMN "processing_result" text NOT NULL DEFAULT 'RECEIVED';
ALTER TABLE "webhook_events" ADD COLUMN "processing_reason" text;
ALTER TABLE "webhook_events" ADD COLUMN "processed_at" timestamp with time zone;
UPDATE "webhook_events" SET "payload_digest" = encode(digest("payload"::text, 'sha256'), 'hex') WHERE "payload_digest" IS NULL;
ALTER TABLE "webhook_events" ALTER COLUMN "payload_digest" SET NOT NULL;
ALTER TABLE "webhook_events" ALTER COLUMN "receipt_sequence" SET NOT NULL;
--> statement-breakpoint
CREATE TABLE "payment_state_transitions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "journey_id" uuid NOT NULL REFERENCES "payment_journeys"("id"),
  "webhook_event_id" uuid REFERENCES "webhook_events"("id"),
  "previous_state" "journey_state" NOT NULL,
  "next_state" "journey_state" NOT NULL,
  "accepted" boolean NOT NULL,
  "reason" text NOT NULL,
  "occurred_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incidents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "source" text NOT NULL,
  "status" text NOT NULL DEFAULT 'OPEN',
  "cohort_key" text NOT NULL,
  "affected_segment" jsonb NOT NULL,
  "baseline_window" jsonb NOT NULL,
  "current_window" jsonb NOT NULL,
  "excess_failure_contribution" bigint NOT NULL,
  "confidence" text NOT NULL,
  "downtime_evidence" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "configuration_snapshot" jsonb NOT NULL,
  "opened_at" timestamp with time zone DEFAULT now() NOT NULL,
  "closed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "recovery_decisions" ADD COLUMN "policy_feature_schema" text;
ALTER TABLE "recovery_decisions" ADD COLUMN "candidate_actions" jsonb;
ALTER TABLE "recovery_decisions" ADD COLUMN "policy_estimates" jsonb;
ALTER TABLE "recovery_decisions" ADD COLUMN "decision_reason" text;
ALTER TABLE "recovery_decisions" ADD CONSTRAINT "recovery_decisions_journey_id_fk" FOREIGN KEY ("journey_id") REFERENCES "payment_journeys"("id");
ALTER TABLE "recovery_tokens" ADD COLUMN "token_digest" text;
UPDATE "recovery_tokens" SET "token_digest" = encode(digest("token", 'sha256'), 'hex') WHERE "token_digest" IS NULL;
ALTER TABLE "recovery_tokens" ALTER COLUMN "token_digest" SET NOT NULL;
ALTER TABLE "recovery_tokens" ADD CONSTRAINT "recovery_tokens_token_digest_unique" UNIQUE ("token_digest");
ALTER TABLE "recovery_tokens" ADD CONSTRAINT "recovery_tokens_journey_id_fk" FOREIGN KEY ("journey_id") REFERENCES "payment_journeys"("id");
ALTER TABLE "recovery_tokens" ADD CONSTRAINT "recovery_tokens_decision_id_fk" FOREIGN KEY ("decision_id") REFERENCES "recovery_decisions"("id");
ALTER TABLE "recovery_tokens" DROP CONSTRAINT "recovery_tokens_token_unique";
ALTER TABLE "recovery_tokens" DROP COLUMN "token";
--> statement-breakpoint
ALTER TABLE "recovery_workflows" ADD COLUMN "decision_id" uuid REFERENCES "recovery_decisions"("id");
ALTER TABLE "recovery_workflows" ADD COLUMN "customer_token_digest" text;
ALTER TABLE "recovery_workflows" ADD COLUMN "external_resource_id" text;
ALTER TABLE "recovery_workflows" ADD COLUMN "attempt_count" bigint NOT NULL DEFAULT 0;
ALTER TABLE "recovery_workflows" ADD CONSTRAINT "recovery_workflows_journey_id_fk" FOREIGN KEY ("journey_id") REFERENCES "payment_journeys"("id");
ALTER TABLE "recovery_outcomes" ADD COLUMN "decision_id" uuid REFERENCES "recovery_decisions"("id");
ALTER TABLE "recovery_outcomes" ADD COLUMN "webhook_event_id" uuid REFERENCES "webhook_events"("id");
ALTER TABLE "recovery_outcomes" ADD CONSTRAINT "recovery_outcomes_journey_id_fk" FOREIGN KEY ("journey_id") REFERENCES "payment_journeys"("id");
--> statement-breakpoint
ALTER TABLE "benchmark_runs" ADD COLUMN "policy_version" text NOT NULL DEFAULT 'recovery-v1';
ALTER TABLE "benchmark_runs" ADD COLUMN "dataset_split" text NOT NULL DEFAULT 'HELD_OUT';
ALTER TABLE "benchmark_runs" ADD COLUMN "configuration_snapshot" jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE "bandit_states" ADD COLUMN "feature_schema" text NOT NULL DEFAULT 'recovery-v1';
ALTER TABLE "bandit_states" ADD COLUMN "action_schema" jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE "bandit_training_interactions" ADD CONSTRAINT "bandit_training_interactions_policy_version_fk" FOREIGN KEY ("policy_version") REFERENCES "bandit_states"("version");
--> statement-breakpoint
ALTER TABLE "audit_entries" ADD COLUMN "actor" text NOT NULL DEFAULT 'SYSTEM';
ALTER TABLE "audit_entries" ADD COLUMN "journey_id" uuid REFERENCES "payment_journeys"("id");
ALTER TABLE "audit_entries" ADD COLUMN "webhook_event_id" uuid REFERENCES "webhook_events"("id");
ALTER TABLE "audit_entries" ADD COLUMN "decision_id" uuid REFERENCES "recovery_decisions"("id");
ALTER TABLE "audit_entries" ADD COLUMN "outcome_id" uuid REFERENCES "recovery_outcomes"("id");
ALTER TABLE "audit_entries" ADD COLUMN "action" text;
ALTER TABLE "audit_entries" ADD COLUMN "reason" text;
ALTER TABLE "audit_entries" ADD COLUMN "previous_state" text;
ALTER TABLE "audit_entries" ADD COLUMN "next_state" text;
CREATE OR REPLACE FUNCTION prevent_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'audit_entries are append-only'; END; $$;
CREATE TRIGGER audit_entries_no_update BEFORE UPDATE ON "audit_entries" FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();
CREATE TRIGGER audit_entries_no_delete BEFORE DELETE ON "audit_entries" FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();
