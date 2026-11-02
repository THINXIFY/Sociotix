import type { RichBlock } from "@/lib/blog/types";

/*
 * Digital Products Marketplace catalog. Real products are created in Admin → Digital Products and read on
 * the server (src/server/digital-products/public.ts). Until at least one is published, the marketplace shows
 * PREVIEW_PRODUCTS: concept listings with no prices that keep the pages out of search results and the sitemap.
 * These helpers are pure and work on whichever list the page received. Purchasing stays disabled.
 */

export type DigitalCategoryId = "social-templates" | "ai-prompts" | "web-templates" | "branding" | "ebooks" | "planners" | "ai-agents" | "creative-toolkits";
/** A built-in category id above, or the slug of a custom category added in admin. */
export type CategoryId = string;

export const DIGITAL_CATEGORIES: { id: DigitalCategoryId; name: string }[] = [
  { id: "social-templates", name: "Social Media Templates" },
  { id: "ai-prompts", name: "AI Prompts & Automation" },
  { id: "web-templates", name: "Website & SaaS Templates" },
  { id: "branding", name: "Branding & Design Assets" },
  { id: "ebooks", name: "E-books & Guides" },
  { id: "planners", name: "Content Calendars & Planners" },
  { id: "ai-agents", name: "AI Agents & Chatbots" },
  { id: "creative-toolkits", name: "AI Creative Toolkits" },
];

export const isBuiltInDigitalCategory = (id: string): id is DigitalCategoryId => DIGITAL_CATEGORIES.some((c) => c.id === id);

export const PRODUCT_TYPES = ["Template", "Prompt pack", "Guide", "Planner", "Toolkit", "Agent"] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

/** `unset` means no price has been decided: shown as "Pricing at launch", never as a number. */
export type CoverTone = "violet" | "lime" | "graphite";
const TONES: CoverTone[] = ["violet", "graphite", "lime"];

export type Price = { kind: "free" } | { kind: "paid"; cents: number; currency?: string } | { kind: "unset" };

/** coming_soon: not released yet. available: released (free products can be downloaded; paid purchases stay closed). */
export type Availability = "coming_soon" | "available";

/** What the public page may know about downloads: names and sizes, never file bytes or link URLs. */
export interface PublicDownloads {
  files: { id: string; name: string; sizeBytes: number; type: string; version: string }[];
  links: { id: string; label: string; title: string; instructions: string; provider: string | null }[];
}

export interface DigitalProduct {
  id: string;
  title: string;
  category: CategoryId;
  /** Display name for a custom category (built-in names come from DIGITAL_CATEGORIES). */
  categoryName?: string;
  type: ProductType;
  /** One or two sentences for the card. */
  description: string;
  /** What the product is planned to contain (concept previews) or does contain (real products). */
  includes: string[];
  price: Price;
  featured?: boolean;
  /** Cover colourway. Presentation only. */
  tone: CoverTone;
  /** ISO date a real product was listed. Preview concepts have none. */
  listedAt?: string;
  /** Released products only. Shown when present; never invented for concepts. */
  images?: { src: string; alt: string; width: number; height: number }[];
  formats?: string[];
  specifications?: string[];
  compatibility?: string[];
  requirements?: string[];
  license?: string;
  /** Admin-published products only. */
  source?: "concept" | "admin";
  availability?: Availability;
  rich?: RichBlock[];
  highlights?: string[];
  licenseTerms?: string;
  downloads?: PublicDownloads;
  seoTitle?: string;
  metaDescription?: string;
  keywords?: string[];
  social?: { title?: string; description?: string; image?: { src: string; mime: string } };
}

/** Covers rotate through the three brand colourways so neighbouring products look different. */
const seen: Partial<Record<DigitalCategoryId, number>> = {};
const concept = (id: string, category: DigitalCategoryId, type: ProductType, title: string, description: string, includes: string[], featured = false): DigitalProduct => {
  const n = (seen[category] = (seen[category] ?? -1) + 1);
  return { id, title, category, type, description, includes, price: { kind: "unset" }, tone: TONES[(DIGITAL_CATEGORIES.findIndex((c) => c.id === category) + n) % 3], source: "concept", ...(featured ? { featured } : {}) };
};

/** Concept listings that show what each category could hold. Clearly labelled on the page; not for sale. */
export const PREVIEW_PRODUCTS: DigitalProduct[] = [
  concept("carousel-storytelling", "social-templates", "Template", "Carousel Storytelling Templates", "Editable slide layouts for explaining one idea per swipe.", ["Cover, content and closing slide layouts", "Light and dark colourways", "Editable text and colour styles"], true),
  concept("launch-week-posts", "social-templates", "Template", "Launch Week Post Pack", "Matching announcement, teaser and countdown post layouts for a product launch.", ["Teaser and countdown layouts", "Announcement and thank-you posts", "Square and portrait sizes"]),
  concept("caption-prompt-library", "ai-prompts", "Prompt pack", "Caption Prompt Library", "Prompts to adapt for captions across tones, platforms and post types.", ["Prompts grouped by goal and tone", "Fill-in-the-blank brief templates", "Notes on editing AI drafts"], true),
  concept("repurposing-workflow", "ai-prompts", "Toolkit", "Content Repurposing Workflow", "A step-by-step routine for turning one post into several formats.", ["Step-by-step workflow checklist", "Prompts for each format", "A tracking sheet"]),
  concept("creator-landing-page", "web-templates", "Template", "Creator Landing Page Template", "A clean one-page layout for introducing yourself and linking your work.", ["Hero, about and links sections", "Light and dark themes", "Responsive layout notes"]),
  concept("saas-pricing-page", "web-templates", "Template", "SaaS Pricing Page Template", "A plan-comparison layout with a simple FAQ section.", ["Plan comparison table", "FAQ and call-to-action blocks", "Mobile layout"]),
  concept("brand-starter-kit", "branding", "Toolkit", "Brand Starter Kit", "Colour, type and logo-usage page layouts for a small brand.", ["Colour and type specimen pages", "Logo-usage guide layout", "Editable brand one-pager"]),
  concept("social-profile-set", "branding", "Template", "Social Profile Design Set", "Matching avatar, highlight-cover and banner designs.", ["Avatar and banner layouts", "Highlight cover set", "Editable colours"]),
  concept("content-planning-handbook", "ebooks", "Guide", "The Content Planning Handbook", "A practical guide to planning a month of posts without burning out.", ["Planning method, step by step", "Worked examples", "Printable checklists"]),
  concept("first-90-days", "ebooks", "Guide", "First 90 Days on Social", "A calm roadmap for building a posting habit from scratch.", ["Week-by-week focus areas", "Simple routines", "Review prompts"]),
  concept("monthly-content-calendar", "planners", "Planner", "Monthly Content Calendar", "A balanced monthly planner for themes, formats and posting days.", ["Month-at-a-glance view", "Theme and format planner", "Weekly review sheet"], true),
  concept("campaign-workbook", "planners", "Planner", "Campaign Planning Workbook", "A guided workbook for planning a campaign from goal to wrap-up.", ["Goal and audience pages", "Content schedule", "Results review"]),
  concept("faq-chatbot-starter", "ai-agents", "Agent", "Customer FAQ Chatbot Starter", "A starter configuration for answering common customer questions.", ["Starter instructions", "Example question set", "Handover-to-a-person notes"]),
  concept("reply-assistant", "ai-agents", "Agent", "Social Reply Assistant", "A starting setup for drafting polite replies to comments and messages.", ["Reply tone guide", "Draft-and-review flow", "Escalation checklist"]),
  concept("image-prompt-toolkit", "creative-toolkits", "Toolkit", "AI Image Prompt Toolkit", "Building blocks for describing the visuals you want.", ["Style and lighting vocabulary", "Prompt structure guide", "Example briefs"]),
  concept("video-idea-toolkit", "creative-toolkits", "Toolkit", "Short-Video Idea Toolkit", "Prompts and formats for planning short videos.", ["Hook and format prompts", "Shot-list template", "Idea backlog sheet"]),
];

/** A colourway for products that don't carry one (admin products), stable per slug. */
export const toneFor = (slug: string): CoverTone => TONES[[...slug].reduce((n, c) => n + c.charCodeAt(0), 0) % 3];

/** Curated groupings of the existing categories, shown as banners (they filter; they don't list products again). */
export interface Collection {
  id: string;
  title: string;
  blurb: string;
  categories: CategoryId[];
  tone: CoverTone;
}

export const COLLECTIONS: Collection[] = [
  { id: "plan-your-month", title: "Plan your month", blurb: "Calendars, workbooks and guides for posting with a plan.", categories: ["planners", "ebooks"], tone: "lime" },
  { id: "build-your-brand", title: "Build your brand", blurb: "Templates and design assets that make a profile feel cohesive.", categories: ["branding", "social-templates", "web-templates"], tone: "violet" },
  { id: "put-ai-to-work", title: "Put AI to work", blurb: "Prompts, assistants and creative toolkits to speed up the busywork.", categories: ["ai-prompts", "ai-agents", "creative-toolkits"], tone: "graphite" },
];

export const DIGITAL_PRODUCTS_PATH = "/digital-products";

/** A product's page. The id doubles as its URL slug. */
export const productHref = (p: Pick<DigitalProduct, "id">) => `${DIGITAL_PRODUCTS_PATH}/${p.id}`;

/** Same category first, then the rest in catalog order; never the product itself. */
export function relatedProducts(p: DigitalProduct, list: DigitalProduct[], limit = 3) {
  const others = list.filter((x) => x.id !== p.id);
  return [...others.filter((x) => x.category === p.category), ...others.filter((x) => x.category !== p.category)].slice(0, limit);
}

export const categoryName = (id: CategoryId) => DIGITAL_CATEGORIES.find((c) => c.id === id)?.name ?? id;
/** A product's category label, including custom categories. */
export const productCategoryName = (p: Pick<DigitalProduct, "category" | "categoryName">) => p.categoryName ?? categoryName(p.category);

export function priceLabel(p: Price): string {
  if (p.kind === "free") return "Free";
  if (p.kind === "paid") {
    const digits = p.cents % 100 === 0 ? 0 : 2;
    return new Intl.NumberFormat("en-US", { style: "currency", currency: p.currency ?? "USD", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(p.cents / 100);
  }
  return "Pricing at launch";
}

export type SortId = "featured" | "name" | "newest" | "price-asc" | "price-desc";
export type PriceFilter = "all" | "free" | "paid";

export interface Filters {
  category: CategoryId | "all";
  /** A collection's categories; takes part only when set (and the single category is "all"). */
  collection?: CategoryId[] | null;
  query: string;
  type: ProductType | "all";
  price: PriceFilter;
}

const priced = (p: DigitalProduct) => p.price.kind === "free" || p.price.kind === "paid";
const cents = (p: DigitalProduct) => (p.price.kind === "paid" ? p.price.cents : p.price.kind === "free" ? 0 : Number.POSITIVE_INFINITY);

/** Price and date sorts and the price filter only exist when the data behind them does. */
export function capabilities(products: DigitalProduct[]) {
  return { hasPrices: products.some(priced), hasDates: products.some((p) => p.listedAt) };
}

export function availableSorts(products: DigitalProduct[]): { id: SortId; label: string }[] {
  const { hasPrices, hasDates } = capabilities(products);
  return [
    { id: "featured", label: "Featured first" },
    { id: "name", label: "Name A–Z" },
    ...(hasDates ? [{ id: "newest" as const, label: "Newest first" }] : []),
    ...(hasPrices ? [{ id: "price-asc" as const, label: "Price: low to high" }, { id: "price-desc" as const, label: "Price: high to low" }] : []),
  ];
}

/** Every word typed must appear in the title, description, category, type or contents. */
export function filterProducts(products: DigitalProduct[], f: Filters): DigitalProduct[] {
  const words = f.query.toLowerCase().split(/\s+/).filter(Boolean);
  return products.filter((p) => {
    if (f.category !== "all" && p.category !== f.category) return false;
    if (f.collection && !f.collection.includes(p.category)) return false;
    if (f.type !== "all" && p.type !== f.type) return false;
    if (f.price === "free" && p.price.kind !== "free") return false;
    if (f.price === "paid" && p.price.kind !== "paid") return false;
    if (!words.length) return true;
    const hay = [p.title, p.description, productCategoryName(p), p.type, ...p.includes, ...(p.highlights ?? [])].join(" ").toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

export function sortProducts(products: DigitalProduct[], sort: SortId): DigitalProduct[] {
  const byName = (a: DigitalProduct, b: DigitalProduct) => a.title.localeCompare(b.title);
  const list = [...products];
  switch (sort) {
    case "name":
      return list.sort(byName);
    case "newest":
      return list.sort((a, b) => (b.listedAt ?? "").localeCompare(a.listedAt ?? "") || byName(a, b));
    case "price-asc":
      return list.sort((a, b) => cents(a) - cents(b) || byName(a, b));
    case "price-desc":
      // Unpriced products sort last in both directions.
      return list.sort((a, b) => (Number.isFinite(cents(a)) ? 0 : 1) - (Number.isFinite(cents(b)) ? 0 : 1) || cents(b) - cents(a) || byName(a, b));
    default:
      return list.sort((a, b) => Number(!!b.featured) - Number(!!a.featured));
  }
}
