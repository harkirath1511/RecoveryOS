UPDATE "recovery_outcomes" SET "category" = 'NOT_RECOVERED' WHERE "category" = 'NO_CAPTURE';
ALTER TABLE "recovery_outcomes" DROP CONSTRAINT IF EXISTS "recovery_outcomes_journey_id_unique";
ALTER TABLE "recovery_outcomes" ADD COLUMN IF NOT EXISTS "workflow_id" uuid REFERENCES "recovery_workflows"("id");
ALTER TABLE "recovery_outcomes" ADD COLUMN IF NOT EXISTS "outcome_key" text;
CREATE UNIQUE INDEX IF NOT EXISTS "recovery_outcomes_outcome_key_unique" ON "recovery_outcomes" ("outcome_key") WHERE "outcome_key" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "recovery_outcomes_journey_idx" ON "recovery_outcomes" ("journey_id", "created_at");
