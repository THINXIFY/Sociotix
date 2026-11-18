# Sociotix staging runbook (OPS-01B)

Preparation only: nothing here has been provisioned or deployed. This runbook applies
`PRODUCTION_INFRASTRUCTURE.md` to staging, using the provider-neutral templates in `deploy/`:

| File | Purpose |
|---|---|
| `deploy/staging.env.example` | Every staging setting, with placeholders. Checked by `tests/unit/staging-env.test.ts`. |
| `deploy/nginx/sociotix.conf` | Reverse proxy: TLS, overwritten `X-Forwarded-For`, stripped spoofable headers, body and rate limits, `/dev` blocked. |
| `deploy/systemd/sociotix-web.service` | Web process on `127.0.0.1:3000` only, restarts automatically, hardened. |
| `deploy/systemd/sociotix-worker.service` | Background worker, restarts automatically, stops gracefully. |

**Reference topology:** one small Linux host (nginx + web + worker) and a managed PostgreSQL 18. On a platform
(PaaS) host, use the platform's own process definitions with the same two commands, the same environment and the
proxy settings from the topology table below.

## Trusted proxy topologies (SEC-02)

Pick exactly one row and set all three values together. With `APP_ENV=preview` or `production`, the app refuses
to start unless `TRUST_PROXY_HEADERS=true`.

| Topology | `CLIENT_IP_HEADER` | `TRUSTED_PROXY_HOPS` | Origin lock-down |
|---|---|---|---|
| nginx on the same host (this repo's template) | *(empty)* | `1` | App binds `127.0.0.1`; only nginx is public (firewall: 80/443 only) |
| CDN that sets a client-IP header (Cloudflare `cf-connecting-ip`) → nginx/app | `cf-connecting-ip` | *(ignored)* | Allow 80/443 **only** from the CDN's published ranges, or use authenticated origin pulls |
| PaaS with one load balancer that appends `X-Forwarded-For` | *(empty)* | `1` | The platform routes all traffic through its load balancer (no public port on the instance) |
| CDN → PaaS load balancer, both appending | *(empty)* | `2` | Restrict the PaaS service to the CDN (private origin or allow-list) |

**Never:** set `TRUST_PROXY_HEADERS=true` while the app port is publicly reachable, or name `x-forwarded-for` /
`x-real-ip` as `CLIENT_IP_HEADER` unless your edge overwrites it. Requests whose IP can't be verified share one
strict `unverified` rate-limit bucket. If real users get "Too many attempts" together, this table was applied
wrongly.

Next.js fills in `X-Forwarded-For` from the socket only when the header is missing; it never appends. A request
that reaches the app directly is therefore keyed by its own socket address, and any `X-Forwarded-For` it sends is
believed. This is why origin lock-down is required and not optional.

## Verified locally (OPS-01C)

| Area | Verified on a development machine | Still needs the staging host |
|---|---|---|
| nginx / systemd | `tests/unit/deploy-config.test.ts`: structure, header overwrite and blanking, loopback upstream, body limits only on the 3 upload routes, auth/API rate limits, unlimited health checks, unit hardening, worker command | `nginx -t`, `systemd-analyze verify deploy/systemd/*.service`, TLS certificate issuance |
| Environment | `tests/unit/staging-env.test.ts`; web and worker refuse to start with unsafe staging values | Real secrets in `/etc/sociotix/sociotix.env` |
| Proxy trust | 36 sign-ins through an nginx stand-in with a different forged `X-Forwarded-For` / `X-Real-IP` each time all landed in one bucket and were refused after 30 | The same check through the real nginx (launch step 4), and from outside that port 3000 is closed |
| Health | `/api/health` 503 with `config: invalid` or 200 `ok`; `/api/health/worker` 503 `unknown` without a database | Worker turns `ok` within 2 minutes of starting |
| Migrations | 0000–0024 apply, roll back and re-apply on a scratch database | Run against the managed database |
| Backup / restore / PITR | Not possible locally (no `pg_dump`, no PITR) | Restore drill (launch step 10) |
| Monitoring | Endpoints and read-only SQL checked | Alerts wired and tested (launch step 9) |

## Database

- **Create:** a managed PostgreSQL 18 with TLS required, and a separate database from production:
  `CREATE DATABASE sociotix_staging ENCODING 'UTF8' LC_COLLATE 'C.UTF-8' LC_CTYPE 'C.UTF-8' TEMPLATE template0;`
  Then `SHOW server_encoding;` must return `UTF8`.
- **Roles:** an app role with no superuser rights that owns the schema (migrations run as this role). Don't use the
  provider's admin user in `DATABASE_URL`.
- **Migrations:** `npm run db:migrate` applies `0000`–`0024` in order and records them in
  `drizzle.__drizzle_migrations` (25 rows when current). It is safe to repeat. Run it once per release, from one
  place.
- **Seed:** `npm run db:seed` loads reference data only (roles, catalog, ledger accounts). It is safe to repeat and
  makes nothing purchasable.
- **Owner:** `npm run auth:bootstrap-owner -- --email <owner> --name "<name>"` runs once only. It emails a 2-hour
  setup link, and MFA enrolment is required at first sign-in.
- **Backups:** daily snapshots kept for at least 7 days, plus PITR for at least 7 days. Take a manual snapshot before
  every migration. Restore drill: `PRODUCTION_INFRASTRUCTURE.md` section 6.3.
- **Rollback:** redeploy the previous release first; migrations are additive. Schema rollback via
  `drizzle/rollback/NNNN_*.down.sql` (reverse order) only after a snapshot, and only if the data the migration added
  can be lost (`0024` drops marketing plans, `0023` drops brands; posts are kept).

## Monitoring checks

| Check | Target | Alert |
|---|---|---|
| Web uptime | `GET https://<staging>/api/health` returns 200 and contains `"status":"ok"` | 2 failures in a row |
| Worker | `GET https://<staging>/api/health/worker` returns 200 (`{"worker":"ok"}`); 503 means `stale` or `unknown` | 503 for 5 min |
| Service restarts | `systemctl show -p NRestarts sociotix-web sociotix-worker` (or the platform's restart count) | count increases |
| Errors | journald / platform logs at level ≥ error (pino JSON `"level":50`+), including `job queue error`, `could not queue job`, `ledger verification failed`, `unhandled rejection in worker` | any in 10 min |
| Failed jobs (read-only SQL) | `select name, count(*) from pgboss.job where state = 'failed' and completed_on > now() - interval '1 hour' group by 1;` | any rows |
| Database | `select pg_size_pretty(pg_database_size(current_database()));` plus the provider's connection, CPU and storage metrics | storage > 80% or connections > 80% |
| Backups | The provider's backup notifications | any failure |
| TLS | Certificate-expiry monitor (certbot renews at 30 days) | < 14 days left |

`npm run ops:check` runs these checks from the host. Full thresholds and recovery actions:
`MONITORING_RECOVERY.md`. Release and Go/No-Go: `RELEASE_CHECKLIST.md`.

Health responses reveal only a one-word status per check. Don't expose logs or `pgboss` tables publicly.

## Staging launch checklist

1. **Provision hosting and database.** Create the Linux host (or PaaS services) and the managed PostgreSQL 18
   (UTF-8, TLS, PITR on). Create `sociotix_staging` and the app role as above.
2. **Configure secrets and HTTPS.**
   1. Generate `AUTH_SECRET` and `DATA_ENCRYPTION_KEY` with `npm run auth:secrets` (different from production's).
   2. Fill `deploy/staging.env.example` into `/etc/sociotix/sociotix.env` (`root:sociotix`, mode `0640`) or the
      platform's secret store.
   3. Point DNS at the host, then get a certificate: `certbot certonly --webroot -w /var/www/certbot -d <staging>`.
3. **Restrict direct origin access.**
   1. Firewall: allow 22 (admin addresses only), 80 and 443. The app port 3000 is never opened, and the unit binds
      `127.0.0.1`.
   2. With a CDN, allow 80/443 only from its ranges.
   3. Verify from outside: `curl -m 5 http://<host-ip>:3000/` must fail.
4. **Configure trusted proxy headers.**
   1. Install `deploy/nginx/sociotix.conf` (replace the domain), then `nginx -t && systemctl reload nginx`.
   2. Set the three SEC-02 values from the topology table.
   3. Verify a forged header is ignored: after five or more wrong sign-ins sent with
      `-H 'X-Forwarded-For: 1.2.3.4'` and different forged values, you still hit "Too many attempts".
5. **Apply migrations and seed data.** Install the release:
   `git clone`/fetch the tag into `/srv/sociotix/releases/<sha>`, then `npm ci` (not `--omit=dev`: the worker and
   scripts use `tsx`), `npm run build`, and point the `current` link at it. Then:
   ```
   set -a; . /etc/sociotix/sociotix.env; set +a
   npm run db:migrate && npm run db:seed
   ```
   Confirm `select count(*) from drizzle.__drizzle_migrations;` returns 25.
6. **Bootstrap the owner with MFA.** Run `npm run auth:bootstrap-owner -- --email <owner> --name "<name>"`, open the
   emailed link, set a password and enrol MFA. Store the recovery codes offline.
7. **Start web and worker.**
   ```
   cp deploy/systemd/*.service /etc/systemd/system/ && systemctl daemon-reload
   systemctl enable --now sociotix-web sociotix-worker
   ```
   Then `/api/health` returns 200, and `/api/health/worker` returns 200 within 2 minutes.
8. **Configure transactional email.** Verify the staging sender domain (SPF, DKIM, DMARC) with Resend or Postmark,
   then register a test customer and confirm the verification and password-reset emails arrive.
   `EMAIL_NOTIFICATIONS` stays `false`.
9. **Configure monitoring and alerts.** Set up every row of the monitoring table, then test one alert by stopping the
   worker (`systemctl stop sociotix-worker`) and waiting for the alert.
10. **Smoke tests and restore drill.**
    1. Smoke test: register, verify, sign in, open Start here, write a post, plan it on the calendar, create a brand
       and a marketing plan, activate an automation and see its inbox item after it runs. Confirm `/dev/mailbox`
       returns 404 and that staff sign-in requires MFA.
    2. Restore drill: restore a PITR point into a new instance, run `db:migrate` (nothing to apply), check health and
       row counts, record the recovery time (RTO) and data-loss window (RPO), then delete the instance.

**Routine deploys:** build the new release next to the old one, take a snapshot if it migrates, run
`npm run db:migrate`, switch `current`, then `systemctl restart sociotix-web sociotix-worker`. To roll back, switch
`current` back and restart.

## Out of scope for staging
Payments, suppliers, live AI, social publishing, SEO-02 and CW-01 stay off. The template pins them off, and the
staging-env test fails if they change.
