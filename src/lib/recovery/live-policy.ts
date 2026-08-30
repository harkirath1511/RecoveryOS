import { desc } from "drizzle-orm";
import type { createDatabase } from "@/db/client";
import { banditStates } from "@/db/schema";
import { restoreBanditState } from "./bandit-persistence";
import { rankLinUcbActions, type RankedRecoveryAction } from "./linucb";
import { encodeRecoveryContext, type RecoveryPolicyContext } from "./policy-context";
import type { RecoveryAction } from "./safety-policy";
import { env } from "@/lib/env";

type Database = ReturnType<typeof createDatabase>;

export type LivePolicySelection = {
  version: string;
  context: RecoveryPolicyContext;
  ranking: RankedRecoveryAction;
  rankings: RankedRecoveryAction[];
};

export async function selectLiveRecoveryAction(
  database: Database,
  context: RecoveryPolicyContext,
  allowedActions: readonly RecoveryAction[],
  outstandingAmount: number,
): Promise<LivePolicySelection | null> {
  const [stored] = await database.select().from(banditStates).orderBy(desc(banditStates.updatedAt)).limit(1);
  if (!stored) return null;

  const rankings = rankLinUcbActions(
    restoreBanditState(JSON.stringify(stored.state)),
    encodeRecoveryContext(context),
    allowedActions,
    outstandingAmount,
    env.LINUCB_ALPHA,
  );
  if (!rankings[0]) throw new Error("The persisted policy has no model for any safety-permitted action.");
  return { version: stored.version, context, ranking: rankings[0], rankings };
}
