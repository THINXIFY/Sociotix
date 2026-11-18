import "server-only";
import { eq, sql } from "drizzle-orm";
import { type DatabaseHealth, type Executor, getDb, pingDatabase } from "./db/client";
import { platformSettings } from "./db/schema";
import { getEnv } from "./env";

export interface Health {
  status: "ok" | "degraded";
  checks: { app: "ok"; config: "ok" | "invalid"; database: DatabaseHealth | "skipped" };
  time: string;
}

/** Readiness: the app answers, configuration is valid and the database responds. Exposes no details. */
export async function checkHealth(): Promise<Health> {
  let config: Health["checks"]["config"] = "ok";
  try {
    getEnv();
  } catch {
    config = "invalid";
  }
  const database = config === "ok" ? await pingDatabase() : "skipped";
  return { status: config === "ok" && database === "ok" ? "ok" : "degraded", checks: { app: "ok", config, database }, time: new Date().toISOString() };
}

/* -------------------------------------------------------------------------- */
/*  Worker heartbeat (OPS-01A)                                                */
/* -------------------------------------------------------------------------- */

const HEARTBEAT_KEY = "worker.heartbeat";
/** The worker beats every minute; three missed beats means it is down or stuck. */
export const HEARTBEAT_STALE_MS = 3 * 60_000;

/** Called by the worker once a minute. Stores only a timestamp. */
export async function recordWorkerHeartbeat(db: Executor, now = new Date()) {
  await db
    .insert(platformSettings)
    .values({ key: HEARTBEAT_KEY, value: { at: now.toISOString() }, updatedAt: now })
    .onConflictDoUpdate({ target: platformSettings.key, set: { value: { at: now.toISOString() }, updatedAt: now, version: sql`${platformSettings.version} + 1` } });
}

export type WorkerHealth = "ok" | "stale" | "unknown";

/** "ok" when a worker has beaten recently, "stale" when it stopped, "unknown" when none has ever run or the database is unreachable. */
export async function checkWorker(now = Date.now(), db?: Executor): Promise<WorkerHealth> {
  try {
    // Inside the try: invalid configuration or no database also reads as "unknown", never an error page.
    const [row] = await (db ?? getDb()).select({ updatedAt: platformSettings.updatedAt }).from(platformSettings).where(eq(platformSettings.key, HEARTBEAT_KEY)).limit(1);
    if (!row) return "unknown";
    return now - row.updatedAt.getTime() <= HEARTBEAT_STALE_MS ? "ok" : "stale";
  } catch {
    return "unknown";
  }
}
