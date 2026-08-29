CREATE TYPE "public"."journey_state" AS ENUM('CREATED', 'ATTEMPTED', 'FAILED_PENDING_VERIFICATION', 'RETRY_ELIGIBLE', 'AUTHORIZED', 'CAPTURED', 'HARD_DECLINED', 'EXPIRED', 'CANCELLED', 'MANUAL_REVIEW');--> statement-breakpoint
CREATE TABLE "payment_journeys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"razorpay_order_id" text,
	"state" "journey_state" DEFAULT 'CREATED' NOT NULL,
	"outstanding_amount" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_journeys_razorpay_order_id_unique" UNIQUE("razorpay_order_id")
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"razorpay_event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "webhook_events_razorpay_event_id_unique" UNIQUE("razorpay_event_id")
);
