# Sociotix Functionality, Navigation & Dropdown Audit

Date: 2026-10-31.

**Scope:**

- every button, link, form and interactive control on the public site, authentication pages, customer dashboard and admin dashboard;
- the dropdown/select redesign (section 8 of the request).

**How it was tested:** on production builds against a scratch database seeded with QA accounts: guest, verified customer, owner (with a real authenticator secret) and Support role. Emails were captured by the development mailbox, never sent. No provider, processor, AI model or social platform was contacted, and no real record was changed.

## 1. Pages and routes audited

| Area | Routes |
|---|---|
| Public | Homepage (marketplace, How it works, order tracking, FAQ, More solutions), AI Tools hub and all 13 tool pages, Social Management, Pricing, Help Center and all 17 articles, the 404 page |
| Authentication | `/login`, `/register` (including `?ref=`), `/forgot-password`, `/reset-password`, `/verify-email`, `/admin/login`, `/admin/mfa` |
| Customer | Overview, New Order, Orders, Add Funds, Transactions, Service Finder, AI workspace (welcome, usage, plans), Social (overview, accounts, publishing and new post, calendar, automations and new automation, campaigns, activity), Support, Referrals, Settings, Profile, Security |
| Admin | Overview, Services, Orders, Providers, Customers, Payments, Support, Referrals, AI Management, Reports, Settings, Staff, Account, and the legacy Analytics URL (which redirects) |

**Sessions used:** guest, customer, owner and Support role, each in the state where a control actually appears.

## 2. Buttons, links and forms tested

| Check | Coverage | Result |
|---|---|---|
| **Links** (every `<a>` in the DOM, at 1440 and 375 px) | 82 route/session combinations × 2 widths. **4,398 links**, **108 unique destinations** requested in the right session. | **0 problems.** No `#`, empty or `javascript:` hrefs, no missing in-page anchors, no 4xx/5xx destinations, no unsafe new-tab links. |
| **Buttons** (every visible button, tab, switch, menu item and summary; fresh page per click) | 45 routes. **672 controls** in 327 distinct components. **391 clicked**, and **380 had an observable effect** (navigation, dialog/menu, ARIA state, DOM change, request, download). 223 repeat siblings of an already-tested component (for example the 118 service cards) were counted rather than clicked. 35 state-changing actions (save, approve, delete, sign out…) were inventoried, not blind-clicked. 22 were disabled. | **12 "no visible effect" items, all explained**, none a defect: 9 already-selected options, 1 file picker, 1 native share sheet, 1 disclosure inside the intentionally locked AI form. See section 3. |
| **Auth journeys** | 47 checks | **47 / 47** |
| **Product journeys and accessibility** (marketplace dialog, ordering safeguards, deposits, help, tickets, referrals, AI/social disabled states, Support-role permissions, skip links, focus, reduced motion, noindex, health) | 43 checks | **43 / 43** |
| **Phone navigation and keyboard** (public menu, customer bottom bar and More sheet, admin drawer, account menus, new-ticket form) | 23 checks | **23 / 23** |
| **Dropdowns** (section 7) | 32 checks | **32 / 32** |
| **Rendered route sweep** (73 routes: old brand text, console errors, overflow at 320 and 375 px in light and dark) | 73 routes × 4 views | **0 issues** |
| **CSP / headers** | 28 checks | **28 / 28** |
| **SEO crawl** (stand-in production origin) | 225 checks | **225 / 225** |

State-changing actions are covered by the integration suite (556 tests): orders, payments, ledger, support, referrals, reports and CSV exports, AI controls and social safeguards. They're also covered by the journey scripts (registration, verification, password reset, ticket creation, admin MFA), not by blind clicking.

## 3. Broken interactions found and fixed

| # | Defect (evidence) | Fix |
|---|---|---|
| 1 | **Header Log In and Sign Up didn't work** on every public page (desktop and the phone menu). They opened a "Log in is coming next" dialog left over from before accounts existed. | Real links to `/login` and `/register` (`src/components/site/header.tsx`). A regression test asserts the links (`tests/unit/navigation.test.ts`). |
| 2 | FAQ **Contact support** and **Help center** opened "opens in the next build phase" dialogs. Three FAQ answers were out of date (they said registration "opens in the next phase", and the payments and support answers were wrong). | Links to `/dashboard/support?new=1` (guests sign in and return) and `/help`. Answers rewritten to match what works today. The support channels show "Support tickets", "Help Center" and "Live chat · planned". |
| 3 | The homepage's example order (order-tracking section) had 5 buttons that opened "preview" dialogs: Update link, View summary, Message support, Request a change, Order FAQ. | Links to the real places: `/dashboard/orders`, `/dashboard/support?new=1`, `/help/order-needs-information` and `/help/order-statuses`. |
| 4 | Footer **Terms of Service**, **Privacy Policy** and **Refund Policy** were buttons that opened "will be published before launch". | Shown as labelled items with a "Soon" tag, like "About". **Writing the policies is a launch blocker** (section 6). |
| 5 | "Suggest a platform" said requests "will open with customer accounts in the next phase". | Honest copy, plus a working **Contact support** action. The default preview text no longer mentions "the next phase". |
| 6 | **Customer "More" sheet** (phone navigation) items were buttons calling `router.push`: they couldn't be opened in a new tab and weren't announced as links. | Real links (`NavTarget`, the same component as the sidebar), with `aria-current`. |
| 7 | Overview page-to-page shortcuts (New Order, Add Funds ×2, Transactions, View orders, Browse all, the order attention action, Get Support) and the account menu's **My Profile** and **Settings** were buttons. | Links and `Menu.LinkItem`s. In-page actions (filters, tabs, pagination, opening a panel) stay buttons. |
| 8 | **New ticket** opened the form but left keyboard focus on the button. | Focus moves to the Subject field when the form opens. |
| 9 | Homepage hero at 320 px: the "Explore Services →" label overflowed its half-width button. | The two calls to action stack below 400 px and sit side by side above that. |

**Not defects** (verified individually, so they're recorded here):

- **Already-selected options:** All services, Cryptocurrency, Page 1, the calendar's Month view (already selected) and "Today" (already the current period), 4w, All (customer support), All (admin referrals), and "Needs reply" (the admin Support default).
- **Other controls:**
  - **Preview photo** opens the file picker.
  - **Share** uses the browser's share sheet, and only appears where the browser supports it.
  - **"More options"** on AI tool pages is inside the form that's locked while generation isn't live; the page explains "Coming soon".

## 4. Login and signup verification

All 47 checks passed:

- **Header entry points:** Log In → `/login` and Sign Up → `/register` from 8 public page types (homepage, pricing, help hub and article, AI hub and tool page, social management, 404) and from the phone menu. Sign Up stays visible on phones without opening the menu.
- **Links between the auth pages:** login ↔ register, and login → forgot password.
- **Customer sign-in:**
  - wrong password shows an error and stays on `/login`;
  - the submit button is disabled while signing in (no double submit);
  - success lands on the dashboard;
  - a signed-in visit to `/login` is sent to the dashboard.
- **Session handling:**
  - Sign out (account menu) lands on `/login`;
  - protected pages redirect with `?next=`, and signing in returns to the requested page;
  - an off-site `?next=` is ignored.
- **Registration from `/register?ref=CODE`:**
  - shows "Check your email" and attributes the referral on the server (not qualified);
  - signing in before verifying shows "Confirm your email first" and sends a new link;
  - the captured verification link confirms the email, and the account then signs in.
- **Password reset:**
  - the request doesn't reveal whether the account exists;
  - the captured "Reset your Sociotix password" link sets a new password;
  - the old password stops working and the new one signs in.
- **Admin:**
  - anonymous `/admin` → `/admin/login`;
  - the correct password leads to the **MFA challenge**, a wrong code is refused, and a real TOTP code opens `/admin`;
  - admin sign-out works and the panel is locked afterwards;
  - a customer session can't open admin.

## 5. Mobile and accessibility findings

- **Widths:**
  - no horizontal overflow on any of the 73 routes at 320 or 375 px in light or dark (route sweep);
  - dropdowns checked at 320, 375, 1280 and 1440 px.
- **Phone navigation:**
  - public menu links reach their sections and close the menu;
  - the customer bottom bar and More sheet navigate;
  - New Order intentionally swaps the bottom bar for its progress bar, and the logo is the way back (verified);
  - the admin drawer navigates and closes.
- **Keyboard:**
  - skip links and focus indicators work (journey suite);
  - account menus open with Enter, move with arrows, and close with Escape, returning focus;
  - dropdowns open with ArrowDown or Enter, select with Enter, and close with Escape, returning focus;
  - the new-ticket form receives focus.
- **Touch:** menu and dropdown rows are 36 px, and **44 px on touch screens** (`pointer-coarse`).
- **Not done:** testing with real screen readers (NVDA, VoiceOver). Automated and keyboard checks don't replace it.

## 6. Intentionally disabled features (clearly labelled)

| Feature | What people see | Why |
|---|---|---|
| Deposits / payments | Add Funds lists methods; once one is chosen it says "No payment processor has been approved … A deposit request isn't a payment", and the request button is disabled | No approved processor |
| Ordering unverified services | "Ordering opens once pricing, fulfilment and compliance … are verified"; no purchase button | Eligibility gates |
| AI generation | Tool forms locked, "Coming soon" | Launch switch off |
| Social account connections and publishing | "Not available yet" states | No approved platform apps |
| Referral rewards | "Rewards coming soon" | Rewards guarded until rules are approved |
| Legal pages, About | "Soon" labels in the footer | Policies must be written and approved before launch |
| More Solutions | Cards tagged "Planned", with an honest dialog | Future offerings |
| Live chat | "Live chat · planned" | Not built |

## 7. Dropdown & select redesign

**Shared component:** `src/components/ui/select.tsx` (`Select`), built from the best admin dropdown and now used everywhere. Admin's `SelectInput` re-exports it.

- **Drop-in for `<select>`:**
  - same `value`/`defaultValue`, `onChange`, `name` (hidden form input, so form submissions keep working), `required`, `disabled` and ARIA props;
  - `<option>`/`<optgroup>` children, and options without `value` use their text, as natively;
  - `onBlur` fires when the list closes, so validation doesn't trigger while choosing.
- **Premium list:**
  - refined border and shadow, 16 px radius, balanced padding;
  - checkmark and bold violet text for the selected option;
  - group labels;
  - hover and keyboard highlight, a disabled state, and a restrained grow/fade transition (none with reduced motion).
- **Positioning:** renders in a portal (never clipped by cards, dialogs or scroll containers), flips and shrinks to stay on screen with 12 px collision padding, and scrolls beyond 24 rem.
- **Searchable long lists:** automatically above 12 options. There's a search field, filtering as you type, and an empty state ("No matches. Try another word.").
- **Custom trigger:** for icon-only controls (the marketplace sort keeps its compact icon on phones and shows the label from `sm`).

**Native selects replaced:** **26**, covering:

- marketplace sort, AI service search platform, AI order explanation;
- New Order configuration fields;
- orders, support and transactions filters (the demo views);
- Service Finder filters;
- profile country, timezone and business country;
- dashboard settings preferences;
- referrals sort;
- support ticket order link;
- social automation builder, campaign objective and budget, studio sort;
- admin Support (reply-after, status, priority, assignee).

Every dropdown in the product is now the shared component, or a Base UI menu or popover with the shared styles.

**Menus:**

- **Shared styles:** `src/components/ui/menu.ts` (`popupSurface`, `menuPopup`, `menuItem`, `menuItemDestructive`, `menuLabel`, `menuSeparator`) is used by admin, the customer account menu and the customer notifications panel. The customer menus previously used their own simpler styles, with no disabled state or touch sizing.
- **Destructive styling:** **Sign out** is marked destructive (red) in both account menus.

**Verified (32/32):**

- marketplace sort at 1440/375/320 px, light and dark: on screen and in front, sorts the grid A–Z, keyboard open/Escape/focus return, no overflow;
- Service Finder filter by keyboard;
- admin reporting timezone at 1280 and 375 px, light and dark: search field, empty state, filtering, selection marks unsaved changes. On phones it opened upward when there was more room;
- customer settings at 375 px, dark;
- the new-ticket order dropdown is on screen, and Escape keeps the draft;
- admin reports Status filter in dark mode filters the table;
- account menus: row size and destructive Sign out.

**Regression tests:** `tests/unit/select.test.ts` (5) covers label in the trigger, text-as-value, form hidden input, the searchable switch and the custom trigger.

## 8. Test results and exact coverage

| Check | Result |
|---|---|
| Typecheck, lint | Pass, 0 problems |
| Production build | Pass (normal, and with `APP_URL=https://www.sociotix.example`) |
| Vitest | **556 / 556** in 51 files. New: `navigation.test.ts` (3) and `select.test.ts` (5). |
| Browser suites (final build) | Links 4,398 / 0 problems · route sweep 73 / 0 issues · auth 47/47 · journeys 43/43 · phone and keyboard 23/23 · dropdowns 32/32 · CSP 28/28 · SEO 225/225 |
| Button click audit | 672 controls on 45 routes, as in section 2 |

**Honest coverage notes:**

- **The button click audit ran on the build before the dropdown conversion.** The converted dropdowns and the link-ified navigation were then verified on the final build by the dropdown, phone and keyboard, journey, link and route suites.
- **Not every repeated sibling was clicked:** 223 were represented by a tested button of the same component.
- **State-changing actions weren't blind-clicked;** they're covered by integration tests and the journeys.
- **No real screen reader** was used.

## 9. Outstanding issues

- **Launch blocker:** Terms of Service, Privacy Policy and Refund Policy pages need real, approved content.
- **Screen readers:** testing with NVDA and VoiceOver is recommended before launch.
- **Re-running the click audit:** optionally on the current build, at the same 2-per-component depth.
- **Integrations:** all remain disabled pending separate approvals (payments, AI generation, supplier fulfilment, social publishing, referral rewards).
