import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";

export function createDatabase() {
  if (!env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.");
  return drizzle(postgres(env.DATABASE_URL, { prepare: false }));
}
