/*
 * OPS-02: alert thresholds for `npm run ops:check`, kept pure so they are unit-tested
 * (tests/unit/ops-monitor.test.ts). Thresholds match docs/deployment/MONITORING_RECOVERY.md.
 */

export type Level = "ok" | "warn" | "fail";
export interface Result {
  check: string;
  level: Level;
  detail: string;
}

export const THRESHOLDS = {
  tlsWarnDays: 21,
  tlsFailDays: 14,
  storageWarnPct: 80,
  storageFailPct: 90,
  connectionsWarnPct: 80,
  connectionsFailPct: 95,
} as const;

const pct = (used: number, total: number) => Math.round((used / total) * 100);

/** GET /api/health: must answer 200 with "status":"ok". */
export function gradeWeb(status: number | null, body: unknown): Result {
  const ok = status === 200 && (body as { status?: string } | null)?.status === "ok";
  const checks = (body as { checks?: Record<string, string> } | null)?.checks;
  return { check: "web", level: ok ? "ok" : "fail", detail: status === null ? "unreachable" : `HTTP ${status}${checks ? ` ${JSON.stringify(checks)}` : ""}` };
}

/** GET /api/health/worker: 200 "ok"; 503 "stale" (stopped) or "unknown" (never ran / no database). */
export function gradeWorker(status: number | null, body: unknown): Result {
  const worker = (body as { worker?: string } | null)?.worker ?? "unreachable";
  return { check: "worker", level: status === 200 && worker === "ok" ? "ok" : "fail", detail: worker };
}

export function gradeTls(daysLeft: number | null): Result {
  if (daysLeft === null) return { check: "tls", level: "fail", detail: "no certificate" };
  const level: Level = daysLeft < THRESHOLDS.tlsFailDays ? "fail" : daysLeft < THRESHOLDS.tlsWarnDays ? "warn" : "ok";
  return { check: "tls", level, detail: `${Math.floor(daysLeft)} days left` };
}

/** Any failed background job in the last hour needs a look. */
export function gradeFailedJobs(rows: { name: string; count: number }[]): Result {
  const total = rows.reduce((n, r) => n + Number(r.count), 0);
  return { check: "failed-jobs", level: total ? "fail" : "ok", detail: total ? rows.map((r) => `${r.name}=${r.count}`).join(", ") : "none in the last hour" };
}

/** Storage only when the plan's limit is given (--storage-limit-mb); otherwise the size is reported. */
export function gradeStorage(bytes: number, limitMb?: number): Result {
  const mb = Math.round(bytes / 1024 / 1024);
  if (!limitMb) return { check: "db-storage", level: "ok", detail: `${mb} MB (no limit given)` };
  const p = pct(mb, limitMb);
  return { check: "db-storage", level: p >= THRESHOLDS.storageFailPct ? "fail" : p >= THRESHOLDS.storageWarnPct ? "warn" : "ok", detail: `${mb} of ${limitMb} MB (${p}%)` };
}

export function gradeConnections(used: number, max: number): Result {
  const p = pct(used, max);
  return { check: "db-connections", level: p >= THRESHOLDS.connectionsFailPct ? "fail" : p >= THRESHOLDS.connectionsWarnPct ? "warn" : "ok", detail: `${used} of ${max} (${p}%)` };
}

/** Exit code for schedulers: 0 all ok, 1 warnings only, 2 any failure. */
export function exitCode(results: Result[]): number {
  return results.some((r) => r.level === "fail") ? 2 : results.some((r) => r.level === "warn") ? 1 : 0;
}
