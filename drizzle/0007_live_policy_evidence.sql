ALTER TABLE "recovery_decisions" ADD COLUMN "policy_version" text;
--> statement-breakpoint
ALTER TABLE "recovery_decisions" ADD COLUMN "policy_context" jsonb;
--> statement-breakpoint
ALTER TABLE "recovery_tokens" ADD COLUMN "decision_id" uuid;
