CREATE TABLE "benchmark_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"training_seed" bigint NOT NULL,
	"evaluation_seed" bigint NOT NULL,
	"volume" bigint NOT NULL,
	"reproducibility_key" text NOT NULL,
	"metrics" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
