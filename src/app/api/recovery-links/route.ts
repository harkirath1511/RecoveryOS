import { NextResponse } from "next/server";
import { z } from "zod";
import { createExactAmountTestLink } from "@/lib/razorpay/client";
import { evaluateRecoveryAction } from "@/lib/recovery/safety-policy";
import { createDatabase } from "@/db/client";
import { recoveryTokens } from "@/db/schema";
import { randomBytes } from "node:crypto";
import { requireOperator } from "@/lib/auth/session";

const requestSchema = z.object({ journeyState: z.enum(["RETRY_ELIGIBLE", "FAILED_PENDING_VERIFICATION"]), outstandingAmount: z.number().int().positive(), automatedRecoveryActions: z.number().int().min(0).max(2), customer: z.object({ name: z.string().min(1).optional(), email: z.string().email().optional(), contact: z.string().min(8).optional() }), referenceId: z.string().min(1).max(40) });

export async function POST(request: Request) {
  try {
    const unauthorized=await requireOperator(); if(unauthorized)return unauthorized;
    const input = requestSchema.parse(await request.json());
    const safety = evaluateRecoveryAction({ ...input, maxAutomatedRecoveryActions: 2, hardDeclineDetected: false, hasConflictingFinancialState: false, lateAuthorizationGracePeriodActive: false }, "CREATE_PAYMENT_LINK");
    if (!safety.allowed) return NextResponse.json({ created: false, safety }, { status: 409 });
    const link = await createExactAmountTestLink({ amount: input.outstandingAmount, referenceId: input.referenceId, description: "RecoveryOS Test Mode recovery", customer: input.customer });
    const token = randomBytes(24).toString("base64url");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await createDatabase().insert(recoveryTokens).values({ token, paymentLinkUrl: link.short_url, expiresAt });
    const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";
    return NextResponse.json({ created: true, recoveryUrl: `${baseUrl}/recover/${token}`, id: link.id, expiresAt, safety });
  } catch (error) { return NextResponse.json({ created: false, error: error instanceof Error ? error.message : "Recovery link rejected" }, { status: 400 }); }
}
