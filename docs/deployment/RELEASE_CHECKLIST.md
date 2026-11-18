# Sociotix release checklist and Go/No-Go (RL-01)

For the first **limited free launch**: customers can register and use the Marketing workspace (Brand Kit, Posts,
Calendar, Marketing Plans, Automations). Payments, suppliers, live AI, social publishing, SEO-02 and CW-01 stay off.
Uses `STAGING_RUNBOOK.md` (setup), `MONITORING_RECOVERY.md` (alerts, backups) and `PRODUCTION_INFRASTRUCTURE.md`.

## 1. Release candidate checklist

Tick every line on staging first, then again on production. Record the commit and tag.

**Build and tests**
- [ ] CI is green on the exact commit: typecheck, lint, unit and integration tests, production build.
- [ ] The tag `vX.Y.Z-rc.N` points at that commit (§2).
- [ ] `npm ci` (with dev dependencies; the worker and scripts use `tsx`) and `npm run build` succeed on the host.

**Environment and secrets**
- [ ] `/etc/sociotix/sociotix.env` is filled from `deploy/staging.env.example` (production: `APP_ENV=production`),
      mode `0640`, owner `root:sociotix`, and contains no placeholder.
- [ ] `AUTH_SECRET` and `DATA_ENCRYPTION_KEY` are generated (`npm run auth:secrets`), different from each other and
      from every other environment, and stored in a password manager.
- [ ] `DEMO_MODE=false` and `EMAIL_TRANSPORT` is a real provider (production configuration is invalid otherwise).
- [ ] Postponed integrations are off: `AI_PROVIDER=none`, `AI_GENERATION_ENABLED=false`, `AI_ANONYMOUS_ENABLED=false`,
      `PAYMENTS_BANK_ENABLED=false`, `SOCIAL_PROVIDERS_ENABLED` and `SOCIAL_PUBLISHING_ENABLED` empty.
- [ ] The configuration is accepted. The worker refuses to start on any invalid value. The web still serves, but
      `/api/health` returns 503 `"config":"invalid"`, so the web check is health returning 200, not just a running
      process.

**Database**
- [ ] Managed PostgreSQL 18, UTF-8, TLS (`sslmode=verify-full`), PITR on, app role without superuser.
- [ ] A snapshot is taken before migrating.
- [ ] `npm run db:migrate` applied `0000`–`0024`: `select count(*) from drizzle.__drizzle_migrations;` returns 25.
- [ ] `npm run db:seed` has run; the owner is bootstrapped and has enrolled MFA.

**HTTPS, proxy and origin**
- [ ] `nginx -t` passes; `systemd-analyze verify /etc/systemd/system/sociotix-*.service` passes.
- [ ] HTTPS works and HTTP redirects to it; the certificate auto-renews (`certbot renew --dry-run`).
- [ ] The origin is closed from outside: `curl -m 5 http://<host-ip>:3000/` fails; only 80/443 (and admin-only 22)
      are open.
- [ ] The SEC-02 values match the topology table. Forged `X-Forwarded-For` sign-ins still hit "Too many attempts"
      after 30.
- [ ] `/dev/mailbox` returns 404.

**Email**
- [ ] The sender domain is verified (SPF, DKIM, DMARC).
- [ ] Registering a new account delivers the verification email, and the link verifies it.
- [ ] Forgot password delivers the reset email; the link sets a new password and signs out other sessions.

**Health and monitoring**
- [ ] `/api/health` returns 200 `"status":"ok"`; `/api/health/worker` returns 200 `"worker":"ok"` within 2 minutes.
- [ ] `npm run ops:check` exits 0; it is scheduled every 5 minutes.
- [ ] External uptime checks for both endpoints, log alerts and certificate-expiry alerts are set up. One alert has
      been tested by stopping the worker.
- [ ] `systemctl restart sociotix-worker` logs `worker stopping` then `worker started` within 40 s.

**Backup, restore and rollback**
- [ ] Daily backups and PITR confirmed in the provider console; backup-failure notifications go to a person.
- [ ] A restore drill is recorded in `MONITORING_RECOVERY.md` §3 within the last 90 days.
- [ ] Rollback was rehearsed once on staging (§3): switch `current` to the previous release and restart.

**Customer smoke test (on the release itself)**
- [ ] Register, verify email, sign in, and see Start here.
- [ ] Create a brand in Brand Kit; write a post; plan it on the Calendar; create a Marketing Plan; activate an
      Automation and see its inbox item after it runs.
- [ ] Mobile width and dark mode look right on Start here and the Calendar.
- [ ] Sign out, then forgot password and reset.
- [ ] Staff sign-in requires MFA; a customer can't open `/admin`.
- [ ] Watch errors and both health checks for 15 minutes after the switch.

## 2. Versioning

- **Tags:** semantic versions on `main` only.
  - `vX.Y.Z-rc.N` is a candidate, deployed to staging.
  - `vX.Y.Z` is the same commit, promoted to production after the checklist passes. Never rebuild a different
    commit for production.
  - The first limited free launch is `v1.0.0` (candidates `v1.0.0-rc.1`, `-rc.2`, …).
  - `PATCH` is for fixes only. `MINOR` is for features or migrations. `MAJOR` is for breaking changes to data or
    behaviour.
- **Create a tag:** `git tag -a v1.0.0-rc.1 -m "Release candidate 1" <sha> && git push origin v1.0.0-rc.1`. Set
  `package.json` `version` in the release commit.
- **Release directories:** `/srv/sociotix/releases/<tag>`, with `current` a symlink to the live one. Keep the last 3.
- **Release notes:** the tag message lists migrations (if any), the new environment variables and the rollback
  notes.

## 3. Deploy and rollback

**Deploy:**
1. Build `releases/<tag>`.
2. If the release has a migration: take a snapshot, then run `npm run db:migrate`.
3. `ln -sfn releases/<tag> current && systemctl restart sociotix-web sociotix-worker`.
4. Health checks and smoke test. Watch for 15 minutes.

**Roll back when:** health is failing, errors spike, or a core workflow is broken, and a fix isn't ready in 30 minutes.
1. `ln -sfn releases/<previous tag> current && systemctl restart sociotix-web sociotix-worker`.
2. Migrations are additive, so the previous release runs on the new schema. Don't roll back the schema as a first step.
3. Schema rollback only if the migration itself is the problem: take a snapshot, then apply
   `drizzle/rollback/NNNN_*.down.sql` in reverse order. Note what each one drops (`0024` drops marketing plans,
   `0023` drops brands).
4. Data damage: PITR (`MONITORING_RECOVERY.md` §3).
5. Record what happened. The next attempt is a new `-rc.N`.

## 4. Remaining launch blockers

| # | Blocker | Class | Where |
|---|---|---|---|
| 1 | Hosting, managed PostgreSQL 18 (UTF-8, TLS, PITR) and DNS provisioned | Critical | Runbook step 1 |
| 2 | Production secrets generated and stored; env file without placeholders | Critical | Runbook step 2 |
| 3 | HTTPS, origin lock-down and the forged-header test passing through the real proxy | Critical | Runbook steps 2–4 |
| 4 | Migrations 0000–0024 and seed applied; owner with MFA | Critical | Runbook steps 5–6 |
| 5 | Email domain verified; verification and password-reset emails delivered | Critical | Runbook step 8 |
| 6 | Backups and PITR on, plus one recorded restore drill | Critical | `MONITORING_RECOVERY.md` §3 |
| 7 | Uptime, worker, error and backup alerts live and one tested | Critical | `MONITORING_RECOVERY.md` §1 |
| 8 | Legal pages and business entity confirmed (`OPEN_DECISIONS` D15) | Critical | Owner decision |
| 9 | `nginx -t`, `systemd-analyze verify`, graceful worker restart checked on the host | Required | §1 |
| 10 | CI made a required status check on `main` (branch protection) | Required | GitHub settings |
| 11 | `ops:check` scheduled; logs kept ≥ 14 days; monthly off-provider `pg_dump` | Required | `MONITORING_RECOVERY.md` |
| 12 | Rollback rehearsed once on staging | Required | §3 |
| 13 | Tighten the CSP `script-src` (LR-01 finding) | Optional (hardening) | `next.config.ts` |
| 14 | CDN / WAF in front of nginx (change the SEC-02 topology row if added) | Optional | Runbook topology table |
| 15 | Public status page | Optional | — |

Payments, suppliers, live AI, social publishing, referral rewards, SEO-02 and CW-01 are **postponed, not blockers**.
Each needs its own approval before it is switched on.

## 5. Go/No-Go (limited free launch)

Decide in one short meeting with the checklist open. **Go only if every answer is yes**; any "no" is No-Go, with
an owner and a date.

| Question | Yes / No |
|---|---|
| Are all Critical blockers (1–8) closed? | |
| Has every §1 checklist line been ticked on staging **and** production, for the same commit and tag? | |
| Is CI green on that commit, and does the tag point at it? | |
| Has the full customer smoke test passed on production? | |
| Have both health checks been 200 for 30 minutes, with no unexplained errors? | |
| Is a restore drill from the last 90 days recorded, with RTO ≤ 2 h and RPO ≤ 15 min? | |
| Has an alert been tested and reached a person? | |
| Is the previous release (or a maintenance page) ready to switch back to in < 10 minutes? | |
| Are postponed integrations confirmed off in the production env? | |
| Is someone on call for the first 48 hours? | |

Required items (9–12) can be signed off as accepted risk only by the owner, in writing, with a date to close them.
Optional items don't affect Go/No-Go.
