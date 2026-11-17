import type { SocialProviderId } from "./social/platforms";

/* Brand Kit (BR-01): limits, types and small pure helpers shared by the server, the editor and the integrations. */

export const BRANDS_MAX = 20;
export const BRAND_NAME_MAX = 60;
export const BRAND_DESCRIPTION_MAX = 600;
export const BRAND_INDUSTRY_MAX = 60;
export const BRAND_WEBSITE_MAX = 200;
export const BRAND_TONE_MAX = 500;
export const BRAND_AUDIENCE_MAX = 1000;
export const BRAND_DEMOGRAPHICS_MAX = 500;
export const BRAND_GUIDELINES_MAX = 2000;
/** Per list: how many entries, and how long each can be. */
export const BRAND_LISTS = {
  personality: { max: 8, each: 30 },
  keywords: { max: 20, each: 40 },
  preferredPhrases: { max: 20, each: 80 },
  avoidWords: { max: 20, each: 60 },
} as const;
export type BrandListKey = keyof typeof BRAND_LISTS;

export const BRAND_ROUTES = { kit: "/dashboard/brand-kit", create: "/dashboard/brand-kit/new" } as const;
export const brandHref = (id: string) => `${BRAND_ROUTES.kit}/${encodeURIComponent(id)}`;

/** Suggestions only: customers can type their own. */
export const PERSONALITY_SUGGESTIONS = ["Friendly", "Professional", "Playful", "Bold", "Calm", "Premium", "Warm", "Witty", "Inspiring", "Authentic", "Expert", "Minimal"] as const;
export const INDUSTRY_SUGGESTIONS = ["Food & beverage", "Fashion & apparel", "Beauty & wellness", "Health & fitness", "Technology & software", "Education & coaching", "Real estate", "Travel & hospitality", "Creative & media", "Retail & e-commerce", "Professional services", "Non-profit"] as const;

/* -------------------------------------------------------------------------- */
/*  Colors and links                                                          */
/* -------------------------------------------------------------------------- */

export const HEX_COLOR = /^#[0-9a-f]{6}$/;

/** "#7047EB", "7047eb" or "#74e" → "#7047eb"; null when it isn't a hex color. */
export function normalizeHex(input: string | null | undefined): string | null {
  const s = (input ?? "").trim().replace(/^#/, "").toLowerCase();
  if (/^[0-9a-f]{3}$/.test(s)) return `#${s[0]}${s[0]}${s[1]}${s[1]}${s[2]}${s[2]}`;
  return /^[0-9a-f]{6}$/.test(s) ? `#${s}` : null;
}

function luminance(hex: string) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
}

/** WCAG contrast ratio between two #rrggbb colors (1–21). */
export function contrastRatio(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/** Black or white, whichever reads better on the given color. */
export const readableOn = (hex: string) => (contrastRatio(hex, "#ffffff") >= contrastRatio(hex, "#111111") ? "#ffffff" : "#111111");

/** "example.com" or "https://example.com/a" → a clean http(s) address; null when it isn't a web address. */
export function normalizeWebsite(input: string | null | undefined): string | null {
  const raw = (input ?? "").trim();
  if (!raw) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw) && !/^https?:\/\//i.test(raw)) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if ((u.protocol !== "https:" && u.protocol !== "http:") || !u.hostname.includes(".") || u.username || u.password) return null;
    return u.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/*  Views                                                                     */
/* -------------------------------------------------------------------------- */

export interface BrandView {
  id: string;
  name: string;
  description: string;
  website: string | null;
  industry: string;
  logoMediaId: string | null;
  coverMediaId: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  accentColor: string | null;
  personality: string[];
  toneOfVoice: string;
  audience: string;
  demographics: string;
  platforms: SocialProviderId[];
  keywords: string[];
  hashtags: string[];
  writingGuidelines: string;
  preferredPhrases: string[];
  avoidWords: string[];
  isDefault: boolean;
  /** Drafts and posts assigned to this brand. */
  postCount: number;
  /** Changes on every edit; sent back with a save so a stale tab can't overwrite newer work. */
  version: number;
  createdAt: string;
  updatedAt: string;
}

/** What pickers and badges need. */
export type BrandSummary = Pick<BrandView, "id" | "name" | "isDefault" | "primaryColor" | "logoMediaId" | "postCount">;

export const summaryOf = (b: BrandView): BrandSummary => ({ id: b.id, name: b.name, isDefault: b.isDefault, primaryColor: b.primaryColor, logoMediaId: b.logoMediaId, postCount: b.postCount });

/**
 * A brand's voice, audience and guidelines as one structured object, for the AI tools to be grounded in once
 * generation is switched on. Nothing reads it to generate text today.
 */
export interface BrandContext {
  brandId: string;
  name: string;
  industry: string;
  description: string;
  website: string | null;
  personality: string[];
  toneOfVoice: string;
  audience: string;
  demographics: string;
  platforms: SocialProviderId[];
  keywords: string[];
  hashtags: string[];
  writing: { guidelines: string; preferredPhrases: string[]; avoidWords: string[] };
}

export function buildBrandContext(b: BrandView): BrandContext {
  return {
    brandId: b.id,
    name: b.name,
    industry: b.industry,
    description: b.description,
    website: b.website,
    personality: b.personality,
    toneOfVoice: b.toneOfVoice,
    audience: b.audience,
    demographics: b.demographics,
    platforms: b.platforms,
    keywords: b.keywords,
    hashtags: b.hashtags,
    writing: { guidelines: b.writingGuidelines, preferredPhrases: b.preferredPhrases, avoidWords: b.avoidWords },
  };
}

/** Whether the brand has anything beyond its name that an AI tool or the editor could use. */
export const hasVoice = (b: Pick<BrandView, "personality" | "toneOfVoice" | "audience" | "writingGuidelines" | "preferredPhrases" | "avoidWords">) =>
  Boolean(b.personality.length || b.toneOfVoice || b.audience || b.writingGuidelines || b.preferredPhrases.length || b.avoidWords.length);

/** The brand's words to avoid that appear in the text (whole words, any case). */
export function findAvoided(text: string, avoidWords: string[]): string[] {
  if (!text || !avoidWords.length) return [];
  return avoidWords.filter((w) => {
    const e = w.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return e ? new RegExp(`(?<![\\p{L}\\p{N}_])${e}(?![\\p{L}\\p{N}_])`, "iu").test(text) : false;
  });
}

export const brandLogoUrl = (id: string) => `/media/library/${id}`;
