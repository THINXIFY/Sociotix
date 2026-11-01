import { article as chooseService } from "@/content/blog/choose-the-right-social-media-service";
import { article as planMonth } from "@/content/blog/plan-a-month-of-social-content";
import { article as captions } from "@/content/blog/write-captions-that-sound-like-you";
import { richPlainText, runsText } from "./rich";
import { BLOG_CATEGORIES, type BlogArticle, type BlogBlock, type BlogImage, type CategoryId } from "./types";

export * from "./types";

/** Every article file. To add one: create it in src/content/blog and list it here. */
export const ALL_ARTICLES: BlogArticle[] = [chooseService, captions, planMonth];

export const BLOG_PATH = "/blog";
export const articleHref = (a: Pick<BlogArticle, "slug">) => `${BLOG_PATH}/${a.slug}`;

/** Published means approved AND dated; nothing else is listed, indexed or in the sitemap. */
export const isPublished = (a: BlogArticle) => a.status === "published" && !!a.publishedAt;

/** Drafts are previewable outside production only. */
export const draftsVisible = () => process.env.APP_ENV !== "production";

const byDateDesc = (a: BlogArticle, b: BlogArticle) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "");

export function publishedArticles(list = ALL_ARTICLES) {
  return list.filter(isPublished).sort(byDateDesc);
}

/** What the blog shows: published articles, plus drafts when previewing outside production. */
export function visibleArticles(list = ALL_ARTICLES, includeDrafts = draftsVisible()) {
  const published = publishedArticles(list);
  return includeDrafts ? [...published, ...list.filter((a) => !isPublished(a))] : published;
}

export function getArticle(slug: string, includeDrafts = draftsVisible()) {
  const a = ALL_ARTICLES.find((x) => x.slug === slug);
  if (!a) return null;
  return isPublished(a) || includeDrafts ? a : null;
}

export const categoryName = (id: CategoryId) => BLOG_CATEGORIES.find((c) => c.id === id)?.name ?? id;
/** An article's category label, including custom categories. */
export const articleCategoryName = (a: Pick<BlogArticle, "category" | "categoryName">) => a.categoryName ?? categoryName(a.category);

/** Plain text of a block (links reduced to their labels), for reading time and search. */
const plain = (s: string) => s.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
export function articleText(a: BlogArticle) {
  if (a.rich) return richPlainText(a.rich);
  return a.body.map((b) => ("items" in b ? b.items.join(" ") : b.type === "tip" ? `${b.title} ${b.text}` : b.text)).map(plain).join(" ");
}

/** Reading time at roughly 220 words a minute, never under one minute. */
export function readingMinutes(a: BlogArticle) {
  const words = `${a.title} ${articleText(a)}`.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 220));
}

export const headingId = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** H2 headings for the table of contents. */
export function tableOfContents(a: BlogArticle) {
  if (a.rich) return a.rich.flatMap((b) => (b.type === "h2" && runsText(b.runs).trim() ? [{ id: headingId(runsText(b.runs)), text: runsText(b.runs).trim() }] : []));
  return a.body.filter((b): b is Extract<BlogBlock, { type: "h2" }> => b.type === "h2").map((b) => ({ id: headingId(b.text), text: b.text }));
}

/** Same category first, then shared tags, then the rest; never the article itself. */
export function relatedArticles(a: BlogArticle, list = visibleArticles(), limit = 3) {
  const score = (x: BlogArticle) => (x.category === a.category ? 2 : 0) + x.tags.filter((t) => a.tags.includes(t)).length;
  return list
    .filter((x) => x.slug !== a.slug)
    .sort((x, y) => score(y) - score(x))
    .slice(0, limit);
}

/** Splits text into plain strings and internal/external links written as [label](href). */
export function parseInline(text: string): ({ type: "text"; value: string } | { type: "link"; label: string; href: string })[] {
  const out: ({ type: "text"; value: string } | { type: "link"; label: string; href: string })[] = [];
  const re = /\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > last) out.push({ type: "text", value: text.slice(last, m.index) });
    out.push({ type: "link", label: m[1], href: m[2] });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push({ type: "text", value: text.slice(last) });
  return out;
}

export const formatDate = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/** Serializable card data for the client explorer (search, filters, load more). */
export type ArticleCard = { slug: string; title: string; description: string; category: CategoryId; categoryName: string; tags: string[]; minutes: number; date: string | null; draft: boolean; featured: boolean; author: string; cover: BlogArticle["cover"]; coverAlt: string; image: BlogImage | null };
export function toCard(a: BlogArticle): ArticleCard {
  return { slug: a.slug, title: a.title, description: a.description, category: a.category, categoryName: articleCategoryName(a), tags: a.tags, minutes: readingMinutes(a), date: a.publishedAt ?? null, draft: !isPublished(a), featured: !!a.featured, author: a.author.name, cover: a.cover, coverAlt: a.coverAlt, image: a.image ?? null };
}

/** Filters cards by category and a free-text query (title, description, category or tags). */
export function filterCards(cards: ArticleCard[], category: CategoryId | "all", query: string) {
  const q = query.trim().toLowerCase();
  return cards.filter((c) => (category === "all" || c.category === category) && (!q || [c.title, c.description, c.categoryName, ...c.tags].join(" ").toLowerCase().includes(q)));
}
