import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url().optional(),
  RAZORPAY_KEY_ID: z.string().min(1).optional(),
  RAZORPAY_KEY_SECRET: z.string().min(1).optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().min(1).optional(),
  QSTASH_TOKEN: z.string().min(1).optional(),
  GEMINI_API_KEY: z.string().min(1).optional(),
});

export const env = schema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET,
  QSTASH_TOKEN: process.env.QSTASH_TOKEN,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
});
