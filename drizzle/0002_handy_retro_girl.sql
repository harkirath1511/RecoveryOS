CREATE TABLE "audit_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"event_type" text NOT NULL,
	"evidence" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bandit_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" text NOT NULL,
	"feature_count" bigint NOT NULL,
	"state" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bandit_states_version_unique" UNIQUE("version")
);
--> statement-breakpoint
CREATE TABLE "recovery_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"journey_id" uuid NOT NULL,
	"action" text NOT NULL,
	"policy" text NOT NULL,
	"predicted_success" text,
	"expected_recovery_amount" bigint NOT NULL,
	"safety" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
