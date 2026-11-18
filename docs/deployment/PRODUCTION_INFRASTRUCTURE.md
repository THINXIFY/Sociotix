# Sociotix production infrastructure (OPS-01A)

Preparation only: nothing here has been purchased, configured or deployed. This builds on the LR-01 launch-readiness
assessment and the Phase 5I-B report (`docs/backend/PHASE_5I_B_LAUNCH_READINESS_REPORT.md`). Vendor names are
examples that fit the requirements. Confirm each plan's current features (especially point-in-time recovery) before
buying.

## 1. Architecture

```
            Visitors
               │  HTTPS
     ┌─────────▼──────────┐   DNS, TLS, edge rate limits, request-size limit,
     │   Edge / reverse   │   sets X-Forwarded-For to the real client IP (see 5.2)
     │       proxy        │
     └─────────┬──────────┘
               │  HTTPS
     ┌─────────▼──────────┐        ┌────────────────────┐
     │   Web (Next.js)    │        │  Worker (pg-boss)  │   same image/commit, two processes
     │ npm run build      │        │  npm run worker    │   (1+ web instances, 1–2 workers)
     │ npm start          │        │  heartbeat / 1 min │
     └─────────┬──────────┘        └─────────┬──────────┘
               │      TLS (sslmode=require+) │
            ┌──▼──────────────────────────────▼──┐
            │  Managed PostgreSQL (UTF-8)        │   daily snapshots + PITR, encrypted at rest
            └────────────────────────────────────┘
   Email provider (Resend or Postmark) · Uptime and alerting · Log storage
```

- **One region, one database, one codebase.** Web and worker are two process types built from the same commit. No
  Kubernetes, queues or caches beyond PostgreSQL: pg-boss uses the same database.
- **Scale:** add web instances first. The connection budget is `DATABASE_POOL_MAX` × web instances, plus 5 per worker
  and a little for migrations. Keep it below the database plan's connection limit.
- **Staging and production are fully separate:** separate database, secrets, email sender domain or sub-domain, and
  `APP_URL`. Staging uses `APP_ENV=preview`, which enforces the same https, SSL and secret rules.

## 2. Hosting and external services

| Need | Requirement | Example options |
|---|---|---|
| Web + worker hosting | Runs Node 24, a long-running worker process, rolling restarts, health checks, a secret store | Render, Railway, Fly.io, or one small Linux VM with systemd and Caddy/nginx |
| PostgreSQL | Managed, **UTF-8**, TLS, daily snapshots, **PITR (≥ 7 days)**, encryption at rest | The host's managed Postgres, Neon, Supabase, AWS RDS |
| Edge / reverse proxy | TLS, per-path rate limits, body-size limit, **overwrites `X-Forwarded-For`** | Cloudflare (with a Transform Rule), Caddy or nginx |
| Email | Verified sending domain (SPF, DKIM, DMARC) | Resend or Postmark (the only two the app supports) |
| Monitoring | HTTP uptime checks, keyword/status alerts, log search and alerts, certificate expiry | Better Stack, UptimeRobot, the host's built-in alerts |
| CI | Runs `.github/workflows/ci.yml` | GitHub Actions (already the code host) |

## 3. Environment configuration checklist

Values live only in the host's secret store, never in files. `src/server/env.ts` refuses to start production when a
rule below is broken. `.env.example` shows every key.

**Required (web and worker)**
- [ ] `NODE_ENV=production`, `APP_ENV=production` (staging: `preview`)
- [ ] `APP_URL=https://<your domain>`
- [ ] `DATABASE_URL=postgresql://…?sslmode=require` (or `verify-full`)
- [ ] `AUTH_SECRET` and `DATA_ENCRYPTION_KEY`: generate with `npm run auth:secrets`; they must differ. **Never rotate
  `DATA_ENCRYPTION_KEY` without a re-encryption plan.**
- [ ] `EMAIL_TRANSPORT=resend|postmark`, `EMAIL_FROM`, `EMAIL_API_KEY`, `SUPPORT_CONTACT_EMAIL`
- [ ] `TRUST_PROXY_HEADERS=true` (required in production), plus either `CLIENT_IP_HEADER` or the right
  `TRUSTED_PROXY_HOPS`, behind a proxy that meets section 5.2
- [ ] `DATABASE_POOL_MAX` sized as in section 1 (default 10); `LOG_LEVEL=info`

**Must stay off at launch (postponed)**
- [ ] `DEMO_MODE=false` (enforced in production)
- [ ] `AI_PROVIDER=none`, `AI_GENERATION_ENABLED=false`, `AI_ANONYMOUS_ENABLED=false`
- [ ] `PAYMENTS_BANK_ENABLED=false`
- [ ] `SOCIAL_PROVIDERS_ENABLED` and `SOCIAL_PUBLISHING_ENABLED` empty, with no `SOCIAL_*` credentials set
- [ ] `EMAIL_NOTIFICATIONS=false` until the email templates are reviewed with real delivery

## 4. CI

`.github/workflows/ci.yml` runs on every pull request and every push to `main`. It runs `npm ci`, typecheck, lint, the
full test suite against a throwaway PostgreSQL 18 service container, and the production build. It has read-only
permissions, uses no secrets and **never deploys**. Make it a required status check on `main` (GitHub → Settings →
Branches).

## 5. Runbooks

### 5.1 First deployment (staging first, then production)
1. Create the database (UTF-8; for example `CREATE DATABASE sociotix ENCODING 'UTF8' TEMPLATE template0;`), confirm
   PITR is on, and take a manual snapshot.
2. Set the section 3 variables on **both** process types.
3. Build the release commit (CI must be green): `npm ci && npm run build`.
4. Migrate once, from one place (a release step or one-off job, never from every instance): `npm run db:migrate`.
   This applies `0000`–`0024` in order, with BR-01 `0023_brand_kit` and CP-01 `0024_campaign_planner` last. Then run
   `npm run db:seed` (reference data only; safe to repeat).
5. Start the web process (`npm start`) and the worker (`npm run worker`).
6. Bootstrap the owner once: `npm run auth:bootstrap-owner -- --email <owner> --name "<name>"`, then finish setup
   from the emailed link and enrol MFA.
7. Verify: `GET /api/health` → 200; `GET /api/health/worker` → 200 within about 2 minutes. Then register a
   customer, verify the email, reset a password, open Start here, save a post, create a plan, and activate an
   automation.

### 5.2 Reverse-proxy requirements
- HTTPS only, with HTTP → HTTPS redirects. The app already sends HSTS and the other security headers.
- **Client IP (SEC-02).** The app reads client IPs only from proxies you explicitly trust (`src/server/client-ip.ts`):
  - `TRUST_PROXY_HEADERS=true` is **required in production**; the app refuses to start without it. Route handlers
    can't see the socket address, so without it every per-IP limit would be off.
  - **Option A, edge header (preferred with a CDN):** `CLIENT_IP_HEADER=cf-connecting-ip` (or your edge's
    equivalent, such as `fly-client-ip` or `true-client-ip`). The edge must **set** it on every request, and it must
    hold exactly one address. `X-Forwarded-For` is then ignored.
  - **Option B, `X-Forwarded-For` chain:** leave `CLIENT_IP_HEADER` empty and set `TRUSTED_PROXY_HOPS` to the
    number of proxies **you run** that append to the header: `1` for the platform's load balancer only, `2` for
    edge + load balancer. The app reads the entry that many places from the **right**. The first entry is never
    trusted, so it doesn't matter whether a proxy appends or overwrites.
  - **The origin must be reachable only through those proxies.** Use the platform's private networking, an IP
    allow-list for the edge's ranges, or an authenticated origin pull. A request that reaches the app directly can
    set any header it likes, and no header-based scheme can detect that.
  - Requests whose client IP can't be established (header missing, malformed, duplicated, or a chain shorter than
    the hops) share a single strict `unverified` rate-limit bucket, so forging headers never opens a fresh one.
    IPv6 clients are limited per /64. If legitimate users ever hit "Too many attempts" together, the hop count or
    header is misconfigured.
  - `X-Real-IP`, `True-Client-IP` and similar headers are ignored unless named in `CLIENT_IP_HEADER`.
- **Rate limits (per IP):** `/login`, `/register`, `/forgot-password`, `/reset-password`, `/api/ai/*`,
  `/api/catalog/*` and search. Start with about 10 requests/minute on the auth pages and about 60/minute on search.
  The app's own limiters stay in place behind these.
- **Body-size limit:** 1 MB. The app rejects larger declared bodies itself (`MAX_BODY_BYTES`); the proxy must also
  stop undeclared or chunked bodies.
- Health checks: the load balancer uses `/api/health` only. **Never** use `/api/health/worker` for web routing.
- `/dev/*` already returns 404 outside `APP_ENV=development` (enforced in `src/proxy.ts`); a proxy deny rule adds a
  second layer.

### 5.3 Routine release
1. CI green on the commit, then deploy to staging and smoke-test.
2. If the release has a migration: snapshot first, then `npm run db:migrate`. Migrations are additive by policy, so
   the previous release keeps working against the new schema.
3. Roll the web instances (the host drains old instances), then restart the worker. On SIGTERM the worker stops in
   30 s or less, and unfinished jobs retry after their lease expires.
4. Watch errors and both health endpoints for 15 minutes.

### 5.4 Rollback
- **Code:** redeploy the previous release. Additive migrations mean you don't need to touch the database.
- **Schema (rarely needed):** each migration has `drizzle/rollback/NNNN_*.down.sql`. Run them in reverse order with
  `psql`, but only after a snapshot, and only if the data the migration added can be lost. Rolling back `0024` drops
  marketing plans; rolling back `0023` drops brands. Posts are kept.
- **Data loss or corruption:** restore with point-in-time recovery to a new instance, verify it (section 6.3), then
  repoint `DATABASE_URL`.

## 6. Database safety

### 6.1 Requirements
- UTF-8 server and database encoding. Local `socivanta_dev` is WIN1252, so **don't copy it into production as it
  is**. To keep local data, use the approved `npm run db:utf8-copy` path; production starts clean.
- TLS required, a least-privilege application role (no superuser), and a separate role for migrations if the host
  allows it.

### 6.2 Backups
- Daily automatic snapshots kept for at least 7 days, plus PITR for at least 7 days.
- A manual snapshot before every migration.
- A monthly logical export (`pg_dump -Fc`) to separate storage for long-term retention.
- Alert on any backup failure (section 7).

### 6.3 Restore drill (before launch, then quarterly)
1. Restore the latest snapshot (or a PITR point) into a **new** instance.
2. Point a staging build at it and confirm `npm run db:migrate` reports nothing to apply.
3. `GET /api/health` → 200, and sign-in works.
4. Run the ledger checks: the worker's `maintenance.verify-ledger` and `deposits.reconcile` complete without
   findings.
5. Compare row counts for `users`, `customers`, `social_posts`, `brands` and `campaigns` with production.
6. Record how long it took (your recovery-time objective) and how far back it restored (your recovery-point
   objective). Delete the instance.

## 7. Monitoring and alerts

| Signal | How | Alert when |
|---|---|---|
| Web uptime | HTTP check on `GET /api/health` every 1 min from 2+ locations | not 200 for 2 checks |
| Worker liveness | HTTP check on `GET /api/health/worker` (the worker records a heartbeat every minute) | 503 for 5 min |
| Failed jobs | Log alert on worker error lines: `job queue error`, `could not queue job`, `ledger verification failed`, `financial reconciliation found exceptions`, `unhandled rejection in worker`, `could not record worker heartbeat`. Also a scheduled read-only query: `select name, count(*) from pgboss.job where state = 'failed' and completed_on > now() - interval '1 hour' group by 1` | any in 10 min; any failed job |
| Application errors | Log alert on level ≥ `error` from web | more than 5 in 5 min |
| Database | The provider's metrics: connections, CPU, storage, replication or backup status | storage > 80%, connections > 80%, backup failed |
| TLS certificate | Certificate-expiry monitor on the domain | < 14 days to expiry |
| Backups | The provider's backup notifications, plus the quarterly drill | any failure |

Both health endpoints are public but reveal only `ok`/`degraded` per component (or `ok`/`stale`/`unknown` for the
worker): no versions, hostnames or error text. Logs are structured JSON (pino); never log request bodies or tokens.
Keep logs for at least 14 days.

## 8. Remaining launch blockers (external)
1. Choose and provision hosting, the managed UTF-8 PostgreSQL with PITR, the edge proxy and email (sections 2, 5.2).
2. Generate the secrets and store them in the host's secret store; bootstrap the owner with MFA.
3. Verify the email sending domain and test real delivery (verification and password reset).
4. Set up the monitors and alerts in section 7, and do one restore drill.
5. Confirm the legal pages and business entity (`OPEN_DECISIONS` D15).
6. Make CI a required check on `main`.

Postponed, and each needs its own approval: payments, suppliers (SSRF controls first), live AI, social publishing,
referral rewards and SEO-02.
