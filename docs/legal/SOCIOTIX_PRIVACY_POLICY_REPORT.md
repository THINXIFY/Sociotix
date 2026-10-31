# Sociotix Privacy Policy: implementation and review report

**Route:** `/privacy`. **Status: PUBLISHED in code on 2026-11-01** after owner approval (see §0).

The page is indexable, in the sitemap and linked from the footer. Nothing was committed, pushed or deployed.

## Revision 2: plain-English rewrite (approved and published 2026-10-31, effective 2026-11-01)

**Content and UX:**
- **Structure:** 16 sections became **10** plain-English sections, with a **Privacy at a glance** summary (7 linked points) at the top.
- **Tables:** all three removed. Cookies are now a short list. The required disclosures are kept: accounts, cookies, security, AI, payments, social, third parties, retention, rights, children and contact.
- **Page furniture:** the "In short" answers, the sticky contents list and the phone index are kept.

**Facts re-verified in code:**
- Redaction covers emails, phone, card and IBAN numbers, and secrets (`ai/redact.ts`).
- AI never reads connected-account data: the AI workspace only counts connections.
- YouTube requests only `youtube.readonly`.
- Disconnect deletes tokens immediately, and the platform's revoke endpoint is called.
- No tracking scripts and no other cookies.

**Google review** (fetched from the official pages on 2026-10-31):
- **API Services User Data Policy:** disclose all Google data accessed, used, stored, deleted or shared, and the purpose. Limited Use bans ads, sale and data brokers and restricts human access. No affirmative statement is mandated word for word.
- **YouTube API Services Developer Policies:**
  - privacy policy contents (III.A): YouTube Terms of Service link, Google Privacy Policy link, disclosure of API use, the `security.google.com/settings/security/permissions` revocation link, cookies, and a contact;
  - storage (III.E.4): refresh or delete every 30 days;
  - deletion: within 7 days of an in-app revocation or a deletion request, and within 30 days of a revocation made through Google.

  The new "YouTube and Google user data" subsection covers each item, and every one is checked in the browser suite. It's marked **Not active yet** and states that Sociotix isn't affiliated with or endorsed by Google.

**YouTube launch blockers (implementation gaps, not policy text):**
1. On disconnect, delete the stored channel name, handle and metrics within 7 days. Today the row keeps them.
2. Add a 30-day re-authorization check that refreshes or deletes YouTube data.
3. Handle revocation made through Google within 30 days.
4. Add a deletion-request path that meets 7 days.
5. YouTube III.A.2 requires users to **agree to the privacy policy before using the API features**. Sign-up has no agreement step.

**Children (owner decision: no minimum age).** The section now explains parental involvement in plain English and says honestly that Sociotix has **no age checks or parental-consent tools yet**. It asks under-13s and under-digital-consent-age users to have a parent or guardian set up and look after the account, flags money features and platform age rules for teens, and commits to deleting data collected without the consent the law requires. No compliance claim is made.

Gaps for lawful under-13 and under-16 use, which need owner approval to build:
- **Age assurance:** at minimum an age or birth-year question at sign-up.
- **Verified parental consent (COPPA):** where under-13s are knowingly served.
- **EU Art. 8 consent:** parental consent below the member-state age (13–16).
- **UK Children's Code:** high-privacy defaults and a data protection impact assessment (DPIA) if children are likely to use the service.
- **Restrictions for minors:** possibly limiting paid orders, the wallet and social connections.
- **Legal advice.**

**Contact.** A DNS check on 2026-10-31 found **no records for `sociotix.com`** (no MX), so mail to hello@sociotix.com would bounce that day. The owner confirmed the inbox works, or will, and asked to publish. A new `contactVerified` gate field records this confirmation. **Confirm the inbox before launch.**

**Status.** It went back to review while the text was rewritten, then the owner published it on 2026-10-31:
- `status: "published"`;
- `lastUpdated: "2026-11-01"`, as the owner chose;
- indexable, in the sitemap and linked from the footer.

**Tests (actual):**

| Check | Result |
|---|---|
| Typecheck, lint | Pass |
| Unit tests | 220 / 220 |
| Production builds | Pass (stand-in and normal config) |
| Published `/privacy` suite | **182 / 182**: structure, all 16 Google/YouTube disclosure items, children wording, accuracy bans, published safeguards, plus the 5-width × 2-theme layout, contents, glance links, keyboard, no third-party requests and no cookies |
| Sitewide SEO crawl | **263 / 263** (36 URLs) |

## 0. Owner approval (first text; approved 2026-10-31, effective 2026-11-01)

**Approved by the owner:**
- the policy text;
- controller **"Sociotix"**;
- contact **hello@sociotix.com**;
- **no minimum age** ("every age");
- **no business address yet** (email-only contact);
- effective date **1 November 2026**.

The owner also chose **honest neutral wording** for the details not yet decided. No facts were invented:
- **Laws:** "which privacy laws apply depends on where you live".
- **Providers:** the AI, hosting and email providers are to be **"named here before AI tools / Sociotix launch"**, and data locations **"listed before Sociotix launches"**.
- **Retention:** criteria-based (while your account is open; financial records for as long as tax and accounting laws require; support and security logs as long as needed, then deleted).

**What changed on publication:**
- **Gate:** `privacyPolicyPublished()` now treats the address as optional and accepts `minimumAge: "none"`.
- **Contact:** the contact card drops its address row when no address is set.
- **Email:** all five mentions are mailto links.
- **Children's section:** rewritten for the no-minimum-age decision. It says honestly that Sociotix sets no minimum age and doesn't ask for or verify age, asks children to use it only with a parent's or guardian's permission, notes the social platforms' own age rules, and gives parents a deletion route.

### Risks the owner accepted, recommended for follow-up

1. **No minimum age.** Sociotix has **no age gate, age verification or parental-consent mechanism**. Where children's data laws apply, this is a significant compliance risk:
   - **US:** COPPA requires verifiable parental consent to collect personal information from under-13s.
   - **EU/UK:** GDPR Art. 8 and the UK Age Appropriate Design Code apply consent ages of 13–16 for online services.
   - **Contracts and payments:** paid orders and wallet deposits involve contracts that minors may not be able to enter.
   - **Platform rules:** Instagram, TikTok, YouTube and others require users to be 13+.

   **Recommendation:** set a minimum age (18+ fits a paid service) and add an age confirmation at sign-up, or get legal advice before accepting children's accounts.
2. **No postal address.** EU/UK transparency rules (GDPR Art. 13) expect the controller's identity and contact details, and many regulators expect a postal address. Add one to `controllerAddress` when available; the contact card will show it automatically.
3. **"Sociotix" as the controller name.** If Sociotix is a trading name, the legal person (company or sole trader) behind it should be named when one exists.
4. **hello@sociotix.com.** The README says the `sociotix.com` domain is used only once ownership is confirmed. Make sure this inbox exists and is monitored before the site goes live. It's also a general inbox; a dedicated privacy address is optional.
5. **"Named before launch" commitments.** Update §6, §9 and §12 with the real providers and data locations before Sociotix goes live, and bump `lastUpdated`.

## 1. What was implemented

**Files:**

| File | Purpose |
|---|---|
| `src/lib/legal/privacy.ts` | Publication gate and the owner-supplied details: status, last-updated date, legal entity, address, privacy email, minimum age |
| `src/components/legal/privacy-policy.tsx` | The policy page (server component, no client JavaScript) |
| `src/app/privacy/page.tsx` | Route, metadata, JSON-LD, production 404 while in draft |
| `src/app/sitemap.ts` | Adds `/privacy` only once it's published |
| `src/components/site/footer.tsx` | The footer's "Privacy Policy" item becomes a real link only once published; until then it keeps its "Soon" label |
| `tests/unit/seo.test.ts` | Tests for the gate, metadata, sitemap and the production 404 |

**How the draft and publish gate works:**

| State | Outside production | Production | Sitemap | Footer | Robots |
|---|---|---|---|---|---|
| Draft (current) | Renders, with a visible draft banner | **404** | Excluded | "Soon", no link | `noindex, nofollow` |
| Published | Renders | Renders | Included | Crawlable `<a href="/privacy">` | Indexable |

`privacyPolicyPublished()` returns true only when `status: "published"` **and** all five details are set. So the policy can't be published with blank entity, contact, date or age fields, even if someone flips only the status.

**Design:**
- **Hero:** a "Privacy Policy" label, the H1 "Your Privacy Matters.", a plain-English subtitle, and a metadata row: last updated (currently "Draft, not yet published", never an invented date), scope, and a contact link.
- **Desktop:** a two-column layout. A sticky, numbered "On this page" contents list sits on the left; the policy sits on the right at a comfortable reading width (about 740px).
- **Below 1024px:** the sidebar is replaced by a compact native `<details>` index that works with the keyboard and needs no JavaScript.
- **Each section has:**
  - a numbered H2 with a hover/focus anchor link;
  - an "In short:" summary callout, which gives a direct, answer-first sentence (AEO);
  - the detail underneath.
- **Tables:** purposes and legal bases, cookies, and sharing are true `<table>`s that turn into labelled stacked rows on phones, with no horizontal scrolling.
- **Status chips** ("Not active yet", "Switching on per platform") mark features that aren't live.
- **Owner-approval markers:** missing details render as amber **REQUIRES OWNER APPROVAL** markers inside the text.
- **Contact:** a dedicated privacy-contact card closes the page.
- **Styling:** restrained violet accents, light and dark themes, focus rings on every link.

## 2. Verified data-processing inventory

These practices were verified in code on 2026-10-31. Only what the implementation supports is stated in the policy.

| Area | What's processed today | Evidence |
|---|---|---|
| **Account** | Name, email, password as an **Argon2id** hash, email-verified time, status | `users` table; `server/auth/password` |
| **Profile** | First, last and display name, country, account type, business name, website, phone (optional); time zone and notification preferences | `customers`, `customerPreferences`, `notificationPreferences` |
| **Two-step verification** | TOTP secret (encrypted) and recovery codes; mandatory for staff | `mfaFactors` (`secretCiphertext`), `mfaRecoveryCodes` |
| **Sessions** | Token stored as a **SHA-256 hash**; IP address (only when `TRUST_PROXY_HEADERS` is on) and user agent. Customers: 30 days maximum, 7 days idle. Staff: 12 hours maximum, 30 minutes idle | `sessions`, `SESSION_POLICY`, `clientInfo()` |
| **Cookies** | `sv_session` and `sv_staff` (`__Host-` variants on HTTPS), HttpOnly, SameSite=Lax, Secure on HTTPS. **No other cookies.** | `server/auth/sessions.ts` |
| **Browser storage** | Theme and UI preferences (localStorage); in-progress form state (sessionStorage, in new order and service finder) | `grep localStorage/sessionStorage` |
| **Analytics and tracking** | **None.** No GA, Tag Manager, Ads, Meta Pixel or other tracking scripts, and no `next/script` third-party loads | Repo-wide search; browser test confirmed no third-party requests |
| **Fonts** | `next/font/google`, downloaded at build time and served from Sociotix's own origin, so no runtime requests to Google | `app/layout.tsx`; browser test |
| **Orders** | Service, quantity, target link, price, status, milestone events | `orders`, `orderEvents` |
| **Wallet** | Append-only, trigger-enforced ledger | `ledger*` tables |
| **Deposits** | Amount, currency, method, status, processor reference. **No processor active**; card details are never stored by Sociotix | `deposits`, `payments/methods.ts` |
| **Referrals** | Referrer/referee link and code; **rewards disabled** | `referrals`, `referralCodes` |
| **Support** | Ticket messages, linked orders, events; staff internal notes | `tickets`, `ticketMessages`, `ticketInternalNotes` |
| **Attachments** | Table exists, but **no upload path is implemented** | `attachments` table, no writer |
| **Email** | Outbox stores recipient, template and data. Transport is `capture` in development; production requires Resend or Postmark (**not chosen**) | `emailOutbox`, `env.ts` |
| **AI** | **Generation disabled.** When live, briefs are **redacted** (emails, long numbers, account numbers, secrets) and **not stored**. Usage rows hold tool, status, provider, model, character/token counts, cost, latency, plus an **HMAC** of the account ID (or IP for anonymous use). An AI profile (persona, goals) is stored if onboarding is completed. Providers configurable: Anthropic or OpenAI (env), plus a Gemini adapter in the admin control center | `ai/redact.ts`, `ai/run.ts`, `aiUsageEvents`, `aiProfiles`, `env.ts` |
| **Social** | **No platform connectable yet.** When enabled: OAuth, read-only; profile name, handle, URL, scopes, metrics; **access and refresh tokens encrypted**; disconnect deletes tokens and requests revocation. Drafts, calendar and automations are stored | `socialConnections` (`*Ciphertext`), `socialPosts`, `automations` |
| **Security log** | Actor, action, target, before/after values, IP, user agent | `auditLog` |
| **Rate limits** | Keyed by user or customer ID, email (for email sends), or the AI usage hash | `rate-limit.ts` callers |
| **Account deletion** | **Not implemented**: the settings page shows a disabled "Request deletion" preview | `dashboard/settings.tsx` |
| **Data export** | **Not implemented** | Repo-wide search |
| **Retention jobs** | **None found**: sessions expire by time limit, but no purge or retention schedules exist | Repo-wide search |

## 3. Draft policy sections

1. Introduction and who we are
2. Information you give us
3. Information collected automatically
4. How we use information and our legal bases (table)
5. Cookies and similar technologies (table)
6. AI tools and your prompts
7. Social media connections (including the YouTube/Google user data subsection)
8. Orders, payments and your wallet
9. Service providers and sharing (table)
10. How we protect your information
11. How long we keep information (including deleting your account)
12. International data transfers
13. Your privacy rights
14. Children's privacy
15. Changes to this policy
16. Contact us about privacy

**Statements deliberately avoided:**
- "We never share data". Instead it says: "we don't sell personal information or share it for advertising".
- Any GDPR, CCPA or other compliance claim.
- Certifications.
- Fixed retention periods.
- An invented entity, address, email or date.
- Any "unbreakable" encryption guarantee.

## 4. Google-related findings

- **Analytics, Ads and remarketing:** none installed, so there's no Google Analytics or Ads disclosure and no consent banner. The policy states that no analytics, advertising, remarketing or third-party cookies are used.
- **Consent:** only strictly necessary cookies and user-requested preference storage are used, so a consent banner isn't required for them under common EU/UK rules (owner's counsel to confirm for the chosen markets). The policy commits to asking first if non-essential tracking is ever added. No fake banner was added.
- **Google sign-in:** not implemented, so it isn't described.
- **YouTube (Google OAuth), planned:** the policy includes a subsection, marked as applying "once YouTube connections are switched on", which:
  - references the YouTube Terms of Service and the Google Privacy Policy;
  - states adherence to the Google API Services User Data Policy, including Limited Use;
  - links to the Google Account permissions page for revocation.

  **These requirements reflect Google's published policies as known at drafting time, but weren't re-fetched in this session. Re-check them against the current YouTube API Services Developer Policies during YouTube app review.**
- **Gemini:** an adapter exists in the AI control center. If Google is chosen as an AI provider, name it in §6 and the sharing table.

## 5. Legal requirements needing review

- **Which laws apply** depends on where Sociotix operates and whom it serves (for example EU/UK GDPR, US state privacy laws). The draft uses neutral wording ("depending on the laws that apply to you") and marks "markets served and applicable laws" for owner approval.
- **Legal bases** (§4) are drafted for GDPR-style regimes; counsel should confirm them.
- **EU/UK representative or DPO:** may be required depending on establishment and scale. Not included.
- **US state law disclosures** (categories, "sale or share", sensitive data, Do Not Sell/Share links): not included pending the market decision. The draft states that data isn't sold or shared for advertising, which the owner must confirm as policy.
- **Breach notification:** the draft says "where the law requires" and gives no timeframe.
- **Response deadlines** for rights requests: "within the time the law requires", with no number invented.
- **Payment, AI and SMM fulfilment provider terms:** name each provider and link its policy before it goes live.

## 6. Missing business and contact details: REQUIRES OWNER APPROVAL

| Detail | Where it's used | Config field |
|---|---|---|
| Legal business name (controller) | §1, §16 | `controllerName` |
| Registered/postal address | §1, §16 | `controllerAddress` |
| Monitored privacy email | §11, §13, §16 | `privacyEmail` |
| Minimum account age | §14 | `minimumAge` |
| Effective date of the approved text | Hero "Last updated" | `lastUpdated` |
| Markets served and applicable laws | §4 | Edit the text |
| AI provider name(s) and terms links | §6 | Edit the text |
| Hosting/database provider and location | §9, §12 | Edit the text |
| Email delivery provider (Resend or Postmark) | §9 | Edit the text |
| Retention periods (after closure; financial; support and security logs) | §11 | Edit the text |
| International transfer safeguards | §12 | Edit the text |

`SUPPORT_CONTACT_EMAIL` exists in the environment schema, but it is a support inbox, not a verified privacy contact, so it wasn't used.

## 7. SEO, AEO, GEO and accessibility

- **Metadata:**
  - Title: `Privacy Policy | Sociotix`.
  - Description: 159 characters.
  - Canonical: `/privacy`, resolving against `APP_URL`.
  - Open Graph and Twitter cards.
- **Draft safeguards:** `noindex, nofollow`, no sitemap entry and no footer link while in draft. All three flip automatically on publication (verified, §8).
- **Headings and rendering:** one H1 and 16 H2s (with H3s for subsections). All text is server-rendered; the route is ◐ partial prerender.
- **Structured data:** `WebPage` and `BreadcrumbList` only. No FAQ or other rich-result markup.
- **AEO:** the "In short:" lines give direct answers to common questions (Does Sociotix track me? What cookies? What happens to my AI prompts? Can Sociotix post to my accounts? How do I delete my account?).
- **Semantics:**
  - Landmarks: `main`, a labelled `nav` for the contents, and an `article`.
  - Each section is `aria-labelledby` its heading.
  - Tables have captions and column headers.
  - External links use `rel="noopener noreferrer"` and announce "opens in a new tab".
- **Accessibility:** keyboard-reachable heading anchors with visible focus, and body text contrast at or above 4.5:1. Smooth scrolling is disabled under reduced motion by the existing global CSS.

## 8. Tests and results (actual)

| Check | Result |
|---|---|
| Typecheck | Pass |
| Lint (`eslint .`) | Pass |
| Unit tests | **220 / 220** (4 new privacy tests: the publish gate refuses incomplete details; the draft is noindex and out of the sitemap; title, canonical and description; **404 in production while in draft**) |
| Production builds | Pass (draft, with stand-in `https` APP_URL); pass (temporary "published" build with obviously fake test values); pass (final draft build, normal config) |
| `/privacy` suite (production build) | **141 / 141**, covering: draft safeguards; title, description and canonical; 16 sections; markers present and no invented email or date; no compliance or certification claims, "never share" or fixed retention periods; 12 verified facts stated; JSON-LD types; sitemap and footer exclusion; external link safety. Then at 320, 375 (reduced motion), 768, 1024 and 1440 in light and dark: no horizontal overflow, sidebar vs keyboard-operable index, reading width, all 16 contents links resolve, headings land just below the header, **no third-party requests**, **no cookies set for visitors**, no console errors. Plus keyboard focus visibility, heading anchors and contrast. |
| Published-state simulation (temporary build) | **8 / 8**: indexable, no draft banner, no markers for configured fields, `<time>` date, mailto contact, in the sitemap, crawlable footer link. The draft config was restored and the build output was rebuilt as a draft; no test values remain in source or build output. |
| Sitewide SEO crawl | **256 / 256** (35 sitemap URLs; `/privacy` correctly absent while in draft) |

**Two issues found during testing:**
- **Real layout defect, fixed:** section headings landed about 170px below the header, because the per-section `scroll-mt` stacked with the site-wide `scroll-padding-top`. Removing the per-section margin fixed it.
- **Test timing, corrected:** the check for the anchor link's fade-in and the scroll settling had timing assumptions. They're now state-based.

### After publication (2026-11-01)

| Check | Result |
|---|---|
| Typecheck, lint | Pass |
| Unit tests | **220 / 220**. The privacy tests now cover: the gate (address optional, `minimumAge: "none"` accepted, missing date, name, email or age blocks publishing); the owner-approved values; indexable and in the sitemap; served in production. |
| Production builds | Pass (stand-in `https` APP_URL), and pass (normal config) |
| `/privacy` suite (published state) | **148 / 148**: indexable, no draft banner, approved date as `<time>`, **zero owner-approval markers**, the only email shown is hello@sociotix.com and all 5 mentions are mailto links, controller Sociotix with no address row, honest children's wording, "named before launch" providers, criteria-based retention, in the sitemap, crawlable footer link (Terms and Refund still "Soon"), plus the full responsive, contents, keyboard, no-tracking and no-cookie matrix at 5 widths in light and dark |
| Sitewide SEO crawl | **263 / 263** (36 sitemap URLs including `/privacy`; 43 internal links) |

## 9. Publication blockers (original draft list; resolved by owner approval)

The owner approved the text and supplied the details on 2026-11-01. The items below are kept as a record. Items 3–4 were resolved with neutral wording and the deletion-by-email route. See §0 for the accepted risks and follow-ups.

1. **Owner and legal approval** of the policy text, in particular the legal bases, the "we don't sell or share for advertising" commitment, the market-specific disclosures and the breach and rights wording.
2. **Fill in** `controllerName`, `controllerAddress`, `privacyEmail`, `minimumAge` and `lastUpdated` in `src/lib/legal/privacy.ts`.
3. **Replace every in-text REQUIRES OWNER APPROVAL marker:** markets and laws, AI provider(s), hosting provider and location, email provider, retention periods and transfer safeguards.
4. **A working deletion route:** decide how deletion requests are handled until self-service deletion exists. The policy currently directs them to the privacy email.
5. **Then** set `status: "published"`, rebuild, and verify that `/privacy` is indexable, in the sitemap and linked from the footer (the published-state check in §8 shows exactly what to expect).
6. **Before enabling YouTube, an AI provider, a payment processor or SMM suppliers:** update §6–§9 with the named provider, and re-verify Google's current API policy requirements for YouTube.

## All-ages update (2026-10-31)

The owner requires Sociotix to be open to users of all ages, so no blanket minimum age of 13, 16 or 18 applies.

**Both legal pages now say:**
- Sociotix welcomes users of all ages.
- Where the law requires it, younger users need a parent or guardian involved.
- Social platforms, and payment providers once payments are available, set their own age requirements.
- Sociotix has **no age checks or parental-consent tools yet**. No such mechanism is claimed.

**Section names:** the age sections are now "Users of all ages" in both pages; the anchors `#children` and `#age` are unchanged.

**Removed:** contradictory wording, namely the Terms line "only with a parent's permission… (often 18)" and the Privacy heading "Under 13…".

**Legally required safeguards before children's features are offered (flagged, not built):**
- **US (COPPA):** if Sociotix knowingly collects data from under-13s, or is directed to them, it needs verifiable parental consent before collection, a parent-access/delete flow, and data minimisation.
- **EU/UK GDPR Art. 8:** where processing relies on consent, parental authorisation is needed below the member state's age (13 to 16), with reasonable efforts to verify it.
- **UK Children's Code:** if children are likely to use Sociotix, it needs high-privacy defaults, a data protection impact assessment (DPIA), proportionate age assurance and no nudge techniques.
- **Contracts and payments:** minors' capacity to contract varies, including under Pakistan's Contract Act 1872. Paid orders and the wallet should require a parent or guardian, or an age gate, before payments go live.
- **Social connections:** platforms require users to be 13+. The connection flow should check this before linking accounts.

**Tests (actual):**

| Check | Result |
|---|---|
| Typecheck, lint | Pass |
| Unit tests | 223 / 223 |
| Production builds | Pass |
| `/privacy` suite | **184 / 184** (new all-ages checks, including "no blanket minimum age stated") |
| `/terms` suite | **162 / 162** (new all-ages statements, no "often 18" or 13+/16+/18+) |
| Sitewide SEO crawl | **270 / 270** |
