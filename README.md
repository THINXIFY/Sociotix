<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/brand/web/logo-dark.png">
    <img src="public/brand/web/logo-light.png" alt="Sociotix" width="340">
  </picture>
</p>

<h3 align="center">Smarter Social. Bigger Impact.</h3>

<p align="center">
  An AI-powered social growth and marketing platform: a services marketplace, customer and admin dashboards, AI-assisted tools, a social account workspace and a blog, all in one Next.js codebase on PostgreSQL.
</p>

<p align="center">
  <img alt="Status: in development" src="https://img.shields.io/badge/status-in%20development-7047EB">
  <img alt="Next.js 16" src="https://img.shields.io/badge/Next.js-16-202127?logo=nextdotjs">
  <img alt="React 19" src="https://img.shields.io/badge/React-19-202127?logo=react">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-202127?logo=typescript">
  <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-16%2B-202127?logo=postgresql">
  <img alt="Tailwind CSS v4" src="https://img.shields.io/badge/Tailwind_CSS-v4-202127?logo=tailwindcss">
</p>

<p align="center">
  <a href="#features">Features</a> ·
  <a href="#getting-started">Getting started</a> ·
  <a href="#commands">Commands</a> ·
  <a href="#brand-assets">Brand assets</a> ·
  <a href="#documentation">Documentation</a>
</p>

---

> [!IMPORTANT]
> **In development, not live.** Sociotix isn't deployed or production-ready. Real payments, AI generation, SMM provider fulfilment, external social publishing and monetary referral rewards are **disabled**, and each stays off until it's separately approved and configured. See [Activation limits](#activation-limits).

> [!NOTE]
> **Formerly SociVanta.** Every public, customer and admin interface uses Sociotix. A few internal identifiers keep the old name for compatibility: the local database names (`socivanta_dev`) and the project folder. Phase reports in `docs/` keep it as historical records. See [`docs/branding/SOCIOTIX_REBRANDING_REPORT.md`](docs/branding/SOCIOTIX_REBRANDING_REPORT.md). The intended domain, `sociotix.com`, is used only through `APP_URL` once ownership and deployment are confirmed.

## Features

<table>
  <tr>
    <td valign="top" width="50%">
      <h4>🌐 Public website</h4>
      <ul>
        <li>Homepage and marketplace: 118 services across 15 platforms</li>
        <li>AI tools hub with guided tool pages</li>
        <li>Social management overview, pricing and a Help Center</li>
        <li>About, Media Kit, Privacy Policy and Terms of Service</li>
      </ul>
    </td>
    <td valign="top" width="50%">
      <h4>📰 Blog</h4>
      <ul>
        <li>Searchable listing with category tabs, featured and latest articles</li>
        <li>Article pages with contents, reading progress and sharing</li>
        <li><code>BlogPosting</code> schema and sitemap entries for published posts only</li>
        <li>Drafts stay private and out of search engines</li>
      </ul>
    </td>
  </tr>
  <tr>
    <td valign="top">
      <h4>👤 Customer dashboard</h4>
      <ul>
        <li>Overview, New Order, Orders, Wallet/Add Funds, Transactions and Service Finder</li>
        <li>AI workspace and Social workspace: accounts, publishing, calendar, automations, campaigns, activity</li>
        <li>Support tickets, referrals, profile, settings and sign-in security</li>
      </ul>
    </td>
    <td valign="top">
      <h4>🛡️ Admin dashboard</h4>
      <ul>
        <li>Overview analytics, Reports with CSV export, Services &amp; Pricing, Orders</li>
        <li>Providers, Customers, Payments, Support and Referrals</li>
        <li>AI Management, <b>Blog Management</b>, Platform Settings, Staff &amp; Permissions</li>
      </ul>
    </td>
  </tr>
  <tr>
    <td valign="top">
      <h4>✍️ Blog Management</h4>
      <ul>
        <li>Rich-text editor (H2–H4, lists, quotes, links, images, undo/redo) with sanitised paste</li>
        <li>Featured images by upload or URL import, validated and stored on Sociotix</li>
        <li>SEO panel: keywords, title and description counters, search preview, social sharing, a writing checklist</li>
        <li>Drafts, preview, scheduling, publishing, custom categories, and old URLs that redirect after a rename</li>
      </ul>
    </td>
    <td valign="top">
      <h4>⚙️ Backend</h4>
      <ul>
        <li><b>Auth:</b> Argon2id passwords, mandatory staff MFA (TOTP), role-based permissions, re-authentication for sensitive changes</li>
        <li><b>Money:</b> append-only, trigger-enforced double-entry wallet ledger with idempotent order and deposit workflows</li>
        <li><b>Jobs:</b> PostgreSQL-backed queue (pg-boss) and a separate worker</li>
        <li><b>Security:</b> audit log, rate limiting, security headers and Content Security Policy</li>
      </ul>
    </td>
  </tr>
</table>

## Activation limits

These integrations are built to **fail closed**: until each is approved, its code path refuses work and the UI says so honestly.

| Capability | State | What turns it on |
|---|---|---|
| Payments / deposits | Off. No payment processor approved; webhooks return `FEATURE_DISABLED`. | A processor decision, credentials, a sandbox test, then explicit enablement |
| SMM provider fulfilment | Off. No provider adapter is registered. | Supplier verification, SSRF controls, an adapter, then per-service eligibility |
| AI generation | Off. The launch switch stays off until a live provider test passes. | Provider key, priced model, daily budget, then the AI Control Center test |
| Social publishing | Off. No platform adapters. | Each platform's app review, OAuth credentials, then adapters |
| Referral rewards | Off. A database guard blocks reward activation. | Approved reward rules and policy |

Production prerequisites (backups, a trusted proxy with rate and body limits, monitoring, a UTF-8 database) are listed in [`docs/backend/PHASE_5I_B_LAUNCH_READINESS_REPORT.md`](docs/backend/PHASE_5I_B_LAUNCH_READINESS_REPORT.md).

## Tech stack

| Area | Tools |
|---|---|
| App | Next.js 16 (App Router, Turbopack, `cacheComponents`), React 19, TypeScript |
| UI | Tailwind CSS v4, Base UI, lucide icons, Motion |
| Data | PostgreSQL 16+ with Drizzle ORM and SQL migrations; pg-boss for jobs |
| Validation and AI | zod; the Anthropic SDK, behind the AI Control Center |
| Testing | Vitest (unit tests, plus integration tests against real PostgreSQL) |

## Getting started

**Requirements:** Node.js 20.9 or later (developed on Node 24) and npm. Docker isn't needed: `npm run db:local` runs a real local PostgreSQL.

1. **Install and configure:**

   ```bash
   npm install
   cp .env.example .env.local
   ```

2. **Fill in `.env.local`:**
   - **`DATABASE_URL`:** choose your own local user and password. Never commit this file.
   - **`AUTH_SECRET` and `DATA_ENCRYPTION_KEY`:** run `npm run auth:secrets` and paste the two lines it prints.

3. **Start the database and app** (in separate terminals):

   ```bash
   npm run db:local        # local PostgreSQL on port 5433 (keep this terminal open)
   npm run db:migrate      # apply migrations
   npm run db:seed         # reference data only: roles, catalog, ledger accounts
   npm run dev             # http://localhost:3000
   ```

4. **Create the first Owner** (one time):

   ```bash
   npm run auth:bootstrap-owner -- --email you@example.com --name "Your Name"
   ```

In development, emails are captured in the in-app dev mailbox instead of being sent. The full guide is [`docs/backend/BACKEND_SETUP.md`](docs/backend/BACKEND_SETUP.md).

> [!TIP]
> Don't run `npm run build` while `npm run dev` is running: both use `.next/`, and the build pulls files out from under the dev server, which then keeps reloading the page. Stop the dev server first, or restart it after the build.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Next.js development server, production build, production server |
| `npm run typecheck` | TypeScript check (`tsc --noEmit`) |
| `npm run lint` | ESLint |
| `npm test` | All tests. Integration tests create and drop their own scratch databases. |
| `npm run test:unit` / `test:integration` | One test project only |
| `npm run worker` | Background job worker |
| `npm run db:local` | Local PostgreSQL in `./.local/postgres` (development only) |
| `npm run db:generate` | Generate a migration from schema changes |
| `npm run db:migrate` | Apply pending migrations (idempotent; also the production release step) |
| `npm run db:seed` / `db:reset` | Reference data / recreate the schema (**local development only**) |
| `npm run auth:secrets` | Print fresh `AUTH_SECRET` / `DATA_ENCRYPTION_KEY` values |
| `npm run auth:bootstrap-owner` / `auth:reset-mfa` | Operator tools for the first Owner and MFA recovery |

## Database migrations

- **Location:** migrations live in [`drizzle/`](drizzle/) (`0000`–`0018`, the latest two adding Blog Management and custom blog categories), with matching rollback scripts in [`drizzle/rollback/`](drizzle/rollback/).
- **To change the schema:**
  1. Edit `src/server/db/schema`.
  2. Run `npm run db:generate -- --name <change>` and review the SQL.
  3. Run `npm run db:migrate`.
- **Financial history is append-only:** database triggers enforce ledger balance and immutability, and those safeguards must not be weakened.
- **More detail:** [`docs/backend/DATABASE.md`](docs/backend/DATABASE.md).

## Project structure

```
src/
  app/          routes: public site, blog, (auth), dashboard, admin, api/*, media/
  components/   UI: site, blog, dashboard, admin, ai, social, auth, ui primitives
  content/      file-based blog articles
  lib/          shared types, catalog, blog, SEO helpers, i18n, client utilities
  server/       backend: auth, db (schema + client), ledger, orders, payments,
                providers, ai, social, support, referrals, analytics, blog, jobs
  worker/       background worker entry point
  proxy.ts      request proxy (optimistic routing, real 404s, no-store/noindex headers)
public/brand/   official logo collection (web-sized copies in public/brand/web/)
drizzle/        SQL migrations, snapshots and rollbacks
scripts/        database, auth and dev tooling
tests/          unit/ and integration/ (Vitest)
docs/           architecture, security, SEO standards and phase reports
```

## Brand assets

The official artwork lives in [`public/brand/`](public/brand/) and is offered for download on the site's Media Kit (`/media-kit`). Use the files as they are: don't recolour, stretch or redraw them.

<table>
  <tr>
    <td align="center" width="50%"><img src="public/brand/Sociotix_Light_theme_logo.png" alt="Sociotix primary logo" width="260"><br><sub><b>Primary logo</b> · light backgrounds<br><code>Sociotix_Light_theme_logo.png</code></sub></td>
    <td align="center" width="50%"><img src="public/brand/Sociotix_light_mode_stacked_logo.png" alt="Sociotix stacked logo" width="130"><br><sub><b>Stacked logo</b> · square spaces<br><code>Sociotix_light_mode_stacked_logo.png</code></sub></td>
  </tr>
  <tr>
    <td align="center"><img src="public/brand/web/icon-violet-128.png" alt="Sociotix violet icon" width="72"><br><sub><b>Icon, violet</b> · favicon, app icons, avatars<br><code>Sociotix_icon_violet_favicon.png</code></sub></td>
    <td align="center"><img src="public/brand/web/icon-black-128.png" alt="Sociotix black icon" width="72"><br><sub><b>Icon, black</b> · on violet or busy backgrounds<br><code>Sociotix_icon_black_favicon.png</code></sub></td>
  </tr>
</table>

Also included: white-text versions of every logo for dark backgrounds (for example `Sociotix_dark_theme_logo.png`), plus wordmarks and monochrome versions. The site's favicon set (`src/app/favicon.ico`, `public/favicon-32x32.png`, `public/apple-touch-icon.png`, `public/icon-192.png`, `public/icon-512.png`) and the web manifest are generated from the violet icon.

| Colour | Hex | Role |
|---|---|---|
| Electric Violet | `#7047EB` | Primary: actions, highlights and the icon |
| Restrained Lime | `#C8FF52` | Accent, used sparingly |
| Graphite | `#202127` | Text and dark surfaces |

## Security

- **Secrets:** never commit secrets. `.env*` files are git-ignored, except `.env.example`, which holds variable names and safe placeholders only.
- **Server-side checks:** the proxy is not the security boundary. Every page, server action and route handler checks the session and permissions against the database.
- **Blog content:** posts are stored as validated structured content, never raw HTML; uploads are checked by file signature; URL imports refuse private and internal addresses.
- **Reporting:** report security concerns privately to the repository owner rather than in a public issue.

## Documentation

- **Architecture and backend:** [`docs/backend/ARCHITECTURE.md`](docs/backend/ARCHITECTURE.md), [`AUTHENTICATION.md`](docs/backend/AUTHENTICATION.md), [`DATABASE.md`](docs/backend/DATABASE.md), [`SECURITY.md`](docs/backend/SECURITY.md), [`OPEN_DECISIONS.md`](docs/backend/OPEN_DECISIONS.md)
- **Phase reports:** [`docs/backend/PHASE_5A_REPORT.md`](docs/backend/PHASE_5A_REPORT.md) through [`PHASE_5I_B_LAUNCH_READINESS_REPORT.md`](docs/backend/PHASE_5I_B_LAUNCH_READINESS_REPORT.md)
- **AI modules:** [`docs/ai/`](docs/ai/)
- **SEO standards:** [`docs/seo/SEO_STANDARDS.md`](docs/seo/SEO_STANDARDS.md)
- **Repository:** [github.com/THINXIFY/Sociotix](https://github.com/THINXIFY/Sociotix), the official development repository
- **GitHub sync record (initial import):** [`docs/deployment/GITHUB_SYNC_REPORT.md`](docs/deployment/GITHUB_SYNC_REPORT.md)

<p align="center">
  <img src="public/brand/web/icon-violet-128.png" alt="" width="40"><br>
  <sub>© Sociotix. All rights reserved.</sub>
</p>
