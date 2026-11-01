import "server-only";
import { cacheLife, cacheTag, revalidateTag } from "next/cache";
import { ALL_ARTICLES, draftsVisible, isPublished, publishedArticles } from "@/lib/blog";
import type { AdminPost } from "@/lib/blog/admin";
import { mediaId } from "@/lib/blog/rich";
import type { BlogArticle, BlogImage, CategoryId, RichBlock } from "@/lib/blog/types";
import { getDb } from "../db/client";
import { AppError } from "../errors";
import { logger } from "../log";
import { getImageBytes } from "./media";
import { livePosts } from "./posts";

/*
 * The public blog = file articles (src/content/blog) + live admin posts. Admin posts are read through
 * a tagged cache: every admin write calls `blogChanged()`, and the short cache life lets scheduled
 * posts appear within about a minute of their time.
 */

export const BLOG_TAG = "blog";

/** Call after any admin change to posts so pages, the sitemap and feeds rebuild on their next request. */
export const blogChanged = () => revalidateTag(BLOG_TAG, { expire: 0 });

const COVER: Record<string, BlogArticle["cover"]> = {
  "social-media": { tone: "violet", motif: "orbit" },
  "ai-marketing": { tone: "graphite", motif: "waves" },
  growth: { tone: "lime", motif: "bars" },
  automation: { tone: "graphite", motif: "grid" },
  guides: { tone: "violet", motif: "grid" },
  tips: { tone: "lime", motif: "orbit" },
};

const day = (d: Date | string | null) => (d ? new Date(d).toISOString().slice(0, 10) : undefined);
const img = (i: { src: string; width: number; height: number; mime: string } | null, alt: string): BlogImage | undefined => (i ? { src: i.src, width: i.width, height: i.height, mime: i.mime, alt } : undefined);

/** Maps an admin post to the public article shape (also used for staff previews). */
export function postToArticle(p: Pick<AdminPost, "slug" | "title" | "excerpt" | "metaDescription" | "category" | "tags" | "authorKind" | "authorName" | "featured" | "featuredImageAlt" | "seoTitle" | "content" | "focusKeyword" | "keywords" | "socialTitle" | "socialDescription" | "featuredImage" | "socialImage"> & { live: boolean; publishedAt: string | null; updatedAt: string; categoryName?: string }): BlogArticle {
  const published = day(p.publishedAt);
  const updated = day(p.updatedAt);
  const image = img(p.featuredImage, p.featuredImageAlt);
  return {
    slug: p.slug,
    title: p.title,
    description: p.excerpt || p.metaDescription,
    category: p.category,
    ...(p.categoryName ? { categoryName: p.categoryName } : {}),
    tags: p.tags,
    author: { name: p.authorName, kind: p.authorKind },
    status: p.live ? "published" : "draft",
    ...(p.live && published ? { publishedAt: published, ...(updated && updated > published ? { updatedAt: updated } : {}) } : {}),
    featured: p.featured,
    insight: p.excerpt,
    cover: COVER[p.category] ?? { tone: "violet", motif: "grid" },
    coverAlt: p.featuredImageAlt || p.title,
    ...(p.seoTitle ? { seoTitle: p.seoTitle } : {}),
    body: [],
    source: "admin",
    rich: p.content as RichBlock[],
    ...(image ? { image } : {}),
    metaDescription: p.metaDescription || p.excerpt,
    keywords: [p.focusKeyword, ...p.keywords].filter(Boolean),
    social: { title: p.socialTitle || undefined, description: p.socialDescription || undefined, image: img(p.socialImage, p.featuredImageAlt || p.title) ?? image },
  };
}

type LiveRow = Awaited<ReturnType<typeof livePosts>>[number];

async function readLive(slug?: string): Promise<LiveRow[]> {
  try {
    return await livePosts(getDb(), 500, slug);
  } catch (e) {
    // No database configured is normal (public-only deployments); anything else is worth a warning.
    if (!(e instanceof AppError)) logger().warn({ reason: (e instanceof Error ? (e.cause instanceof Error ? e.cause.message : e.message) : String(e)).split("\n")[0].slice(0, 200) }, "blog posts unavailable");
    return [];
  }
}

const rowToArticle = ({ post: r, image, socialImage, categoryName }: LiveRow) =>
  postToArticle({
    ...r,
    category: r.category as CategoryId,
    categoryName,
    authorKind: r.authorKind as "organization" | "person",
    content: r.content as RichBlock[],
    featuredImage: image,
    socialImage,
    live: true,
    publishedAt: r.publishedAt!.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  });

/** Live admin posts as articles. An unconfigured or unreachable database means "none" — the blog still works. */
export async function liveAdminArticles(): Promise<BlogArticle[]> {
  "use cache";
  cacheTag(BLOG_TAG);
  cacheLife("minutes");
  return (await readLive()).map(rowToArticle);
}

/**
 * One live admin post, cached per slug. Article pages use this rather than the full list: a post
 * published after the build has no entry in the build-time cache, so its first request reads fresh data.
 */
export async function liveAdminArticle(slug: string): Promise<BlogArticle | null> {
  "use cache";
  cacheTag(BLOG_TAG);
  cacheLife("minutes");
  const [row] = await readLive(slug);
  return row ? rowToArticle(row) : null;
}

const byDateDesc = (a: BlogArticle, b: BlogArticle) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "");

/** Everything published, newest first (file articles and admin posts). */
export async function allPublishedArticles(): Promise<BlogArticle[]> {
  return [...publishedArticles(), ...(await liveAdminArticles())].sort(byDateDesc);
}

/** What the blog lists: everything published, plus file drafts when previewing outside production. */
export async function allVisibleArticles(includeDrafts = draftsVisible()): Promise<BlogArticle[]> {
  const published = await allPublishedArticles();
  return includeDrafts ? [...published, ...ALL_ARTICLES.filter((a) => !isPublished(a))] : published;
}

/** A visible article by slug (file first: slugs are unique across both sources). */
export async function findPublicArticle(slug: string, includeDrafts = draftsVisible()): Promise<BlogArticle | null> {
  const file = ALL_ARTICLES.find((a) => a.slug === slug);
  if (file) return isPublished(file) || includeDrafts ? file : null;
  return liveAdminArticle(slug);
}

/** A JPEG/PNG upload as a data URI for social images (images never change for an id). Other types return null. */
export async function socialImageDataUri(src: string): Promise<string | null> {
  "use cache";
  cacheLife("max");
  const id = mediaId(src);
  if (!id) return null;
  try {
    const row = await getImageBytes(getDb(), id);
    if (!row || (row.mime !== "image/png" && row.mime !== "image/jpeg")) return null;
    return `data:${row.mime};base64,${row.bytes.toString("base64")}`;
  } catch {
    return null;
  }
}
