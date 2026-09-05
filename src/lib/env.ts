import { z } from "zod";

function unquoteEnvironmentValue(value: string | undefined) {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.length < 2) return trimmed;
  const first = trimmed[0]; const last = trimmed.at(-1);
  const unquoted = (first === "'" || first === '"') && first === last ? trimmed.slice(1, -1) : trimmed;
  return unquoted.trim() || undefined;
}

const schema = z.object({
  DATABASE_URL: z.string().url().optional(),
  APP_BASE_URL: z.string().url().optional(),
  DATABASE_CONNECT_TIMEOUT_SECONDS: z.coerce.number().int().min(1).max(30).default(15),
  RAZORPAY_KEY_ID: z.string().min(1).optional(),
  RAZORPAY_KEY_SECRET: z.string().min(1).optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().min(1).optional(),
  QSTASH_TOKEN: z.string().min(1).optional(),
  QSTASH_URL: z.string().url().optional(),
  QSTASH_CURRENT_SIGNING_KEY: z.string().min(1).optional(),
  QSTASH_NEXT_SIGNING_KEY: z.string().min(1).optional(),
  RECOVERY_GRACE_PERIOD_SECONDS: z.coerce.number().int().min(30).max(86_400).default(180),
  MAX_AUTOMATED_RECOVERY_ACTIONS: z.coerce.number().int().min(1).max(10).default(2),
  RECOVERY_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(604_800).default(86_400),
  LINUCB_ALPHA: z.coerce.number().min(0).max(5).default(0.2),
  AUTONOMOUS_RECOVERY_ENABLED: z.enum(["true", "false"]).default("false"),
  RISK_NO_INTERVENTION_PROBABILITY: z.coerce.number().min(0).max(1).default(0.05),
  RISK_INTERVENTION_COST_PAISE: z.coerce.number().int().min(0).max(100_000).default(0),
  GROQ_API_KEY: z.string().min(1).optional(),
  GROQ_MODEL: z.string().min(1).default("openai/gpt-oss-20b"),
});

export const env = schema.parse({
  DATABASE_URL: unquoteEnvironmentValue(process.env.DATABASE_URL),
  APP_BASE_URL: unquoteEnvironmentValue(process.env.APP_BASE_URL),
  DATABASE_CONNECT_TIMEOUT_SECONDS: unquoteEnvironmentValue(process.env.DATABASE_CONNECT_TIMEOUT_SECONDS),
  RAZORPAY_KEY_ID: unquoteEnvironmentValue(process.env.RAZORPAY_KEY_ID),
  RAZORPAY_KEY_SECRET: unquoteEnvironmentValue(process.env.RAZORPAY_KEY_SECRET),
  RAZORPAY_WEBHOOK_SECRET: unquoteEnvironmentValue(process.env.RAZORPAY_WEBHOOK_SECRET),
  QSTASH_TOKEN: unquoteEnvironmentValue(process.env.QSTASH_TOKEN),
  QSTASH_URL: unquoteEnvironmentValue(process.env.QSTASH_URL),
  QSTASH_CURRENT_SIGNING_KEY: unquoteEnvironmentValue(process.env.QSTASH_CURRENT_SIGNING_KEY),
  QSTASH_NEXT_SIGNING_KEY: unquoteEnvironmentValue(process.env.QSTASH_NEXT_SIGNING_KEY),
  RECOVERY_GRACE_PERIOD_SECONDS: unquoteEnvironmentValue(process.env.RECOVERY_GRACE_PERIOD_SECONDS),
  MAX_AUTOMATED_RECOVERY_ACTIONS: unquoteEnvironmentValue(process.env.MAX_AUTOMATED_RECOVERY_ACTIONS),
  RECOVERY_TOKEN_TTL_SECONDS: unquoteEnvironmentValue(process.env.RECOVERY_TOKEN_TTL_SECONDS),
  LINUCB_ALPHA: unquoteEnvironmentValue(process.env.LINUCB_ALPHA),
  AUTONOMOUS_RECOVERY_ENABLED: unquoteEnvironmentValue(process.env.AUTONOMOUS_RECOVERY_ENABLED),
  RISK_NO_INTERVENTION_PROBABILITY: unquoteEnvironmentValue(process.env.RISK_NO_INTERVENTION_PROBABILITY),
  RISK_INTERVENTION_COST_PAISE: unquoteEnvironmentValue(process.env.RISK_INTERVENTION_COST_PAISE),
  GROQ_API_KEY: unquoteEnvironmentValue(process.env.GROQ_API_KEY),
  GROQ_MODEL: unquoteEnvironmentValue(process.env.GROQ_MODEL),
});
