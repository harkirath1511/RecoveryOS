import { and, eq, gt, isNull } from "drizzle-orm";
import { notFound } from "next/navigation";
import { createDatabase } from "@/db/client";
import { paymentJourneys, recoveryTokens } from "@/db/schema";
import { isRecoveryTokenUsable } from "@/lib/recovery/token-lifecycle";

export default async function RecoveryPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const database = createDatabase();
  const [recovery] = await database.select().from(recoveryTokens).where(eq(recoveryTokens.token, token)).limit(1);
  if (!recovery) notFound();
  const [journey] = recovery.journeyId ? await database.select().from(paymentJourneys).where(eq(paymentJourneys.id, recovery.journeyId)).limit(1) : [];
  if (journey?.state === "CAPTURED") return <RecoveryStatus title="Payment already completed" message="This recovery journey has a provider-verified capture. No further payment is needed." />;
  if (recovery.expiresAt <= new Date()) return <RecoveryStatus title="Recovery link expired" message="This approved recovery link is no longer available. Contact the merchant for a new option." />;
  if (recovery.usedAt) return <RecoveryStatus title="Recovery page unavailable" message="This one-time recovery page has already been opened. No payment is attempted automatically." />;
  if(!isRecoveryTokenUsable(recovery)) notFound();
  const [claimed] = await database.update(recoveryTokens).set({ usedAt: new Date() }).where(and(eq(recoveryTokens.id, recovery.id), gt(recoveryTokens.expiresAt, new Date()), isNull(recoveryTokens.usedAt))).returning({ paymentLinkUrl: recoveryTokens.paymentLinkUrl });
  if (!claimed) notFound();
  return <main className="shell"><p className="eyebrow">RecoveryOS / secure recovery</p><h1>Complete your payment securely.</h1><p className="lede">This one-time recovery page was created after a verified payment issue. No payment is attempted automatically.</p>{journey && <p className="panel-footnote">Merchant reference: {journey.razorpayOrderId ?? "Approved Test Mode recovery"} · Outstanding amount: ₹{(journey.outstandingAmount / 100).toFixed(2)}</p>}<a className="recovery-button" href={claimed.paymentLinkUrl}>Continue to secure payment</a></main>;
}

function RecoveryStatus({ title, message }: { title: string; message: string }) { return <main className="shell"><p className="eyebrow">RecoveryOS / secure recovery</p><h1>{title}</h1><p className="lede">{message}</p></main>; }
