import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createDatabase } from "@/db/client";
import { banditStates } from "@/db/schema";
import { restoreBanditState } from "@/lib/recovery/bandit-persistence";
import { rankLinUcbActions } from "@/lib/recovery/linucb";
import { encodeRecoveryContext } from "@/lib/recovery/policy-context";
import { evaluateRecoveryAction, recoveryActions } from "@/lib/recovery/safety-policy";
import { requireOperator } from "@/lib/auth/session";
export async function GET(){const unauthorized=await requireOperator();if(unauthorized)return unauthorized;try{const [stored]=await createDatabase().select().from(banditStates).orderBy(desc(banditStates.updatedAt)).limit(1);if(!stored)return NextResponse.json({ready:false,reason:"Warm start has not run."});const state=restoreBanditState(JSON.stringify(stored.state));const context={amount:10000,attemptNumber:1,minutesSinceFailure:45,hourOfDay:14,method:"UPI",provider:"HDFC",errorCode:"TIMEOUT",device:"ANDROID",activeIncident:true,downtimeSeverity:2 as const};const safety={journeyState:"RETRY_ELIGIBLE" as const,outstandingAmount:10000,automatedRecoveryActions:0,maxAutomatedRecoveryActions:2,hardDeclineDetected:false,hasConflictingFinancialState:false,lateAuthorizationGracePeriodActive:false};const allowed=recoveryActions.filter(action=>evaluateRecoveryAction(safety,action).allowed);const rankings=rankLinUcbActions(state,encodeRecoveryContext(context),allowed,10000);return NextResponse.json({ready:true,version:stored.version,rankings});}catch(error){return NextResponse.json({ready:false,reason:error instanceof Error?error.message:"Policy unavailable."},{status:500});}}
