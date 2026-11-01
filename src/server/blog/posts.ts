import "server-only";
import { aliasedTable, and, count, desc, eq, gt, ilike, inArray, lte, or, type SQL, sql } from "drizzle-orm";
import { z } from "zod";
import { type AdminPost, type AdminPostList, type AdminPostRow, type PostImage, postState, SLUG_MAX, SLUG_RE, TEAM_AUTHOR } from "@/lib/blog/admin";
import { ALL_ARTICLES } from "@/lib/blog";
import { parseRichBlocks, mediaId } from "@/lib/blog/rich";
import { categoryName } from "@/lib/blog";
import { type CategoryId, type RichBlock } from "@/lib/blog/types";
import { absoluteUrl } from "@/lib/seo/site";
import { audit } from "../audit";
import type { ClientInfo } from "../auth/sessions";
import type { Db, Executor } from "../db/client";
import { blogCategories, blogMedia, blogPosts, blogSlugRedirects } from "../db/schema";
import { AppError, errors } from "../errors";
import { assertCategory } from "./categories";
import { mediaSrc } from "./media";

/*
 * Blog Management: posts written in the admin editor. Every write is validated here (never trusting
 * the browser), checked against the version the editor loaded, and recorded in the audit log.
 * Visibility rule used everywhere: status "published" AND published_at <= now().
 */

type Staff = { userId: string };
type Row = typeof blogPosts.$inferSelect;

const field = (name: string, message: string) => new AppError("VALIDATION_FAILED", message, { details: { field: name } });
const CATEGORY = z.string().trim().min(1, "Choose a category.").max(60).regex(SLUG_RE, "Choose a category.");
const FILE_SLUGS = new Set(ALL_ARTICLES.map((a) => a.slug));

const line = (max: number) => z.string().trim().max(max).default("");
const list = (max: number, each: number) =>
  z
    .array(z.string().trim().min(1).max(each))
    .max(max)
    .default([])
    .transform((xs) => [...new Map(xs.map((x) => [x.toLowerCase(), x])).values()]);

export const PostInput = z.strictObject({
  title: z.string().trim().min(1, "Add a title.").max(160, "Keep the title under 160 characters."),
  slug: z.string().trim().toLowerCase().min(1, "Add a URL slug.").max(SLUG_MAX).regex(SLUG_RE, "Use lowercase letters, numbers and single hyphens."),
  excerpt: line(300),
  content: z.unknown().transform((v, ctx) => {
    try {
      return parseRichBlocks(v ?? []);
    } catch (e) {
      ctx.addIssue({ code: "custom", message: e instanceof z.ZodError ? (e.issues[0]?.message ?? "The content isn't valid.") : "The content isn't valid." });
      return z.NEVER;
    }
  }),
  category: CATEGORY,
  tags: list(12, 40),
  featured: z.boolean().default(false),
  authorKind: z.enum(["organization", "person"]).default("organization"),
  authorName: line(80),
  featuredImageId: z.uuid().nullable().default(null),
  featuredImageAlt: line(200),
  focusKeyword: line(80),
  keywords: list(10, 60),
  seoTitle: line(120),
  metaDescription: line(320),
  socialTitle: line(120),
  socialDescription: line(320),
  socialImageId: z.uuid().nullable().default(null),
});
export type PostInputData = z.output<typeof PostInput>;

const Versioned = z.object({ version: z.number().int().min(1) });

/* ------------------------------------------------------------------ */
/*  Reading                                                            */
/* ------------------------------------------------------------------ */

const featuredMedia = aliasedTable(blogMedia, "featured_media");
const socialMedia = aliasedTable(blogMedia, "social_media");
const imageCols = (m: typeof blogMedia) => ({ id: m.id, mime: m.mime, width: m.width, height: m.height });
const toImage = (m: { id: string | null; mime: string | null; width: number | null; height: number | null } | null): PostImage | null =>
  m?.id ? { id: m.id, src: mediaSrc(m.id), mime: m.mime!, width: m.width!, height: m.height! } : null;

const iso = (d: Date | null) => (d ? d.toISOString() : null);
const publicPath = (slug: string) => `/blog/${slug}`;

function toAdminPost(r: Row, fi: PostImage | null, si: PostImage | null, previousSlugs: string[], customName: string | null): AdminPost {
  return {
    id: r.id,
    title: r.title,
    slug: r.slug,
    excerpt: r.excerpt,
    content: r.content as RichBlock[],
    category: r.category as CategoryId,
    tags: r.tags,
    featured: r.featured,
    authorKind: r.authorKind as AdminPost["authorKind"],
    authorName: r.authorName,
    featuredImageId: r.featuredImageId,
    featuredImageAlt: r.featuredImageAlt,
    focusKeyword: r.focusKeyword,
    keywords: r.keywords,
    seoTitle: r.seoTitle,
    metaDescription: r.metaDescription,
    socialTitle: r.socialTitle,
    socialDescription: r.socialDescription,
    socialImageId: r.socialImageId,
    state: postState(r.status, r.publishedAt),
    publishedAt: iso(r.publishedAt),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    version: r.version,
    featuredImage: fi,
    socialImage: si,
    url: absoluteUrl(publicPath(r.slug)),
    previousSlugs,
    categoryName: customName ?? categoryName(r.category),
  };
}

export async function getPost(db: Executor, id: string): Promise<AdminPost> {
  if (!z.uuid().safeParse(id).success) throw errors.notFound("That post");
  const [r] = await db
    .select({ p: blogPosts, fi: imageCols(featuredMedia), si: imageCols(socialMedia), customName: blogCategories.name })
    .from(blogPosts)
    .leftJoin(featuredMedia, eq(featuredMedia.id, blogPosts.featuredImageId))
    .leftJoin(socialMedia, eq(socialMedia.id, blogPosts.socialImageId))
    .leftJoin(blogCategories, eq(blogCategories.slug, blogPosts.category))
    .where(eq(blogPosts.id, id));
  if (!r) throw errors.notFound("That post");
  const redirects = await db.select({ slug: blogSlugRedirects.slug }).from(blogSlugRedirects).where(eq(blogSlugRedirects.postId, id));
  return toAdminPost(r.p, toImage(r.fi), toImage(r.si), redirects.map((x) => x.slug), r.customName);
}

export const ListQuery = z.object({
  q: z.string().trim().max(100).default(""),
  category: z.union([z.literal("all"), CATEGORY]).default("all"),
  status: z.enum(["all", "draft", "scheduled", "published"]).default("all"),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(5).max(50).default(15),
});

const stateFilter = (s: "draft" | "scheduled" | "published"): SQL =>
  s === "draft" ? sql`${blogPosts.status} <> 'published'` : s === "scheduled" ? and(eq(blogPosts.status, "published"), gt(blogPosts.publishedAt, sql`now()`))! : and(eq(blogPosts.status, "published"), lte(blogPosts.publishedAt, sql`now()`))!;

export async function listPosts(db: Executor, raw: z.input<typeof ListQuery>): Promise<AdminPostList> {
  const q = ListQuery.parse(raw);
  const base: SQL[] = [];
  if (q.q) {
    const term = `%${q.q.replace(/[%_\\]/g, "\\$&")}%`;
    base.push(or(ilike(blogPosts.title, term), ilike(blogPosts.slug, term), ilike(blogPosts.authorName, term), sql`${blogPosts.tags}::text ilike ${term}`)!);
  }
  if (q.category !== "all") base.push(eq(blogPosts.category, q.category));
  const where = and(...base, ...(q.status !== "all" ? [stateFilter(q.status)] : []));
  const [{ total }] = await db.select({ total: count() }).from(blogPosts).where(where);
  const rows = await db
    .select({ p: blogPosts, fi: imageCols(featuredMedia), customName: blogCategories.name })
    .from(blogPosts)
    .leftJoin(featuredMedia, eq(featuredMedia.id, blogPosts.featuredImageId))
    .leftJoin(blogCategories, eq(blogCategories.slug, blogPosts.category))
    .where(where)
    .orderBy(desc(blogPosts.updatedAt))
    .limit(q.pageSize)
    .offset((q.page - 1) * q.pageSize);
  const [c] = await db
    .select({
      all: count(),
      draft: sql<number>`count(*) filter (where ${blogPosts.status} <> 'published')`.mapWith(Number),
      scheduled: sql<number>`count(*) filter (where ${blogPosts.status} = 'published' and ${blogPosts.publishedAt} > now())`.mapWith(Number),
      published: sql<number>`count(*) filter (where ${blogPosts.status} = 'published' and ${blogPosts.publishedAt} <= now())`.mapWith(Number),
    })
    .from(blogPosts)
    .where(base.length ? and(...base) : undefined);
  const items: AdminPostRow[] = rows.map(({ p, fi, customName }) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    category: p.category,
    categoryName: customName ?? categoryName(p.category),
    authorName: p.authorName,
    state: postState(p.status, p.publishedAt),
    featured: p.featured,
    publishedAt: iso(p.publishedAt),
    updatedAt: p.updatedAt.toISOString(),
    image: toImage(fi),
    version: p.version,
  }));
  return { items, total, page: q.page, pageSize: q.pageSize, pages: Math.max(1, Math.ceil(total / q.pageSize)), counts: c };
}

/* ------------------------------------------------------------------ */
/*  Writing                                                            */
/* ------------------------------------------------------------------ */

async function assertImages(db: Executor, d: PostInputData) {
  const ids = [d.featuredImageId, d.socialImageId, ...d.content.flatMap((b) => (b.type === "img" ? [mediaId(b.src)] : []))].filter((x): x is string => !!x);
  if (!ids.length) return;
  const found = await db.select({ id: blogMedia.id }).from(blogMedia).where(inArray(blogMedia.id, [...new Set(ids)]));
  if (found.length !== new Set(ids).size) throw field("image", "One of the images is no longer available. Upload it again.");
}

async function assertSlugFree(db: Executor, slug: string, postId: string | null) {
  if (FILE_SLUGS.has(slug)) throw field("slug", "That URL is already used by another article.");
  const [taken] = await db.select({ id: blogPosts.id }).from(blogPosts).where(eq(blogPosts.slug, slug));
  if (taken && taken.id !== postId) throw field("slug", "That URL is already used by another post.");
  const [redirect] = await db.select({ postId: blogSlugRedirects.postId }).from(blogSlugRedirects).where(eq(blogSlugRedirects.slug, slug));
  if (redirect && redirect.postId !== postId) throw field("slug", "That URL used to belong to another post and still redirects there.");
}

function columns(d: PostInputData) {
  const person = d.authorKind === "person";
  if (person && d.authorName.length < 2) throw field("authorName", "Enter the author's name, or credit the Sociotix Team.");
  return {
    title: d.title,
    slug: d.slug,
    excerpt: d.excerpt,
    content: d.content,
    category: d.category,
    tags: d.tags,
    featured: d.featured,
    authorKind: d.authorKind,
    authorName: person ? d.authorName : TEAM_AUTHOR,
    featuredImageId: d.featuredImageId,
    featuredImageAlt: d.featuredImageId ? d.featuredImageAlt : "",
    focusKeyword: d.focusKeyword,
    keywords: d.keywords,
    seoTitle: d.seoTitle,
    metaDescription: d.metaDescription,
    socialTitle: d.socialTitle,
    socialDescription: d.socialDescription,
    socialImageId: d.socialImageId,
  };
}

const summary = (r: Pick<Row, "title" | "slug" | "status" | "publishedAt" | "category">) => ({ title: r.title, slug: r.slug, status: r.status, publishedAt: iso(r.publishedAt), category: r.category });

/** Creates a draft. */
export async function createPost(db: Db, actor: Staff, raw: unknown, client: ClientInfo = {}) {
  const d = PostInput.parse(raw);
  return db.transaction(async (tx) => {
    await assertSlugFree(tx, d.slug, null);
    await assertCategory(tx, d.category);
    await assertImages(tx, d);
    const [r] = await tx
      .insert(blogPosts)
      .values({ ...columns(d), status: "draft", createdBy: actor.userId, updatedBy: actor.userId })
      .returning();
    await audit(tx, { actorUserId: actor.userId, actorType: "staff", action: "blog_post.create", targetType: "blog_post", targetId: r.id, after: summary(r), ...client });
    return getPost(tx, r.id);
  });
}

async function lockForEdit(tx: Executor, id: string, version: number) {
  if (!z.uuid().safeParse(id).success) throw errors.notFound("That post");
  const [r] = await tx.select().from(blogPosts).where(eq(blogPosts.id, id)).for("update");
  if (!r) throw errors.notFound("That post");
  if (r.version !== version) throw errors.conflict("Someone else saved this post since you opened it. Reload to see their changes before saving.");
  return r;
}

const isLive = (r: Pick<Row, "status" | "publishedAt">) => r.status === "published" && !!r.publishedAt && r.publishedAt.getTime() <= Date.now();

/** Saves edits. Renaming a live post keeps its old URL working as a permanent redirect. */
export async function updatePost(db: Db, actor: Staff, id: string, raw: unknown, client: ClientInfo = {}) {
  const { version } = Versioned.parse(raw);
  const d = PostInput.parse(Object.fromEntries(Object.entries(raw as Record<string, unknown>).filter(([k]) => k !== "version")));
  return db.transaction(async (tx) => {
    const before = await lockForEdit(tx, id, version);
    if (d.slug !== before.slug) {
      await assertSlugFree(tx, d.slug, id);
      // Reclaiming one of this post's own old slugs removes that redirect.
      await tx.delete(blogSlugRedirects).where(and(eq(blogSlugRedirects.slug, d.slug), eq(blogSlugRedirects.postId, id)));
      if (isLive(before)) await tx.insert(blogSlugRedirects).values({ slug: before.slug, postId: id }).onConflictDoNothing();
    }
    if (before.status === "published") assertPublishable(d);
    await assertCategory(tx, d.category);
    await assertImages(tx, d);
    const [r] = await tx
      .update(blogPosts)
      .set({ ...columns(d), version: before.version + 1, updatedBy: actor.userId, updatedAt: new Date() })
      .where(eq(blogPosts.id, id))
      .returning();
    await audit(tx, { actorUserId: actor.userId, actorType: "staff", action: "blog_post.update", targetType: "blog_post", targetId: id, before: summary(before), after: summary(r), ...client });
    return getPost(tx, id);
  });
}

/** What a post needs before it can go live. */
function assertPublishable(d: Pick<PostInputData, "title" | "content" | "excerpt" | "metaDescription" | "featuredImageId" | "featuredImageAlt">) {
  if (!d.content.some((b) => b.type !== "img")) throw field("content", "Write the post before publishing it.");
  if (!d.excerpt && !d.metaDescription) throw field("excerpt", "Add a short summary (or a meta description) before publishing.");
  if (d.featuredImageId && !d.featuredImageAlt) throw field("featuredImageAlt", "Describe the featured image (alt text) before publishing.");
  const missingAlt = d.content.some((b) => b.type === "img" && !b.alt);
  if (missingAlt) throw field("content", "Every image in the post needs alt text before publishing.");
}

const PublishInput = z.object({
  version: z.number().int().min(1),
  /** Omit to publish now. A future time schedules the post; it then goes live automatically. */
  publishAt: z.iso.datetime({ offset: true }).optional(),
});

export async function publishPost(db: Db, actor: Staff, id: string, raw: unknown, client: ClientInfo = {}) {
  const { version, publishAt } = PublishInput.parse(raw);
  return db.transaction(async (tx) => {
    const before = await lockForEdit(tx, id, version);
    assertPublishable({ ...before, content: before.content as RichBlock[] });
    const now = Date.now();
    let when: Date;
    if (publishAt) {
      when = new Date(publishAt);
      // Publication dates are never backdated: a past time means "now".
      if (when.getTime() < now - 60_000) throw field("publishAt", "Choose a time in the future, or publish now.");
      if (when.getTime() > now + 366 * 86_400_000) throw field("publishAt", "Schedule within the next year.");
      if (when.getTime() < now) when = new Date(now);
    } else when = before.publishedAt && before.publishedAt.getTime() <= now ? before.publishedAt : new Date(now);
    const [r] = await tx
      .update(blogPosts)
      .set({ status: "published", publishedAt: when, version: before.version + 1, updatedBy: actor.userId, updatedAt: new Date() })
      .where(eq(blogPosts.id, id))
      .returning();
    await audit(tx, { actorUserId: actor.userId, actorType: "staff", action: when.getTime() > now ? "blog_post.schedule" : "blog_post.publish", targetType: "blog_post", targetId: id, before: summary(before), after: summary(r), ...client });
    return getPost(tx, id);
  });
}

/** Back to draft: removed from the blog, sitemap and search immediately. The original date is kept for a later republish. */
export async function unpublishPost(db: Db, actor: Staff, id: string, raw: unknown, client: ClientInfo = {}) {
  const { version } = Versioned.parse(raw);
  return db.transaction(async (tx) => {
    const before = await lockForEdit(tx, id, version);
    if (before.status !== "published") throw errors.conflict("This post isn't published.");
    // A scheduled post that never went live doesn't keep its planned date.
    const publishedAt = before.publishedAt && before.publishedAt.getTime() <= Date.now() ? before.publishedAt : null;
    const [r] = await tx
      .update(blogPosts)
      .set({ status: "draft", publishedAt, version: before.version + 1, updatedBy: actor.userId, updatedAt: new Date() })
      .where(eq(blogPosts.id, id))
      .returning();
    await audit(tx, { actorUserId: actor.userId, actorType: "staff", action: "blog_post.unpublish", targetType: "blog_post", targetId: id, before: summary(before), after: summary(r), ...client });
    return getPost(tx, id);
  });
}

export async function deletePost(db: Db, actor: Staff, id: string, raw: unknown, client: ClientInfo = {}) {
  const { version } = Versioned.parse(raw);
  await db.transaction(async (tx) => {
    const before = await lockForEdit(tx, id, version);
    await tx.delete(blogPosts).where(eq(blogPosts.id, id));
    await audit(tx, { actorUserId: actor.userId, actorType: "staff", action: "blog_post.delete", targetType: "blog_post", targetId: id, before: summary(before), ...client });
  });
}

/* ------------------------------------------------------------------ */
/*  Public lookups                                                     */
/* ------------------------------------------------------------------ */

export const liveWhere = () => and(eq(blogPosts.status, "published"), lte(blogPosts.publishedAt, sql`now()`));

/** Posts visible on the public blog, newest first, with their images. */
export async function livePosts(db: Executor, limit = 500, slug?: string) {
  return db
    .select({ p: blogPosts, fi: imageCols(featuredMedia), si: imageCols(socialMedia), customName: blogCategories.name })
    .from(blogPosts)
    .leftJoin(featuredMedia, eq(featuredMedia.id, blogPosts.featuredImageId))
    .leftJoin(socialMedia, eq(socialMedia.id, blogPosts.socialImageId))
    .leftJoin(blogCategories, eq(blogCategories.slug, blogPosts.category))
    .where(slug ? and(liveWhere(), eq(blogPosts.slug, slug)) : liveWhere())
    .orderBy(desc(blogPosts.publishedAt))
    .limit(limit)
    .then((rows) => rows.map((r) => ({ post: r.p, image: toImage(r.fi), socialImage: toImage(r.si), categoryName: r.customName ?? categoryName(r.p.category) })));
}

/** For the proxy: is this slug a live post, or an old slug that now redirects to one? */
export async function resolvePublicSlug(db: Executor, slug: string): Promise<{ kind: "live" } | { kind: "redirect"; slug: string } | null> {
  if (!SLUG_RE.test(slug) || slug.length > SLUG_MAX) return null;
  const [live] = await db.select({ id: blogPosts.id }).from(blogPosts).where(and(eq(blogPosts.slug, slug), liveWhere()));
  if (live) return { kind: "live" };
  const [r] = await db
    .select({ slug: blogPosts.slug })
    .from(blogSlugRedirects)
    .innerJoin(blogPosts, eq(blogPosts.id, blogSlugRedirects.postId))
    .where(and(eq(blogSlugRedirects.slug, slug), liveWhere()));
  return r ? { kind: "redirect", slug: r.slug } : null;
}
