import type { CategoryId, RichBlock } from "./types";

/* Shapes shared by the Blog Management API and its admin screens (no server imports). */

export type PostState = "draft" | "scheduled" | "published";
export const POST_STATE_LABEL: Record<PostState, string> = { draft: "Draft", scheduled: "Scheduled", published: "Published" };

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SLUG_MAX = 80;

/** "How to Plan Content" → "how-to-plan-content" (accents removed, at most 80 characters). */
export function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, "");
}

/** Published with a future date is scheduled: it goes live automatically at that time. */
export const postState = (status: string, publishedAt: string | Date | null, now = Date.now()): PostState =>
  status !== "published" ? "draft" : publishedAt && new Date(publishedAt).getTime() > now ? "scheduled" : "published";

export interface PostImage {
  id: string;
  src: string;
  width: number;
  height: number;
  mime: string;
}

export interface AdminPostRow {
  id: string;
  title: string;
  slug: string;
  category: CategoryId;
  categoryName: string;
  authorName: string;
  state: PostState;
  featured: boolean;
  publishedAt: string | null;
  updatedAt: string;
  image: PostImage | null;
  version: number;
}

export interface AdminPostList {
  items: AdminPostRow[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
  counts: Record<PostState | "all", number>;
}

/** Everything the editor sends when saving. */
export interface PostFields {
  title: string;
  slug: string;
  excerpt: string;
  content: RichBlock[];
  category: CategoryId;
  tags: string[];
  featured: boolean;
  authorKind: "organization" | "person";
  authorName: string;
  featuredImageId: string | null;
  featuredImageAlt: string;
  focusKeyword: string;
  keywords: string[];
  seoTitle: string;
  metaDescription: string;
  socialTitle: string;
  socialDescription: string;
  socialImageId: string | null;
}

export interface AdminPost extends PostFields {
  id: string;
  state: PostState;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
  featuredImage: PostImage | null;
  socialImage: PostImage | null;
  /** Canonical public address (from the site's configured URL). */
  url: string;
  previousSlugs: string[];
  categoryName: string;
}

export const TEAM_AUTHOR = "Sociotix Team";

/** A blog category as the admin sees it: built-in (fixed) or custom (editable). `id` is what posts store. */
export interface AdminCategory {
  id: string;
  /** Row id of a custom category; null for built-in ones. */
  key: string | null;
  name: string;
  description: string;
  builtIn: boolean;
  postCount: number;
}
