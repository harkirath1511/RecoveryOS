CREATE TABLE "bandit_training_interactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"policy_version" text NOT NULL,
	"seed" bigint NOT NULL,
	"context" jsonb NOT NULL,
	"action" text NOT NULL,
	"direct_recovery" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
