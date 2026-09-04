import { createHash } from "node:crypto";
import { Client } from "@upstash/qstash";
import { env } from "@/lib/env";

export type VerificationJob = { journeyId: string; workflowId: string; idempotencyKey: string; expectedState: "FAILED_PENDING_VERIFICATION"; runAt: Date };

export function qstashDeduplicationId(idempotencyKey: string) {
  return createHash("sha256").update(idempotencyKey).digest("hex");
}

export async function scheduleVerification(job: VerificationJob, destination: string): Promise<{ scheduled: boolean; messageId?: string; reason?: string }> {
  if (!env.QSTASH_TOKEN) return { scheduled: false, reason: "QSTASH_TOKEN is not configured." };
  if (!destination.startsWith("https://")) return { scheduled: false, reason: "APP_BASE_URL must be an HTTPS callback URL." };
  const client = new Client({ token: env.QSTASH_TOKEN, baseUrl: env.QSTASH_URL });
  const published = await client.publishJSON({ url: destination, body: job, delay: Math.max(0, Math.ceil((job.runAt.getTime() - Date.now()) / 1000)), deduplicationId: qstashDeduplicationId(job.idempotencyKey) });
  return { scheduled: true, messageId: published.messageId };
}

export async function cancelVerification(messageId: string | null | undefined): Promise<boolean> {
  if (!messageId || !env.QSTASH_TOKEN) return false;
  const result = await new Client({ token: env.QSTASH_TOKEN }).messages.cancel(messageId);
  return result.cancelled > 0;
}
