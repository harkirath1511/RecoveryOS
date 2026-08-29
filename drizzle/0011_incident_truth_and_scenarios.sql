ALTER TABLE "incidents" ADD COLUMN IF NOT EXISTS "dedupe_key" text;
ALTER TABLE "incidents" ADD COLUMN IF NOT EXISTS "calibration" jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE "incidents" ADD COLUMN IF NOT EXISTS "risk_assumptions" jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE UNIQUE INDEX IF NOT EXISTS "incidents_open_dedupe_key_unique" ON "incidents" ("dedupe_key") WHERE "status" = 'OPEN';

CREATE TABLE IF NOT EXISTS "downtime_signals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "provider" text,
  "method" text,
  "status" text NOT NULL DEFAULT 'ACTIVE',
  "source" text NOT NULL,
  "observed_at" timestamptz NOT NULL,
  "resolved_at" timestamptz,
  "evidence" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "downtime_signals_active_lookup" ON "downtime_signals" ("status", "provider", "method", "observed_at");

CREATE TABLE IF NOT EXISTS "scenario_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "seed" bigint NOT NULL,
  "configuration_hash" text NOT NULL,
  "configuration_snapshot" jsonb NOT NULL,
  "virtual_started_at" timestamptz NOT NULL,
  "virtual_ended_at" timestamptz NOT NULL,
  "result" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "scenario_runs_configuration_hash_idx" ON "scenario_runs" ("configuration_hash");
