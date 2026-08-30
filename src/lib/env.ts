import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url().optional(),
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
  RISK_NO_INTERVENTION_PROBABILITY: z.coerce.number().min(0).max(1).default(0.05),
  RISK_INTERVENTION_COST_PAISE: z.coerce.number().int().min(0).max(100_000).default(0),
  GROQ_API_KEY: z.string().min(1).optional(),
  GROQ_MODEL: z.string().min(1).optional(),
});

export const env = schema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET,
  QSTASH_TOKEN: process.env.QSTASH_TOKEN,
  QSTASH_URL: process.env.QSTASH_URL,
  QSTASH_CURRENT_SIGNING_KEY: process.env.QSTASH_CURRENT_SIGNING_KEY,
  QSTASH_NEXT_SIGNING_KEY: process.env.QSTASH_NEXT_SIGNING_KEY,
  RECOVERY_GRACE_PERIOD_SECONDS: process.env.RECOVERY_GRACE_PERIOD_SECONDS,
  MAX_AUTOMATED_RECOVERY_ACTIONS: process.env.MAX_AUTOMATED_RECOVERY_ACTIONS,
  RECOVERY_TOKEN_TTL_SECONDS: process.env.RECOVERY_TOKEN_TTL_SECONDS,
  LINUCB_ALPHA: process.env.LINUCB_ALPHA,
  RISK_NO_INTERVENTION_PROBABILITY: process.env.RISK_NO_INTERVENTION_PROBABILITY,
  RISK_INTERVENTION_COST_PAISE: process.env.RISK_INTERVENTION_COST_PAISE,
  GROQ_API_KEY: process.env.GROQ_API_KEY,
  GROQ_MODEL: process.env.GROQ_MODEL,
});
