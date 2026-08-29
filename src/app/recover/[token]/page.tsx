import { and, eq, gt, isNull } from "drizzle-orm";
import { notFound } from "next/navigation";
import { createDatabase } from "@/db/client";
import { recoveryTokens } from "@/db/schema";
import { isRecoveryTokenUsable } from "@/lib/recovery/token-lifecycle";

export default async function RecoveryPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const database = createDatabase();
  const [recovery] = await database.select().from(recoveryTokens).where(and(eq(recoveryTokens.token, token), gt(recoveryTokens.expiresAt, new Date()), isNull(recoveryTokens.usedAt))).limit(1);
  if (!recovery) notFound();
  if(!isRecoveryTokenUsable(recovery)) notFound();
  const [claimed] = await database.update(recoveryTokens).set({ usedAt: new Date() }).where(and(eq(recoveryTokens.id, recovery.id), gt(recoveryTokens.expiresAt, new Date()), isNull(recoveryTokens.usedAt))).returning({ paymentLinkUrl: recoveryTokens.paymentLinkUrl });
  if (!claimed) notFound();
  return <main className="shell"><p className="eyebrow">RecoveryOS / secure recovery</p><h1>Complete your payment securely.</h1><p className="lede">This one-time recovery page was created after a verified payment issue. No payment is attempted automatically.</p><a className="recovery-button" href={claimed.paymentLinkUrl}>Continue to secure payment</a></main>;
}
