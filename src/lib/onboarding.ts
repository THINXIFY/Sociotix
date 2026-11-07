/**
 * Customer onboarding: the goals a new customer picks, the platforms they use,
 * and the next steps we suggest from those choices. Shared by the browser and
 * the server; the id lists mirror ONBOARDING_INTEREST / ONBOARDING_STATE in
 * `src/server/db/schema/enums.ts` (a test keeps them in step).
 *
 * Recommendations only point at features that exist. Each one says plainly
 * whether it works today or is still waiting to be switched on.
 */

import { PLATFORM_BY_ID } from "./catalog";

export const INTERESTS = [
  { id: "grow", label: "Grow social media", hint: "More reach, followers and views" },
  { id: "content", label: "Create better content", hint: "Plan posts that land" },
  { id: "ai", label: "Explore AI tools", hint: "Captions, hashtags and ideas" },
  { id: "manage", label: "Manage social accounts", hint: "Everything in one workspace" },
  { id: "services", label: "Discover marketing services", hint: "Services and digital products" },
] as const;

export type InterestId = (typeof INTERESTS)[number]["id"];
export const INTEREST_IDS = INTERESTS.map((i) => i.id) as InterestId[];
export const ONBOARDING_STATES = ["completed", "skipped", "existing"] as const;
export type OnboardingState = (typeof ONBOARDING_STATES)[number];

export interface OnboardingPrefs {
  /** Null until the welcome flow is finished or skipped. */
  state: OnboardingState | null;
  interests: InterestId[];
  /** Catalog platform ids. */
  platforms: string[];
}

export const EMPTY_ONBOARDING: OnboardingPrefs = { state: null, interests: [], platforms: [] };

/** available: works today · preview: open to explore, the main action isn't switched on · soon: not activated yet. */
export type RecommendationStatus = "available" | "preview" | "soon";

export interface Recommendation {
  id: string;
  title: string;
  why: string;
  href: string;
  cta: string;
  status: RecommendationStatus;
  /** What works now and what doesn't, in a few words. */
  note: string;
}

const FINDER = "/dashboard/service-finder";

function platformNames(ids: string[]) {
  const names = ids.map((id) => PLATFORM_BY_ID[id]?.name).filter(Boolean) as string[];
  if (!names.length || names.length > 2) return "";
  return names.join(" & ");
}

/** One primary suggestion per goal, plus a second one used when fewer goals are picked. */
function forInterest(id: InterestId, platforms: string[]): [Recommendation, Recommendation] {
  const names = platformNames(platforms);
  switch (id) {
    case "grow": {
      // The Service Finder can start on a platform when exactly one was chosen.
      const href = platforms.length === 1 && PLATFORM_BY_ID[platforms[0]] ? `${FINDER}?goal=audience&platform=${platforms[0]}` : `${FINDER}?goal=audience`;
      return [
        { id: "finder", title: names ? `Find growth services for ${names}` : "Find the right growth service", why: "Answer a few quick questions and the Service Finder suggests services that fit your goal.", href, cta: "Open Service Finder", status: "available", note: "Browse now · ordering opens soon" },
        { id: "new-order", title: "See every service in one place", why: "Compare services by platform and type before ordering opens.", href: "/dashboard/new-order", cta: "Browse services", status: "available", note: "Browse now · ordering opens soon" },
      ];
    }
    case "content":
      return [
        { id: "calendar", title: "Plan your posts on a calendar", why: "Draft posts and arrange them by date in your Social workspace.", href: "/dashboard/social/calendar", cta: "Open the calendar", status: "available", note: "Drafts work now · publishing isn't activated yet" },
        { id: "captions", title: "Write captions with AI", why: "Describe a post and get caption options for each platform.", href: "/ai-tools/caption-generator", cta: "See the Caption Generator", status: "soon", note: "Not activated yet · see how it will work" },
      ];
    case "ai":
      return [
        { id: "ai", title: "Set up your Sociotix AI workspace", why: "Tell us what you make so the AI tools fit your work from the start.", href: "/dashboard/ai/welcome", cta: "Set up Sociotix AI", status: "preview", note: "Workspace open · AI generation isn't switched on yet" },
        { id: "hashtags", title: "Find hashtags and keywords", why: "Hashtags grouped from broad to niche, plus phrases people search for.", href: "/ai-tools/hashtag-keyword-finder", cta: "See the Hashtag Finder", status: "soon", note: "Not activated yet · see how it will work" },
      ];
    case "manage":
      return [
        { id: "social", title: names ? `Bring ${names} into one workspace` : "Organise your social accounts", why: "Keep drafts, campaigns and your calendar together in the Social workspace.", href: "/dashboard/social", cta: "Open Social workspace", status: "preview", note: "Planning works now · connecting accounts isn't activated yet" },
        { id: "campaigns", title: "Group posts into campaigns", why: "Collect related drafts under one campaign so launches stay organised.", href: "/dashboard/social/campaigns", cta: "Open campaigns", status: "available", note: "Available now" },
      ];
    case "services":
      return [
        { id: "digital", title: "Explore digital products", why: "Templates, planners and toolkits for marketing your brand.", href: "/dashboard/digital-products", cta: "Browse digital products", status: "available", note: "Browse now · purchases open soon" },
        { id: "finder-services", title: "Match a service to your goal", why: "The Service Finder narrows the catalog down to what fits.", href: FINDER, cta: "Open Service Finder", status: "available", note: "Browse now · ordering opens soon" },
      ];
  }
}

/** Two or three next steps for the customer's own choices — never invented activity or results. */
export function recommend(prefs: Pick<OnboardingPrefs, "interests" | "platforms">, limit = 3): Recommendation[] {
  const goals = INTEREST_IDS.filter((id) => prefs.interests.includes(id));
  const picked = goals.length ? goals : (["grow", "content", "ai"] as InterestId[]);
  const pairs = picked.map((id) => forInterest(id, prefs.platforms));
  const ordered = [...pairs.map((p) => p[0]), ...pairs.map((p) => p[1])];
  const seen = new Set<string>();
  const out: Recommendation[] = [];
  for (const r of ordered) {
    if (seen.has(r.href.split("?")[0])) continue;
    seen.add(r.href.split("?")[0]);
    out.push(r);
    if (out.length === limit) break;
  }
  return out;
}

/** Keeps only known ids, in a stable order, without duplicates. */
export function cleanChoices(input: { interests?: unknown; platforms?: unknown }) {
  const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  const interests = INTEREST_IDS.filter((id) => list(input.interests).includes(id));
  const platforms = [...new Set(list(input.platforms).filter((id) => PLATFORM_BY_ID[id]))].slice(0, 20);
  return { interests, platforms };
}
