import tls from "node:tls";
import { Client } from "pg";
import { loadEnvFiles } from "../db/shared";
import { exitCode, gradeConnections, gradeFailedJobs, gradeStorage, gradeTls, gradeWeb, gradeWorker, type Result } from "./monitor";

/**
 * OPS-02 health probe for hosts without a full monitoring stack. Read-only: it only GETs the two health
 * endpoints, reads the TLS certificate and runs SELECT queries. Prints one JSON line per check (journald or
 * any log alert can match "level":"fail") and exits 0 ok / 1 warning / 2 failure.
 *
 *   npm run ops:check -- [--url https://staging.example.com] [--storage-limit-mb 10240] [--no-db]
 *
 * URL defaults to APP_URL and the database to DATABASE_URL. Use a read-only role where the host allows it.
 */

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};

async function getJson(url: string): Promise<[number | null, unknown]> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000), headers: { "cache-control": "no-cache" } });
    return [res.status, await res.json().catch(() => null)];
  } catch {
    return [null, null];
  }
}

function certDaysLeft(host: string, port: number): Promise<number | null> {
  return new Promise((resolve) => {
    const socket = tls.connect({ host, port, servername: host, timeout: 10_000 }, () => {
      const cert = socket.getPeerCertificate();
      socket.end();
      resolve(cert?.valid_to ? (new Date(cert.valid_to).getTime() - Date.now()) / 86_400_000 : null);
    });
    socket.on("error", () => resolve(null));
    socket.on("timeout", () => {
      socket.destroy();
      resolve(null);
    });
  });
}

async function databaseChecks(url: string, limitMb?: number): Promise<Result[]> {
  // The session itself is read-only, so this probe can never write, whatever query is added later.
  const db = new Client({ connectionString: url, connectionTimeoutMillis: 10_000, statement_timeout: 10_000, options: "-c default_transaction_read_only=on" });
  try {
    await db.connect();
    const failed = await db
      .query<{ name: string; count: number }>("select name, count(*)::int as count from pgboss.job where state = 'failed' and completed_on > now() - interval '1 hour' group by 1")
      .then((r) => gradeFailedJobs(r.rows))
      .catch(() => ({ check: "failed-jobs", level: "warn", detail: "pgboss schema not found (worker never started?)" }) as Result);
    const size = await db.query<{ bytes: string }>("select pg_database_size(current_database())::text as bytes");
    const conn = await db.query<{ used: number; max: number }>("select (select count(*)::int from pg_stat_activity) as used, current_setting('max_connections')::int as max");
    return [{ check: "database", level: "ok", detail: "connected" }, failed, gradeStorage(Number(size.rows[0]!.bytes), limitMb), gradeConnections(conn.rows[0]!.used, conn.rows[0]!.max)];
  } catch {
    return [{ check: "database", level: "fail", detail: "cannot connect" }];
  } finally {
    await db.end().catch(() => {});
  }
}

async function main() {
  loadEnvFiles();
  const base = (arg("url") ?? process.env.APP_URL ?? "").replace(/\/+$/, "");
  if (!base) throw new Error("Give --url or set APP_URL.");
  const limit = arg("storage-limit-mb");
  const results: Result[] = [gradeWeb(...(await getJson(`${base}/api/health`))), gradeWorker(...(await getJson(`${base}/api/health/worker`)))];
  const u = new URL(base);
  if (u.protocol === "https:") results.push(gradeTls(await certDaysLeft(u.hostname, Number(u.port) || 443)));
  if (!process.argv.includes("--no-db") && process.env.DATABASE_URL) results.push(...(await databaseChecks(process.env.DATABASE_URL, limit ? Number(limit) : undefined)));
  const at = new Date().toISOString();
  for (const r of results) console.log(JSON.stringify({ at, service: "sociotix-monitor", ...r }));
  process.exit(exitCode(results));
}

main().catch((err) => {
  console.log(JSON.stringify({ at: new Date().toISOString(), service: "sociotix-monitor", check: "monitor", level: "fail", detail: err instanceof Error && err.message.startsWith("Give --url") ? err.message : "probe could not run (check the URL argument and environment)" }));
  process.exit(2);
});
