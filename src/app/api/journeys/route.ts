import { and, asc, desc, eq, gt, gte, ilike, inArray, lte, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createDatabase } from "@/db/client";
import { paymentJourneys, recoveryOutcomes, recoveryWorkflows } from "@/db/schema";
import { requireOperator } from "@/lib/auth/session";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(10).max(100).default(25),
  query: z.string().trim().max(220).optional(), state: z.string().trim().max(80).optional(), provider: z.string().trim().max(120).optional(), method: z.string().trim().max(80).optional(), device: z.string().trim().max(80).optional(), workflow: z.string().trim().max(80).optional(), outcome: z.string().trim().max(80).optional(),
  balance: z.enum(["open", "settled"]).optional(), minimum: z.coerce.number().int().min(0).optional(), maximum: z.coerce.number().int().min(0).optional(), from: z.coerce.date().optional(), to: z.coerce.date().optional(), sort: z.enum(["recent", "oldest", "outstanding-high", "outstanding-low"]).default("recent"),
});

export async function GET(request: Request) {
  const unauthorized = await requireOperator(); if (unauthorized) return unauthorized;
  try {
    const input = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const database = createDatabase();
    const latestWorkflowStatus = sql<string | null>`(select ${recoveryWorkflows.status} from ${recoveryWorkflows} where ${recoveryWorkflows.journeyId} = ${paymentJourneys.id} order by ${recoveryWorkflows.updatedAt} desc limit 1)`;
    const latestOutcomeCategory = sql<string | null>`(select ${recoveryOutcomes.category} from ${recoveryOutcomes} where ${recoveryOutcomes.journeyId} = ${paymentJourneys.id} order by ${recoveryOutcomes.createdAt} desc limit 1)`;
    const search = input.query ? `%${input.query.replace(/[\\%_]/g, "\\$&")}%` : undefined;
    const conditions = [
      input.state ? eq(paymentJourneys.state, input.state as typeof paymentJourneys.state._.data) : undefined,
      input.provider ? eq(paymentJourneys.provider, input.provider) : undefined, input.method ? eq(paymentJourneys.paymentMethod, input.method) : undefined, input.device ? eq(paymentJourneys.deviceCategory, input.device) : undefined,
      input.workflow ? eq(latestWorkflowStatus, input.workflow) : undefined, input.outcome ? eq(latestOutcomeCategory, input.outcome) : undefined,
      input.balance === "open" ? gt(paymentJourneys.outstandingAmount, 0) : undefined, input.balance === "settled" ? eq(paymentJourneys.outstandingAmount, 0) : undefined,
      input.minimum !== undefined ? gte(paymentJourneys.outstandingAmount, input.minimum) : undefined, input.maximum !== undefined ? lte(paymentJourneys.outstandingAmount, input.maximum) : undefined,
      input.from ? gte(paymentJourneys.updatedAt, input.from) : undefined, input.to ? lte(paymentJourneys.updatedAt, endOfDay(input.to)) : undefined,
      search ? or(ilike(sql<string>`cast(${paymentJourneys.id} as text)`, search), ilike(paymentJourneys.razorpayOrderId, search), ilike(sql<string>`cast(${paymentJourneys.state} as text)`, search), ilike(paymentJourneys.provider, search), ilike(paymentJourneys.paymentMethod, search), ilike(paymentJourneys.deviceCategory, search), ilike(latestWorkflowStatus, search), ilike(latestOutcomeCategory, search)) : undefined,
    ];
    const where = and(...conditions);
    const ordering = input.sort === "oldest" ? [asc(paymentJourneys.updatedAt), asc(paymentJourneys.id)] : input.sort === "outstanding-high" ? [desc(paymentJourneys.outstandingAmount), desc(paymentJourneys.updatedAt)] : input.sort === "outstanding-low" ? [asc(paymentJourneys.outstandingAmount), desc(paymentJourneys.updatedAt)] : [desc(paymentJourneys.updatedAt), desc(paymentJourneys.id)];
    const [rows, totals, facets] = await Promise.all([
      database.select({ id: paymentJourneys.id, orderId: paymentJourneys.razorpayOrderId, state: paymentJourneys.state, outstandingAmount: paymentJourneys.outstandingAmount, provider: paymentJourneys.provider, method: paymentJourneys.paymentMethod, device: paymentJourneys.deviceCategory, updatedAt: paymentJourneys.updatedAt, workflowStatus: latestWorkflowStatus.as("workflow_status"), outcomeCategory: latestOutcomeCategory.as("outcome_category") }).from(paymentJourneys).where(where).orderBy(...ordering).limit(input.pageSize).offset((input.page - 1) * input.pageSize),
      database.select({ count: sql<number>`count(*)` }).from(paymentJourneys).where(where), getFacets(database),
    ]);
    const journeyIds = rows.map(row => row.id);
    const workflowRows = journeyIds.length ? await database.select({ journeyId: recoveryWorkflows.journeyId, status: recoveryWorkflows.status }).from(recoveryWorkflows).where(inArray(recoveryWorkflows.journeyId, journeyIds)).orderBy(desc(recoveryWorkflows.updatedAt)) : [];
    const outcomeRows = journeyIds.length ? await database.select({ journeyId: recoveryOutcomes.journeyId, category: recoveryOutcomes.category }).from(recoveryOutcomes).where(inArray(recoveryOutcomes.journeyId, journeyIds)).orderBy(desc(recoveryOutcomes.createdAt)) : [];
    const workflowStatusByJourney = new Map<string, string>(); for (const workflow of workflowRows) if (!workflowStatusByJourney.has(workflow.journeyId)) workflowStatusByJourney.set(workflow.journeyId, workflow.status);
    const outcomeCategoryByJourney = new Map<string, string>(); for (const outcome of outcomeRows) if (!outcomeCategoryByJourney.has(outcome.journeyId)) outcomeCategoryByJourney.set(outcome.journeyId, outcome.category);
    const journeys = rows.map(row => ({ ...row, workflowStatus: workflowStatusByJourney.get(row.id) ?? null, outcomeCategory: outcomeCategoryByJourney.get(row.id) ?? null }));
    const total = Number(totals[0]?.count ?? 0); const totalPages = Math.max(1, Math.ceil(total / input.pageSize));
    return NextResponse.json({ journeys, pagination: { page: Math.min(input.page, totalPages), pageSize: input.pageSize, total, totalPages }, facets });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "One or more journey filters are invalid." }, { status: 400 });
    console.error("Journeys query failed", { message: error instanceof Error ? error.message : "Unknown error" });
    return NextResponse.json({ error: "Payment journeys are temporarily unavailable because the database cannot be reached." }, { status: 503 });
  }
}

function endOfDay(value: Date) { const result = new Date(value); result.setHours(23, 59, 59, 999); return result; }
async function getFacets(database: ReturnType<typeof createDatabase>) {
  const [states, providers, methods, devices, workflows, outcomes] = await Promise.all([
    database.selectDistinct({ value: paymentJourneys.state }).from(paymentJourneys), database.selectDistinct({ value: paymentJourneys.provider }).from(paymentJourneys), database.selectDistinct({ value: paymentJourneys.paymentMethod }).from(paymentJourneys), database.selectDistinct({ value: paymentJourneys.deviceCategory }).from(paymentJourneys), database.selectDistinct({ value: recoveryWorkflows.status }).from(recoveryWorkflows), database.selectDistinct({ value: recoveryOutcomes.category }).from(recoveryOutcomes),
  ]);
  const values = (rows: Array<{ value: string | null }>) => rows.flatMap(row => row.value ? [row.value] : []).sort((a, b) => a.localeCompare(b));
  return { state: values(states), provider: values(providers), method: values(methods), device: values(devices), workflow: values(workflows), outcome: values(outcomes) };
}
