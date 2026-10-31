# Sociotix Terms of Service: report

**Route:** `/terms`. **Status: PUBLISHED in code** after owner approval on 2026-10-31. Nothing was committed, pushed or deployed.

## Owner approval (2026-10-31)

- **Text:** approved.
- **Governing law:** "the laws of Pakistan, and any disputes will be handled by the courts of Pakistan".
- **Liability limit:** "the amount you paid Sociotix in the 12 months before the claim".
- **Effective date:** 1 November 2026.

**What changed on publication:**
- `TERMS.status: "published"`.
- `/terms` is indexable, in the sitemap and linked from the footer.
- The six refund-policy URLs now permanently redirect to `/terms#refunds-and-cancellations`.

**After publication (actual):**

| Check | Result |
|---|---|
| Typecheck, lint | Pass |
| Unit tests | 223 / 223 |
| Builds | Stand-in and normal both pass |
| `/terms` suite | **159 / 159** (published) |
| Rendered sentences | The governing-law and liability sentences match exactly |
| `/privacy` suite | **182 / 182** |
| Sitewide SEO crawl | **270 / 270** (37 sitemap URLs, including `/terms` and `/privacy`) |

**Still recommended:** a legal review, particularly of contracts with minors (no minimum age), the "as is" exclusions under Pakistani consumer law, and the no-cash-withdrawal wallet rule. The approval notes and blockers below are kept as a record.

## Changes

| File | Change |
|---|---|
| `src/components/legal/legal-page.tsx` | **New shared legal-page module**, extracted from the Privacy Policy: hero, review banner, "at a glance" summary, sticky contents and phone index, numbered sections with "In short" answers, contact card, text primitives. Privacy Policy and Terms both use it. |
| `src/components/legal/privacy-policy.tsx` | Refactored onto the shared module. Content unchanged (verified: 182/182). |
| `src/components/legal/terms-of-service.tsx` | **New Terms page**: Terms at a glance plus 11 sections |
| `src/app/terms/page.tsx` | Route, metadata, JSON-LD (WebPage + BreadcrumbList), production 404 while in draft |
| `src/lib/legal/terms.ts` | Publication gate and owner-only details. Business name and contact come from the Privacy Policy config, so the two pages can't disagree. |
| `src/components/site/footer.tsx` | **"Refund Policy" removed.** Legal links are now Terms of Service and Privacy Policy only. Terms becomes a link once published (until then it shows "Soon"). Privacy is already linked. |
| `src/app/sitemap.ts` | Adds `/terms` once published |
| `next.config.ts` | Once Terms are published, `/refund`, `/refunds`, `/refund-policy`, `/return-policy`, `/returns` and `/return-refund-policy` permanently redirect to `/terms#refunds-and-cancellations`. No refund route ever existed. |
| `tests/unit/seo.test.ts`, `tests/unit/navigation.test.ts` | Terms gate, metadata, sitemap and production-404 tests. The footer test now requires no refund item, and Terms/Privacy are links exactly when published. |

**Sections:**
1. About these terms
2. Your account
3. Age and younger users
4. Social media services
5. Orders, wallet and payments
6. **Refunds and cancellations** (stable anchor `#refunds-and-cancellations`)
7. AI tools
8. Acceptable use
9. Privacy and third-party services
10. Our responsibilities and liability
11. Changes and contact

## Accuracy: rules taken from the implementation, not invented

| Term | Source |
|---|---|
| Cancel while Awaiting review or Needs your information, with a full return to the wallet | `cancelOwnOrder` / `CUSTOMER_CANCELLABLE`; Help article "Can I cancel an order?" |
| Rejected, or cancelled by staff before work starts: full return to the wallet | `orders.ts` (staff cancellation, rejection) |
| Failed before work: full return. Failed after work started: reviewed | `failOrder` |
| After work has started, refunds are reviewed and never automatic | Help article "refunds-and-cancellations" |
| Refunds go to the wallet, never to a card, and never exceed the amount paid | `payments/adjustments.ts` (trigger SV004). Refunds are currently **switched off** (`REFUNDS_ENABLED = false`), so the terms say "approved refunds", not that refunds are processed today. |
| No cash withdrawal of the wallet balance | No withdrawal or payout code exists |
| Payments not active; no placeholder prices | `payments/methods.ts`; FAQ |
| Ordering opens per service after pricing, fulfilment and compliance checks | Homepage FAQ, catalog |
| Results never guaranteed; follow platform rules | Catalog and FAQ copy |
| AI tools not active, allowances reset at midnight UTC, AI can't post, order or move money | AI registry and FAQ |
| No minimum age, no age checks; younger users need a parent or guardian, who accepts on their behalf | Owner decision; matches the Privacy Policy |

**Statements deliberately avoided:**
- guarantees;
- refund time windows;
- chargeback rules;
- invented fees;
- dispute venues;
- arbitration;
- compliance claims.

## Requires owner and legal approval (publication blockers)

1. **Governing law and dispute venue** (`TERMS.governingLaw`): shown as a marker in §10.
2. **Liability limit** (`TERMS.liabilityCap`): shown as a marker in §10. For example "the amount you paid Sociotix in the 12 months before the claim".
3. **Effective date** (`TERMS.lastUpdated`): set on approval, never earlier.
4. **Legal review of:**
   - **Contracts with minors.** "No minimum age" means minors may enter paid contracts. The terms require a parent or guardian to accept on their behalf, but nothing enforces this; the same gap is in the Privacy report.
   - **Account suspension and termination wording.**
   - **"As is" disclaimers and exclusions.** These depend on consumer law in your markets.
   - **No cash withdrawal of the wallet.** This is a business rule to confirm, and some jurisdictions regulate stored balances.
5. **Before refunds are enabled:** the terms already describe them as reviewed and paid to the wallet, but any refund timeframes or criteria must be added on approval.

**How the gate works:** `termsPublished()` needs `status: "published"`, a date, the governing law, the liability limit and a published Privacy Policy. Until then the page is noindex, out of the sitemap, unlinked, 404 in production, and the refund URLs don't redirect.

## Test results (actual)

| Check | Result |
|---|---|
| Typecheck, lint (`eslint .`) | Pass |
| Unit tests | **223 / 223** |
| Production builds | Pass: draft (stand-in `https` APP_URL), the published simulation and the final normal build. No test values remain in source or build output. |
| `/terms` suite (draft) | **161 / 161**, covering: title, description, canonical, noindex, banner, no early date, exactly 2 owner markers; 15 implemented-rule statements present; no guarantees, refund windows, live-payment or AI claims, or compliance claims; refund anchor; JSON-LD; footer without Refund Policy, Terms "Soon", Privacy linked; not in the sitemap; internal links resolve; refund URLs 404 while in draft. Then at 320, 375 (reduced motion), 768, 1024 and 1440 in light and dark: no overflow, sidebar vs keyboard index, reading width, 7 glance and 11 contents links resolve, headings land below the header, no third-party requests, no cookies, no console errors. |
| `/terms` published simulation (temporary fake values) | **159 / 159**, plus a browser check: indexable, no markers, footer link, in the sitemap, and all 6 refund URLs **308** to `/terms#refunds-and-cancellations`, landing on the heading |
| `/privacy` after the shared-component refactor | **182 / 182** (unchanged) |
| Sitewide SEO crawl | **263 / 263** (36 URLs) |

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
