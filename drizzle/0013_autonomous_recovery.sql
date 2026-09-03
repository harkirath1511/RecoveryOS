ALTER TABLE "recovery_decisions"
  ADD COLUMN IF NOT EXISTS "trigger_source" text NOT NULL DEFAULT 'MANUAL_OPERATOR';
