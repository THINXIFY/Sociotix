# Sociotix monitoring, backup and recovery (OPS-02)

Preparation only. No monitor, alert or backup has been configured on a real host yet, so nothing below is
verified in production. Builds on `PRODUCTION_INFRASTRUCTURE.md` sections 6 and 7 and `STAGING_RUNBOOK.md`.

## 1. What to monitor

| Signal | Source | Warn | Alert (page someone) |
|---|---|---|---|
| Website uptime | External HTTP check of `GET /api/health` every 1 min, 2+ locations | — | Not 200 / `"status":"ok"` twice in a row |
| Application errors | Web logs at level ≥ error (pino `"level":50`+) | > 5 in 5 min | > 20 in 5 min, or any `level 60` (fatal) |
| Worker heartbeat | External HTTP check of `GET /api/health/worker` | — | 503 (`stale` / `unknown`) for 5 min |
| Failed jobs | `npm run ops:check` (read-only SQL on `pgboss.job`) and worker error log lines (`PRODUCTION_INFRASTRUCTURE.md` §7) | — | Any failed job in the last hour |
| Database connectivity | `/api/health` (`"database":"unreachable"`) and `ops:check` | — | Any failure |
| Database storage | `ops:check --storage-limit-mb <plan limit>` and provider metrics | ≥ 80% | ≥ 90% |
| Database connections | `ops:check` (`pg_stat_activity` vs `max_connections`) and provider metrics | ≥ 80% | ≥ 95% |
| Backups | Provider backup notifications | — | Any failed or missing daily backup |
| HTTPS certificate | `ops:check` (reads the served certificate) or an external expiry monitor | < 21 days | < 14 days |
| Restarts | `systemctl show -p NRestarts sociotix-web sociotix-worker` | count rises | count rises 3+ times in 15 min |

### `npm run ops:check`
`scripts/ops/check.ts` is a read-only probe for hosts without a monitoring stack. It does only `GET`s on the two
health endpoints, a TLS handshake and `SELECT`s. It prints one JSON line per check, and exits `0` when everything is
ok, `1` on a warning only, or `2` on any failure. Thresholds live in `scripts/ops/monitor.ts` (unit-tested in
`tests/unit/ops-monitor.test.ts`).

```
# Every 5 minutes from the host (cron or a systemd timer), with the same env file:
set -a; . /etc/sociotix/sociotix.env; set +a
cd /srv/sociotix/current && npm run -s ops:check -- --storage-limit-mb <plan limit> | logger -t sociotix-monitor
```

Alert on `"level":"fail"` lines (or a non-zero exit) through the host's log alerting. Prefer a read-only database
role for `DATABASE_URL` here when the provider supports it. The probe is a backstop: external uptime checks from
outside the host remain the primary signal, because a probe on the host can't report the host itself being down.

Verified locally (disposable database, production build): exit `2` with worker `unknown` before the worker started;
exit `0` with everything ok while it ran; exit `0` again after a hard crash and restart.

## 2. Recovery actions

| Alert | First checks | Recovery |
|---|---|---|
| Website down | `systemctl status sociotix-web nginx`; `journalctl -u sociotix-web -n 100`; `/api/health` from the host (`curl -s 127.0.0.1:3000/api/health`) | `config: invalid` → fix `/etc/sociotix/sociotix.env`, then restart. `database: unreachable` → see "Database". Process crash-looping after a release → roll back (§4). |
| Error spike | Logs grouped by `msg` and `requestId` | Release-related → roll back. Single route → leave it, open an issue, watch. |
| Worker `stale` / `unknown` | `systemctl status sociotix-worker`; `journalctl -u sociotix-worker -n 100` | `systemctl restart sociotix-worker`. Must return to `ok` within 2 minutes. Still failing → check `DATABASE_URL` and database health. |
| Failed jobs | `select name, output, completed_on from pgboss.job where state='failed' order by completed_on desc limit 20;` | `maintenance.verify-ledger` / `deposits.reconcile` → **stop and investigate before anything else** (money). Others retry automatically; fix the cause, then let the next scheduled run pick it up. |
| Database unreachable | Provider status page and metrics; `ops:check` | Provider incident → wait and monitor. Connections exhausted → restart web and worker (each pool: web `DATABASE_POOL_MAX`, worker 5). Data damage → PITR (§3). |
| Storage ≥ 80% | `select relname, pg_size_pretty(pg_total_relation_size(relid)) from pg_statio_user_tables order by pg_total_relation_size(relid) desc limit 10;` | Raise the plan's storage. Don't delete data to make room. |
| Backup failed | Provider notification | Take a manual snapshot now; open a provider ticket; no migrations until a backup succeeds. |
| Certificate < 14 days | `certbot certificates`; `systemctl list-timers certbot*` | `certbot renew && systemctl reload nginx`. |

### Worker restart behaviour
- **Graceful (SIGTERM from `systemctl stop/restart`):** stops scheduling, lets running jobs finish for up to 25 s,
  closes the database pool, and exits by 30 s at the latest. `TimeoutStopSec=40` covers it. Unfinished jobs retry
  after their lease expires. **Verify on the host:** `systemctl restart sociotix-worker` logs `worker stopping`
  and then `worker started` within 40 s (Windows can't deliver SIGTERM to Node, so this wasn't tested locally).
- **Crash / kill:** systemd restarts it after 10 s (`Restart=always`). Verified locally: after a hard kill and
  restart, the heartbeat resumed and no errors were logged.
- **Repeated scheduled jobs:** the idempotency key only removes duplicates while a job is still queued. A restart in
  the same minute can queue an already-finished scheduled job again. This is harmless: automations run once per
  trigger slot, publishing claims each target once, even across concurrent workers (integration tests in
  `automations.test.ts` and `publishing.test.ts`).

## 3. Backup, point-in-time recovery and restore drill

**Policy:** daily automatic snapshots kept ≥ 7 days, PITR window ≥ 7 days, a manual snapshot before every migration,
and a monthly `pg_dump -Fc` to storage outside the database provider (kept 12 months, encrypted).

**PITR (data damaged or deleted by mistake):**
1. Note the last known good time (UTC) from logs or the report.
2. Stop the worker (`systemctl stop sociotix-worker`) so no jobs write during recovery. Keep the web up, or put it in
   maintenance if the damage is spreading.
3. Restore to a **new** instance at that time with the provider's PITR. Never restore over production.
4. Verify the new instance (drill steps 3–5 below).
5. Point `DATABASE_URL` at it, restart web and worker, and confirm both health checks.
6. Keep the old instance (read-only) for 7 days for comparison, then delete it.

**Restore drill (before launch, then quarterly).** Record each run in the table.
1. Restore the latest snapshot or a PITR point into a new instance.
2. Run a staging build against it: `npm run db:migrate` reports nothing to apply (25 rows in
   `drizzle.__drizzle_migrations`).
3. `/api/health` is 200 and an owner can sign in with MFA.
4. Run `npm run ops:check` against it: no failed jobs; the worker's `maintenance.verify-ledger` and
   `deposits.reconcile` complete without findings.
5. Row counts for `users`, `customers`, `brands`, `social_posts` and `campaigns` match the source at that time.
6. Record recovery time and data-loss window, then delete the instance.

| Date | Source (snapshot / PITR time) | Recovery time (RTO) | Data-loss window (RPO) | Result | By |
|---|---|---|---|---|---|
| | | | | | |

Targets for the limited free launch: RTO ≤ 2 hours, RPO ≤ 15 minutes (with PITR).

## 4. Rollback
See `RELEASE_CHECKLIST.md` §3.
