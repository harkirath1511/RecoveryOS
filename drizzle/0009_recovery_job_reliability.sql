ALTER TABLE "recovery_workflows" ADD COLUMN "idempotency_key" text;
ALTER TABLE "recovery_workflows" ADD COLUMN "qstash_message_id" text;
ALTER TABLE "recovery_workflows" ADD COLUMN "cancelled_at" timestamp with time zone;
ALTER TABLE "recovery_workflows" ADD CONSTRAINT "recovery_workflows_idempotency_key_unique" UNIQUE ("idempotency_key");
CREATE UNIQUE INDEX "recovery_workflows_one_pending_verification" ON "recovery_workflows" ("journey_id", "action") WHERE "action" = 'WAIT_AND_VERIFY' AND "status" = 'PENDING';
