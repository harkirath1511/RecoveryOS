import { Client } from "@upstash/qstash";
import { env } from "@/lib/env";

export type VerificationJob = { journeyId: string; expectedState: "FAILED_PENDING_VERIFICATION"; runAt: Date };

export async function scheduleVerification(job: VerificationJob, destination: string): Promise<{ scheduled: boolean; reason?: string }> {
  if (!env.QSTASH_TOKEN) return { scheduled: false, reason: "QSTASH_TOKEN is not configured." };
  const client = new Client({ token: env.QSTASH_TOKEN });
  await client.publishJSON({ url: destination, body: job, delay: Math.max(0, Math.ceil((job.runAt.getTime() - Date.now()) / 1000)) });
  return { scheduled: true };
}
