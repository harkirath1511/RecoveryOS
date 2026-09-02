import { drizzle } from "drizzle-orm/neon-serverless";
import { neonConfig, Pool } from "@neondatabase/serverless";
import ws from "ws";
import { env } from "@/lib/env";

neonConfig.webSocketConstructor = ws;

let client: Pool | undefined;

export function createDatabase() {
  if (!env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.");
  // Use Neon's WebSocket transport rather than direct PostgreSQL TCP. It keeps
  // interactive transactions intact while avoiding local-network port 5432
  // failures that previously stalled the dashboard and scenario runner.
  if (!client) {
    const pool = new Pool({
      connectionString: env.DATABASE_URL,
      max: 5,
      // Do not retain an idle WebSocket indefinitely. Neon can close it while
      // Next's development process remains alive, leaving every later request
      // on a terminated connection.
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: env.DATABASE_CONNECT_TIMEOUT_SECONDS * 1_000,
    });
    pool.on("error", () => {
      // A later request receives a fresh pool. The failing request still
      // returns its normal unavailable response instead of poisoning the app.
      if (client === pool) client = undefined;
      void pool.end().catch(() => undefined);
    });
    client = pool;
  }
  return drizzle({ client });
}
