# Sociotix About page redesign

**Route:** `/about`. **Status:** implemented and verified locally. Not committed, pushed or deployed.

This report covers the whole About page: the first build (structure, SEO, navigation) and the redesign of its first three sections. A separate `SOCIOTIX_ABOUT_PAGE_REPORT.md` was planned for the first build but was superseded by this one before it was written.

## Creative direction

**Idea:** "Where social growth comes together." The page tells one story: social growth today is scattered, and Sociotix brings it into one account.

**Rhythm:** sections alternate light and dark, so no two neighbours share a layout or tone.

| # | Section | Tone | Composition |
|---|---|---|---|
| 1 | Hero | Light | Editorial headline + interactive ecosystem orbit |
| 2 | Who we are | Graphite `#17181d` | Manifesto headline + mission + before/after ledger |
| 3 | What we do | Light | Asymmetric product showcase with product-inspired visuals |
| 4 | Why Sociotix | Near-black `#0b0c10` | Feature bento (kept, refined) |
| 5 | FAQ + final CTA | Light, then a graphite CTA panel | Accordion + session-aware CTA (kept, refined) |

The page has exactly five sections, with no extra promotional blocks.

## Redesigned sections

### 1. Hero

- **Headline:** "Where social growth / *comes together.*" It sits on two lines from 640px up and wraps naturally on phones. The second line is violet with a hand-drawn lime underline (inline SVG).
- **Supporting copy:** a one-paragraph introduction, then one primary CTA, **Explore the platform** (to `/`), and a quiet "Our story" anchor link.
- **Facts strip:** three real figures: services listed, platforms (both from `CATALOG_TOTALS`) and "4 products, one account".
- **Ecosystem orbit** (original visual):
  - A graphite Sociotix core with a soft pulse ring.
  - Three concentric rings. Six real platform tiles orbit the core, and each tile stays upright as it orbits.
  - Two signal dots travel the outer ring in the opposite direction.
  - The four products (Marketplace, Sociotix AI, Social workspace, Automation) are pinned to the corners. Each is wired to the core by an animated dashed connection and shows a status dot: lime for available, grey for coming soon.
- **Interaction:**
  - The product nodes are real links inside `nav[aria-label="Sociotix products"]`.
  - Hovering or focusing a node lights up its connection, using CSS `:has()` with no JavaScript.
  - Pointer parallax moves two depth layers (6px and 14px). A 30-line client component (`about-parallax.tsx`) sets two CSS variables. It's off for touch pointers and for reduced motion.
- **What it avoids:** floating cards, blobs, particles and heavy glow. The motion is slow (a 70s orbit) and uses only transform, opacity and stroke.

### 2. Who we are: Our story & experience (refined)

The dark graphite section stays, with the same identity, and becomes an editorial story told in three beats:

1. **Heading and experience highlight.**
   - The H2 is "Built on experience. / *Driven by innovation.*" Each sentence sits on its own line at every width.
   - Beside it, divided by a hairline, is a large **10+** with a lime plus and the line "Years of experience in technology, marketing & business growth".
   - A footnote says it is "the combined background of the people behind Sociotix, not the age of the company".
2. **Why and story.**
   - On the left, the manifesto line from the redesign, now smaller: "Growing on social shouldn't take ~~ten tabs~~ and a ~~leap of faith.~~"
   - On the right, three short paragraphs that answer the questions in the brief:
     - **Who:** "built by professionals from technology, AI, digital marketing and business growth".
     - **Why:** scattered tools, vague listings and hidden dashboards.
     - **What:** one connected platform for services, AI-powered marketing tools, social media management and marketing automation.
     - **Aim:** clearer, more accessible digital growth, with honesty about what works today.
3. **Experience timeline.** "The experience behind the platform": four disciplines, each with what it brings, converging on a lime **Sociotix** node.
   - Technology & software development: a secure, dependable platform.
   - AI & automation: tools that save time, built responsibly.
   - Digital marketing & social media: services shaped by how platforms really work.
   - Business growth & transformation: clear processes that help businesses grow.

**Responsive:** the timeline is vertical on phones and tablets, and horizontal from 1024px. The 10+ highlight stacks under the heading below 1024px.

**Leaner copy:** the before/after ledger was removed. Its points now live in the story paragraph, which keeps the section from getting text-heavy.

**Accuracy of the experience claim:**
- The "10+ years" figure was supplied by the site owner as the experience of the team or founders behind Sociotix.
- It is worded only as the people's experience, never as company history.
- It is deliberately **left out of structured data**: no `foundingDate`, no employee counts and no experience fields, and a test checks this.
- If the figure ever changes, update `EXPERIENCE`/`WhoWeAre` in `src/components/site/about.tsx`.

**Honesty:** no founding date, team size, client counts, awards or statistics.

### 3. What we do

- **Layout:** an asymmetric bento of six columns.
  - Marketplace is wide (4 columns), with the text and visual side by side.
  - AI Tools is a graphite tile (2 columns), which separates it visually.
  - Social Management and Automation take 3 columns each.
  - On tablet, the tiles stack sensibly; on phone, they form one column.
- **Product visuals** are original, `aria-hidden` and built from real UI patterns:
  - **Marketplace:** a catalog search with real service names.
  - **AI Tools:** a brief, then a caption-draft skeleton labelled "Coming soon", with placeholder bars rather than fake text.
  - **Social Management:** a week calendar with draft markers and a "Read-only" tag.
  - **Automation:** a schedule → checklist → reminder flow with "Runs after you activate it".
- **Status lines:** each tile shows two, "Available now" (lime dot) and "Awaiting activation" (dashed dot), with screen-reader labels. A legend sits above the grid.
- **Whole-tile link:** each tile is fully clickable. A stretched link carries descriptive text such as "Browse the marketplace", and the focus ring shows on the tile through `has-[a:focus-visible]`.

### 4–5. Refinements

- **Shared sizing:** the H2 scale, rounded corners (1.6rem), card padding and eyebrow style are now shared across all five sections.
- **Why Sociotix:** keeps its five principles, with the "One connected platform" card at double height.
- **FAQ and CTA:** the native `<details name="about-faq">` accordion is unchanged and keyboard accessible, with one panel open at a time.

## Accuracy

These claims are backed by the code or by server state:

| Area | What the page says |
|---|---|
| **Marketplace** | Browsing is available now. Ordering and payments open service by service after verification. |
| **AI tools** | "None of them generate content today". Free daily runs are *planned*. |
| **Social Management** | The workspace, drafts and calendar are available. Connections depend on each platform's approval. Copy is derived from `socialReadiness()` (see below). |
| **Automation** | Planning routines run only after activation, and never publish or spend money. AI drafts are coming soon. |
| **Security** | Argon2id password hashing, mandatory staff MFA and read-only OAuth scopes (all in the README). Customer MFA is not claimed. |

**Social readiness:** `socialReadiness()` was extracted to `src/server/social/readiness.ts`. `/social-management` and `/about` now share it, and its behaviour is unchanged.

## SEO, AEO and GEO

- **Metadata:**
  - Title: "About Sociotix — AI Social Growth & Marketing Platform" (54 characters).
  - Description: 151 characters.
  - Canonical: `/about`, which resolves against `APP_URL`.
  - Open Graph and Twitter cards, plus `src/app/about/opengraph-image.tsx`.
- **Headings and rendering:** one H1, with H2s per section and H3s for items. All content is server-rendered, and the page is ◐ partial prerender, the same as other public pages.
- **Structured data:** `graph(Organization, AboutPage{about: #organization}, BreadcrumbList, FAQPage)`.
  - `webPage()` gained `type: "AboutPage"` and an `about` option.
  - There are no ratings, reviews or offers.
  - The FAQ text matches the visible answers word for word. FAQ rich results aren't expected.
- **Sitemap and robots:** `/about` was added to `sitemap.ts`. robots.txt allows it.
- **Internal links:** Marketplace, AI Tools, Social Management, Help Center, registration or dashboard, and the home page.
- **FAQs:** six direct, conversational answers covering what Sociotix is, its services, how it helps, AI tools, multiple accounts and whether it's free.
- **Navigation:** the footer Company column item "About · Soon" became the **About Us** link. The main header wasn't changed.
- **Session-aware CTA:** guests see **Create a free account** (`/register`, also in the static HTML). Signed-in customers see **Open your dashboard**.

## Files

- **New:**
  - `src/app/about/page.tsx`
  - `src/app/about/opengraph-image.tsx`
  - `src/components/site/about.tsx`
  - `src/components/site/about-parallax.tsx`
  - `src/server/social/readiness.ts`
- **Changed:**
  - `src/lib/seo/schema.ts` (AboutPage support)
  - `src/app/sitemap.ts`
  - `src/components/site/footer.tsx`
  - `src/app/social-management/page.tsx` (uses the shared readiness helper)
  - `src/app/globals.css` (about-orbit keyframes and the reduced-motion block)
  - `tests/unit/seo.test.ts`

## Test results (actual)

| Check | Result |
|---|---|
| Typecheck | Pass |
| ESLint (changed files) | Pass |
| Unit tests | 216 / 216 pass, including new About tests: metadata sizes, canonical, sitemap, AboutPage → Organization link, FAQ count and banned claims, both social-readiness variants |
| Production build (`APP_URL=https://www.sociotix-standin.example`) | Pass. `/about` is ◐ partial prerender. |
| SEO crawl on the production build (raw HTML, no JS) | 20 / 20 pass: title, description length, canonical, Open Graph URL and image on the stand-in origin with no localhost, no noindex, one H1, server-rendered section text, JSON-LD parses (Organization, AboutPage, BreadcrumbList, FAQPage), no ratings or offers, FAQPage matches visible text, sitemap entry, robots, OG image renders, 12/12 internal links resolve, footer link |
| Browser checks (production build) | 16 / 18 pass on the first run. The 2 failures are a confirmed test artifact (below). |
| Interaction checks | Pass: one primary hero CTA, guest CTA goes to `/register`, hovering a node lights its connection, pointer parallax works, the FAQ opens by keyboard one panel at a time, clicking anywhere on a product tile follows its link |

**Browser coverage:** 320, 375, 768, 1024 and 1440px, in light and dark.
- No horizontal overflow, no product nodes off screen, CLS 0.000, and no console errors.
- At 375px, reduced motion stops the orbit animation.

**The two failures:** at 320px, my scroll loop stopped before the end of the 9,904px page, so the final CTA's reveal animation hadn't started. A follow-up run that scrolled to the end showed every heading visible.

### Our story refinement (dev server, after the Who We Are update)

| Check | Result |
|---|---|
| Typecheck | Pass |
| ESLint (`about.tsx`) | Pass |
| Unit tests | 216 / 216 pass |
| Who We Are browser checks | 18 / 18 pass |

**Layout and theme:** at 320, 375 (reduced motion), 768, 1024 and 1440px, in light and dark, all story content is visible after scrolling, nothing overflows, and there are no console errors.

**Content and structure:**
- The heading text is exact.
- The 10+ claim is framed as the team's experience.
- The section answers who, why and aim.
- The timeline has 4 disciplines plus the Sociotix node.
- The heading order is one H1, with an H2 and three H3s in the section.
- The hero's "Our story" link targets `#who-we-are`.
- The story is server-rendered.
- The experience claim is absent from the JSON-LD.

**Two first-run failures, fixed or explained:**
- **Off-screen element:** an "element outside the viewport" flag at every width turned out to be the decorative violet glow. It's hidden from screen readers and clipped by the section's overflow, so it can't scroll the page; the check now skips decoration.
- **Tablet layout:** on visual review, the five-column timeline was cramped at 768px, so it now goes horizontal only from 1024px. The heading broke mid-phrase at 1024px, so each sentence now sits on its own line.

**Unchanged:** the hero, What we do, Why Sociotix, FAQ + CTA, metadata, FAQ answers and navigation.

## Limitations

- **Signed-in CTA:** the "Open your dashboard" variant wasn't exercised in a browser in this pass. It reuses `viewerFromSession()`, which has its own integration tests.
- **Field data:** CLS and visual checks are lab results from local Edge. Real Core Web Vitals need field data after deployment.
- **Structured data validation:** structured data should be validated with the Rich Results Test and the Schema Markup Validator once there is a public URL.
- **No PDF:** the reference PDF mentioned in the brief wasn't attached, so the redesign was based on the existing implementation and its screenshots.
