import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOperator } from "@/lib/auth/session";
import { createDatabase } from "@/db/client";
import { scenarioRuns } from "@/db/schema";
import { defaultSimulationConfig, simulatePaymentEvents } from "@/lib/recovery/simulator";

const requestSchema = z.object({
  seed: z.number().int().optional(),
  delayedAuthorizationMs: z.number().int().min(0).max(86_400_000).default(0),
  duplicateEventRate: z.number().min(0).max(1).default(0),
  outOfOrderEventRate: z.number().min(0).max(1).default(0),
});

/** Scenario events are isolated from live payment tables and persist their exact replay configuration. */
export async function POST(request: Request) {
  const unauthorized = await requireOperator();
  if (unauthorized) return unauthorized;
  const input = requestSchema.parse(await request.json());
  const config = {
    ...defaultSimulationConfig,
    seed: input.seed ?? defaultSimulationConfig.seed,
    virtualTime: {
      delayedAuthorizationMs: input.delayedAuthorizationMs,
      duplicateEventRate: input.duplicateEventRate,
      outOfOrderEventRate: input.outOfOrderEventRate,
    },
  };
  const configurationHash = createHash("sha256").update(JSON.stringify(config)).digest("hex");
  const events = simulatePaymentEvents(config);
  const virtualStartedAt = new Date(Math.min(...events.map((event) => event.occurredAt)));
  const virtualEndedAt = new Date(Math.max(...events.map((event) => event.deliveredAt)));
  const [run] = await createDatabase().insert(scenarioRuns).values({
    seed: config.seed,
    configurationHash,
    configurationSnapshot: config,
    virtualStartedAt,
    virtualEndedAt,
    result: {
      eventCount: events.length,
      delayedAuthorizations: events.filter((event) => event.type === "PAYMENT_AUTHORIZED").length,
      duplicateEvents: events.filter((event) => event.duplicate).length,
      outOfOrderDeliveries: events.filter((event) => event.deliveredAt < event.occurredAt).length,
    },
  }).returning();
  return NextResponse.json({ scenarioRun: run, events });
}
