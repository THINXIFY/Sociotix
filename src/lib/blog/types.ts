/*
 * Sociotix blog content model. Articles are plain TypeScript files in src/content/blog, so adding
 * or editing one never touches a page layout. Inline links use [label](/path) inside text blocks.
 */

export type BlogCategoryId = "social-media" | "ai-marketing" | "growth" | "automation" | "guides" | "tips";

/** A category id: one of the six built-in ids above, or the slug of a custom category added in Blog Management. */
export type CategoryId = string;

export const BLOG_CATEGORIES: { id: BlogCategoryId; name: string }[] = [
  { id: "social-media", name: "Social Media Marketing" },
  { id: "ai-marketing", name: "AI & Marketing" },
  { id: "growth", name: "Growth Strategies" },
  { id: "automation", name: "Automation" },
  { id: "guides", name: "Guides & Tutorials" },
  { id: "tips", name: "Tips & Insights" },
];

export const isBuiltInCategory = (id: string): id is BlogCategoryId => BLOG_CATEGORIES.some((c) => c.id === id);

export type BlogBlock =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "ul" | "ol"; items: string[] }
  | { type: "quote"; text: string }
  | { type: "tip"; title: string; text: string };

/**
 * Rich text written in Admin → Blog Management. Stored as JSON and rendered as React elements, never
 * as raw HTML, so pasted or typed markup can't inject scripts. Links and image sources are validated
 * on the server (src/lib/blog/rich.ts).
 */
export interface InlineRun {
  text: string;
  b?: boolean;
  i?: boolean;
  u?: boolean;
  href?: string;
}

export type RichBlock =
  | { type: "p" | "h2" | "h3" | "h4" | "quote"; runs: InlineRun[] }
  | { type: "ul" | "ol"; items: InlineRun[][] }
  | { type: "img"; src: string; alt: string; caption?: string; width?: number; height?: number };

/** An uploaded image served from this site. */
export interface BlogImage {
  src: string;
  alt: string;
  width: number;
  height: number;
  mime: string;
}

export interface BlogAuthor {
  name: string;
  /** "organization" credits the Sociotix team; a person needs their real, approved name. */
  kind: "organization" | "person";
  role?: string;
}

export interface BlogArticle {
  slug: string;
  title: string;
  /** One or two sentences: used for cards, meta description and social previews. */
  description: string;
  category: CategoryId;
  /** Display name for a custom category (built-in names come from BLOG_CATEGORIES). */
  categoryName?: string;
  tags: string[];
  author: BlogAuthor;
  /**
   * Only "published" articles with a real publication date are listed, indexed and in the sitemap.
   * Drafts render outside production (with a Draft label and noindex) for review, and 404 in production.
   */
  status: "draft" | "published";
  /** ISO date the article was actually published. Never set ahead of approval. */
  publishedAt?: string;
  updatedAt?: string;
  featured?: boolean;
  /** The single most useful takeaway, shown in "Featured insights". */
  insight: string;
  /** Cover artwork variant (generated, on-brand; no stock imagery). */
  cover: { tone: "violet" | "graphite" | "lime"; motif: "orbit" | "bars" | "waves" | "grid" };
  /** Short alt text describing the cover artwork. */
  coverAlt: string;
  /** Optional SEO overrides. */
  seoTitle?: string;
  body: BlogBlock[];
  /** Posts from the admin editor: rich body (replaces `body`), featured image and SEO/social settings. */
  source?: "file" | "admin";
  rich?: RichBlock[];
  image?: BlogImage;
  metaDescription?: string;
  keywords?: string[];
  social?: { title?: string; description?: string; image?: BlogImage };
}

export const SOCIOTIX_TEAM: BlogAuthor = { name: "Sociotix Team", kind: "organization" };
