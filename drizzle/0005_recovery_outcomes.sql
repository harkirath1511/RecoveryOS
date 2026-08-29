ALTER TABLE "recovery_tokens" ADD COLUMN "journey_id" uuid;
--> statement-breakpoint
ALTER TABLE "recovery_tokens" ADD COLUMN "payment_link_id" text;
--> statement-breakpoint
ALTER TABLE "recovery_tokens" ADD CONSTRAINT "recovery_tokens_payment_link_id_unique" UNIQUE("payment_link_id");
--> statement-breakpoint
CREATE TABLE "recovery_outcomes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"journey_id" uuid NOT NULL,
	"category" text NOT NULL,
	"captured_amount" bigint NOT NULL,
	"expected_recovery_amount" bigint NOT NULL,
	"policy_reward" bigint NOT NULL,
	"evidence" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recovery_outcomes_journey_id_unique" UNIQUE("journey_id")
);
