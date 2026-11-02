import "server-only";
import { randomUUID } from "node:crypto";
import net from "node:net";
import { and, count, desc, eq, ilike, inArray, or, type SQL, sql } from "drizzle-orm";
import { z } from "zod";
import { mediaId, parseRichBlocks } from "@/lib/blog/rich";
import type { RichBlock } from "@/lib/blog/types";
import { categoryName, PREVIEW_PRODUCTS, PRODUCT_TYPES, productHref } from "@/lib/digital-products";
import { type AdminProduct, type AdminProductList, type AdminProductRow, CURRENCIES, type DownloadLink, type ImageRef, LICENSE_TYPES, PRODUCT_SLUG_RE, type ProductFile, type ProductStatus } from "@/lib/digital-products/admin";
import { absoluteUrl } from "@/lib/seo/site";
import { audit } from "../audit";
import type { ClientInfo } from "../auth/sessions";
import { isBlockedAddress, mediaSrc } from "../blog/media";
import type { Db, Executor } from "../db/client";
import { blogMedia, digitalCategories, digitalProductFiles, digitalProducts } from "../db/schema";
import { AppError, errors } from "../errors";
import { assertDigitalCategory } from "./categories";

/*
 * Digital Products: products written in the admin editor. Every write is validated here (never trusting the
 * browser), checked against the version the editor loaded, and audited. Publishing makes a product visible on
 * the marketplace; it never enables purchases. Download links stay server-side (see downloads.ts).
 */

type Staff = { userId: string };
type Row = typeof digitalProducts.$inferSelect;

const field = (name: string, message: string) => new AppError("VALIDATION_FAILED", message, { details: { field: name } });
const SLUG = z.string().trim().toLowerCase().min(1, "Add a URL slug.").max(80).regex(PRODUCT_SLUG_RE, "Use lowercase letters, numbers and single hyphens.");
const line = (max: number) => z.string().trim().max(max).default("");
const list = (max: number, each: number) =>
  z
    .array(z.string().trim().min(1).max(each))
    .max(max)
    .default([])
    .transform((xs) => [...new Map(xs.map((x) => [x.toLowerCase(), x])).values()]);

/** External download links: https only, no credentials, no internal hosts. They're stored, never fetched. */
export function checkDownloadUrl(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || u.username || u.password || u.href.length > 2000) return null;
  const host = u.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!host.includes(".") || host === "localhost" || /\.(localhost|local|internal)$/.test(host)) return null;
  if (net.isIP(host) && isBlockedAddress(host)) return null;
  return u.toString();
}

const Link = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]{6,40}$/).optional(),
  url: z.string().trim().max(2000).refine((v) => checkDownloadUrl(v) !== null, "Download links must be full https:// addresses on a public website."),
  label: line(40),
  title: line(120),
  instructions: line(500),
});

export const ProductInput = z
  .strictObject({
    title: z.string().trim().min(1, "Add a product title.").max(160, "Keep the title under 160 characters."),
    slug: SLUG,
    shortDescription: line(300),
    content: z.unknown().optional().transform((v, ctx) => {
      try {
        return parseRichBlocks(v ?? []);
      } catch (e) {
        ctx.addIssue({ code: "custom", message: e instanceof z.ZodError ? (e.issues[0]?.message ?? "The description isn't valid.") : "The description isn't valid." });
        return z.NEVER;
      }
    }),
    category: z.string().trim().min(1, "Choose a category.").max(60).regex(PRODUCT_SLUG_RE, "Choose a category."),
    productType: z.enum(PRODUCT_TYPES, "Choose a product type."),
    tags: list(12, 40),
    pricing: z.enum(["free", "paid", "unset"]).default("unset"),
    priceCents: z.number().int().min(1, "Enter a price above zero.").max(100_000_000).nullable().default(null),
    currency: z.enum(CURRENCIES).default("USD"),
    availability: z.enum(["coming_soon", "available"]).default("coming_soon"),
    featured: z.boolean().default(false),
    featuredImageId: z.uuid().nullable().default(null),
    featuredImageAlt: line(200),
    gallery: z.array(z.strictObject({ mediaId: z.uuid(), alt: line(200) })).max(12, "A gallery can hold up to 12 images.").default([]),
    includes: list(30, 200),
    highlights: list(12, 200),
    specifications: list(20, 200),
    compatibility: list(20, 200),
    requirements: list(20, 200),
    licenseType: z.enum(LICENSE_TYPES).default(""),
    usageTerms: line(2000),
    downloadLinks: z.array(Link).max(10, "Add up to 10 download links.").default([]),
    focusKeyword: line(80),
    keywords: list(10, 60),
    seoTitle: line(120),
    metaDescription: line(320),
    socialTitle: line(120),
    socialDescription: line(320),
    socialImageId: z.uuid().nullable().default(null),
  })
  .superRefine((d, ctx) => {
    if (d.pricing === "paid" && d.priceCents === null) ctx.addIssue({ code: "custom", path: ["priceCents"], message: "Enter the price for a paid product." });
  });
export type ProductInputData = z.output<typeof ProductInput>;
const Versioned = z.object({ version: z.number().int().min(1) });

/* ------------------------------------------------------------------ */
/*  Reading                                                            */
/* ------------------------------------------------------------------ */

const iso = (d: Date | null) => (d ? d.toISOString() : null);

async function mediaMap(db: Executor, ids: (string | null | undefined)[]) {
  const wanted = [...new Set(ids.filter((x): x is string => Boolean(x)))];
  if (!wanted.length) return new Map<string, Omit<ImageRef, "alt">>();
  const rows = await db.select({ id: blogMedia.id, mime: blogMedia.mime, width: blogMedia.width, height: blogMedia.height }).from(blogMedia).where(inArray(blogMedia.id, wanted));
  return new Map(rows.map((r) => [r.id, { mediaId: r.id, src: mediaSrc(r.id), mime: r.mime, width: r.width, height: r.height }]));
}

const imageRef = (m: Map<string, Omit<ImageRef, "alt">>, id: string | null, alt: string): ImageRef | null => {
  const x = id ? m.get(id) : undefined;
  return x ? { ...x, alt } : null;
};

export async function customCategoryName(db: Executor, slug: string) {
  const [c] = await db.select({ name: digitalCategories.name }).from(digitalCategories).where(eq(digitalCategories.slug, slug));
  return c?.name ?? categoryName(slug);
}

export async function listFiles(db: Executor, productId: string): Promise<ProductFile[]> {
  const rows = await db
    .select({ id: digitalProductFiles.id, filename: digitalProductFiles.filename, mime: digitalProductFiles.mime, sizeBytes: digitalProductFiles.sizeBytes, version: digitalProductFiles.version, createdAt: digitalProductFiles.createdAt })
    .from(digitalProductFiles)
    .where(eq(digitalProductFiles.productId, productId))
    .orderBy(digitalProductFiles.position, digitalProductFiles.createdAt);
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}

export async function toAdminProduct(db: Executor, r: Row): Promise<AdminProduct> {
  const media = await mediaMap(db, [r.featuredImageId, r.socialImageId, ...r.gallery.map((g) => g.mediaId)]);
  return {
    id: r.id,
    title: r.title,
    slug: r.slug,
    shortDescription: r.shortDescription,
    content: r.content as RichBlock[],
    category: r.category,
    productType: r.productType as AdminProduct["productType"],
    tags: r.tags,
    pricing: r.pricing as AdminProduct["pricing"],
    priceCents: r.priceCents,
    currency: r.currency,
    availability: r.availability as AdminProduct["availability"],
    featured: r.featured,
    featuredImageId: r.featuredImageId,
    featuredImageAlt: r.featuredImageAlt,
    gallery: r.gallery,
    includes: r.includes,
    highlights: r.highlights,
    specifications: r.specifications,
    compatibility: r.compatibility,
    requirements: r.requirements,
    licenseType: r.licenseType,
    usageTerms: r.usageTerms,
    downloadLinks: r.downloadLinks,
    focusKeyword: r.focusKeyword,
    keywords: r.keywords,
    seoTitle: r.seoTitle,
    metaDescription: r.metaDescription,
    socialTitle: r.socialTitle,
    socialDescription: r.socialDescription,
    socialImageId: r.socialImageId,
    status: r.status as ProductStatus,
    publishedAt: iso(r.publishedAt),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    version: r.version,
    featuredImage: imageRef(media, r.featuredImageId, r.featuredImageAlt),
    galleryImages: r.gallery.map((g) => imageRef(media, g.mediaId, g.alt)).filter((x): x is ImageRef => x !== null),
    socialImage: imageRef(media, r.socialImageId, r.featuredImageAlt || r.title),
    files: await listFiles(db, r.id),
    categoryName: await customCategoryName(db, r.category),
    url: absoluteUrl(productHref({ id: r.slug })),
  };
}

const uuidOk = (id: string) => z.uuid().safeParse(id).success;

export async function getAdminProduct(db: Executor, id: string): Promise<AdminProduct> {
  if (!uuidOk(id)) throw errors.notFound("That product");
  const [r] = await db.select().from(digitalProducts).where(eq(digitalProducts.id, id));
  if (!r) throw errors.notFound("That product");
  return toAdminProduct(db, r);
}

export const ListQuery = z.object({
  q: z.string().trim().max(100).default(""),
  category: z.union([z.literal("all"), z.string().regex(PRODUCT_SLUG_RE).max(60)]).default("all"),
  status: z.enum(["all", "draft", "published", "archived"]).default("all"),
  sort: z.enum(["updated", "newest", "title", "price"]).default("updated"),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(5).max(50).default(15),
});

const fileCount = sql<number>`(select count(*) from ${digitalProductFiles} where ${digitalProductFiles.productId} = ${digitalProducts.id})`.mapWith(Number);

export async function listProducts(db: Executor, raw: z.input<typeof ListQuery>): Promise<AdminProductList> {
  const q = ListQuery.parse(raw);
  const base: SQL[] = [];
  if (q.q) {
    const term = `%${q.q.replace(/[%_\\]/g, "\\$&")}%`;
    base.push(or(ilike(digitalProducts.title, term), ilike(digitalProducts.slug, term), sql`${digitalProducts.tags}::text ilike ${term}`)!);
  }
  if (q.category !== "all") base.push(eq(digitalProducts.category, q.category));
  const where = and(...base, ...(q.status !== "all" ? [eq(digitalProducts.status, q.status)] : []));
  const order = q.sort === "title" ? [digitalProducts.title] : q.sort === "newest" ? [desc(digitalProducts.createdAt)] : q.sort === "price" ? [sql`${digitalProducts.priceCents} desc nulls last`, digitalProducts.title] : [desc(digitalProducts.updatedAt)];
  const [{ total }] = await db.select({ total: count() }).from(digitalProducts).where(where);
  const rows = await db
    .select({ p: digitalProducts, files: fileCount, customName: digitalCategories.name })
    .from(digitalProducts)
    .leftJoin(digitalCategories, eq(digitalCategories.slug, digitalProducts.category))
    .where(where)
    .orderBy(...order)
    .limit(q.pageSize)
    .offset((q.page - 1) * q.pageSize);
  const [c] = await db
    .select({
      all: count(),
      draft: sql<number>`count(*) filter (where ${digitalProducts.status} = 'draft')`.mapWith(Number),
      published: sql<number>`count(*) filter (where ${digitalProducts.status} = 'published')`.mapWith(Number),
      archived: sql<number>`count(*) filter (where ${digitalProducts.status} = 'archived')`.mapWith(Number),
      free: sql<number>`count(*) filter (where ${digitalProducts.pricing} = 'free')`.mapWith(Number),
      paid: sql<number>`count(*) filter (where ${digitalProducts.pricing} = 'paid')`.mapWith(Number),
      withDownloads: sql<number>`count(*) filter (where jsonb_array_length(${digitalProducts.downloadLinks}) > 0 or exists (select 1 from ${digitalProductFiles} where ${digitalProductFiles.productId} = ${digitalProducts.id}))`.mapWith(Number),
    })
    .from(digitalProducts)
    .where(base.length ? and(...base) : undefined);
  const thumbs = await mediaMap(db, rows.map((r) => r.p.featuredImageId));
  const items: AdminProductRow[] = rows.map(({ p, files, customName }) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    category: p.category,
    categoryName: customName ?? categoryName(p.category),
    pricing: p.pricing as AdminProductRow["pricing"],
    priceCents: p.priceCents,
    currency: p.currency,
    status: p.status as ProductStatus,
    availability: p.availability as AdminProductRow["availability"],
    updatedAt: p.updatedAt.toISOString(),
    publishedAt: iso(p.publishedAt),
    thumbnail: p.featuredImageId && thumbs.get(p.featuredImageId) ? { src: thumbs.get(p.featuredImageId)!.src } : null,
    fileCount: files,
    linkCount: p.downloadLinks.length,
    version: p.version,
  }));
  const { all, draft, published, archived, free, paid, withDownloads } = c;
  return { items, total, page: q.page, pageSize: q.pageSize, pages: Math.max(1, Math.ceil(total / q.pageSize)), counts: { all, draft, published, archived }, metrics: { free, paid, withDownloads } };
}

/* ------------------------------------------------------------------ */
/*  Writing                                                            */
/* ------------------------------------------------------------------ */

const CONCEPT_SLUGS = new Set(PREVIEW_PRODUCTS.map((p) => p.id));

async function assertSlugFree(db: Executor, slug: string, productId: string | null) {
  if (slug === "opengraph-image") throw field("slug", "That URL is reserved.");
  const [taken] = await db.select({ id: digitalProducts.id }).from(digitalProducts).where(eq(digitalProducts.slug, slug));
  if (taken && taken.id !== productId) throw field("slug", "That URL is already used by another product.");
}

async function assertImages(db: Executor, d: ProductInputData) {
  const ids = [d.featuredImageId, d.socialImageId, ...d.gallery.map((g) => g.mediaId), ...d.content.flatMap((b) => (b.type === "img" ? [mediaId(b.src)] : []))].filter((x): x is string => !!x);
  if (!ids.length) return;
  const found = await db.select({ id: blogMedia.id }).from(blogMedia).where(inArray(blogMedia.id, [...new Set(ids)]));
  if (found.length !== new Set(ids).size) throw field("image", "One of the images is no longer available. Upload it again.");
}

function columns(d: ProductInputData) {
  return {
    title: d.title,
    slug: d.slug,
    shortDescription: d.shortDescription,
    content: d.content,
    category: d.category,
    productType: d.productType,
    tags: d.tags,
    pricing: d.pricing,
    priceCents: d.pricing === "paid" ? d.priceCents : null,
    currency: d.currency,
    availability: d.availability,
    featured: d.featured,
    featuredImageId: d.featuredImageId,
    featuredImageAlt: d.featuredImageId ? d.featuredImageAlt : "",
    gallery: d.gallery,
    includes: d.includes,
    highlights: d.highlights,
    specifications: d.specifications,
    compatibility: d.compatibility,
    requirements: d.requirements,
    licenseType: d.licenseType,
    usageTerms: d.usageTerms,
    downloadLinks: d.downloadLinks.map((l): DownloadLink => ({ id: l.id ?? randomUUID().slice(0, 12), url: checkDownloadUrl(l.url)!, label: l.label || "Download", title: l.title, instructions: l.instructions })),
    focusKeyword: d.focusKeyword,
    keywords: d.keywords,
    seoTitle: d.seoTitle,
    metaDescription: d.metaDescription,
    socialTitle: d.socialTitle,
    socialDescription: d.socialDescription,
    socialImageId: d.socialImageId,
  };
}

const summary = (r: Pick<Row, "title" | "slug" | "status" | "pricing" | "priceCents" | "availability">) => ({ title: r.title, slug: r.slug, status: r.status, pricing: r.pricing, priceCents: r.priceCents, availability: r.availability });
const strip = (raw: unknown) => Object.fromEntries(Object.entries((raw ?? {}) as Record<string, unknown>).filter(([k]) => k !== "version"));

export async function createProduct(db: Db, actor: Staff, raw: unknown, client: ClientInfo = {}) {
  const d = ProductInput.parse(raw);
  return db.transaction(async (tx) => {
    await assertSlugFree(tx, d.slug, null);
    await assertDigitalCategory(tx, d.category);
    await assertImages(tx, d);
    const [r] = await tx.insert(digitalProducts).values({ ...columns(d), status: "draft", createdBy: actor.userId, updatedBy: actor.userId }).returning();
    await audit(tx, { actorUserId: actor.userId, actorType: "staff", action: "digital_product.create", targetType: "digital_product", targetId: r.id, after: summary(r), ...client });
    return toAdminProduct(tx, r);
  });
}

async function lockForEdit(tx: Executor, id: string, version: number) {
  if (!uuidOk(id)) throw errors.notFound("That product");
  const [r] = await tx.select().from(digitalProducts).where(eq(digitalProducts.id, id)).for("update");
  if (!r) throw errors.notFound("That product");
  if (r.version !== version) throw errors.conflict("Someone else saved this product since you opened it. Reload to see their changes before saving.");
  return r;
}

/** What a product needs before it can appear on the marketplace. */
function assertPublishable(d: Pick<ProductInputData, "shortDescription" | "content" | "includes" | "featuredImageId" | "featuredImageAlt" | "gallery" | "pricing" | "priceCents">) {
  if (!d.shortDescription) throw field("shortDescription", "Add a short description before publishing.");
  if (!d.content.length && !d.includes.length) throw field("content", "Describe the product or list what it includes before publishing.");
  if (d.featuredImageId && !d.featuredImageAlt) throw field("featuredImageAlt", "Describe the featured image (alt text) before publishing.");
  if (d.gallery.some((g) => !g.alt)) throw field("gallery", "Every gallery image needs alt text before publishing.");
  if (d.content.some((b) => b.type === "img" && !b.alt)) throw field("content", "Every image in the description needs alt text before publishing.");
  if (d.pricing === "paid" && !d.priceCents) throw field("priceCents", "Enter the price for a paid product.");
}

export async function updateProduct(db: Db, actor: Staff, id: string, raw: unknown, client: ClientInfo = {}) {
  const { version } = Versioned.parse(raw);
  const d = ProductInput.parse(strip(raw));
  return db.transaction(async (tx) => {
    const before = await lockForEdit(tx, id, version);
    if (d.slug !== before.slug) await assertSlugFree(tx, d.slug, id);
    await assertDigitalCategory(tx, d.category);
    if (before.status === "published") assertPublishable(d);
    await assertImages(tx, d);
    const [r] = await tx
      .update(digitalProducts)
      .set({ ...columns(d), version: before.version + 1, updatedBy: actor.userId, updatedAt: new Date() })
      .where(eq(digitalProducts.id, id))
      .returning();
    await audit(tx, { actorUserId: actor.userId, actorType: "staff", action: "digital_product.update", targetType: "digital_product", targetId: id, before: summary(before), after: summary(r), ...client });
    return toAdminProduct(tx, r);
  });
}

/** publish | unpublish (back to draft) | archive. Publishing never enables purchases. */
export async function setProductStatus(db: Db, actor: Staff, id: string, action: "publish" | "unpublish" | "archive", raw: unknown, client: ClientInfo = {}) {
  const { version } = Versioned.parse(raw);
  return db.transaction(async (tx) => {
    const before = await lockForEdit(tx, id, version);
    let next: ProductStatus = "draft";
    if (action === "publish") {
      assertPublishable({ ...before, content: before.content as RichBlock[], pricing: before.pricing as ProductInputData["pricing"] });
      next = "published";
    } else if (action === "archive") next = "archived";
    else if (before.status !== "published") throw errors.conflict("This product isn't published.");
    const [r] = await tx
      .update(digitalProducts)
      .set({ status: next, publishedAt: next === "published" ? (before.publishedAt ?? new Date()) : before.publishedAt, version: before.version + 1, updatedBy: actor.userId, updatedAt: new Date() })
      .where(eq(digitalProducts.id, id))
      .returning();
    await audit(tx, { actorUserId: actor.userId, actorType: "staff", action: `digital_product.${action}`, targetType: "digital_product", targetId: id, before: summary(before), after: summary(r), ...client });
    return toAdminProduct(tx, r);
  });
}

/** A private draft copy with a fresh slug; files are copied too, so the copy is complete. */
export async function duplicateProduct(db: Db, actor: Staff, id: string, client: ClientInfo = {}) {
  if (!uuidOk(id)) throw errors.notFound("That product");
  return db.transaction(async (tx) => {
    const [src] = await tx.select().from(digitalProducts).where(eq(digitalProducts.id, id));
    if (!src) throw errors.notFound("That product");
    let slug = `${src.slug}-copy`.slice(0, 80).replace(/-+$/, "");
    for (let n = 2; (await tx.select({ id: digitalProducts.id }).from(digitalProducts).where(eq(digitalProducts.slug, slug))).length; n++) slug = `${src.slug.slice(0, 70)}-copy-${n}`;
    // Everything but identity, timestamps, version and status (the copy starts as a fresh draft).
    const rest = Object.fromEntries(Object.entries(src).filter(([k]) => !["id", "createdAt", "updatedAt", "publishedAt", "version", "status"].includes(k))) as Omit<Row, "id" | "createdAt" | "updatedAt" | "publishedAt" | "version" | "status">;
    const [r] = await tx
      .insert(digitalProducts)
      .values({ ...rest, slug, title: `${src.title} (copy)`.slice(0, 160), status: "draft", downloadLinks: src.downloadLinks.map((l) => ({ ...l, id: randomUUID().slice(0, 12) })), createdBy: actor.userId, updatedBy: actor.userId })
      .returning();
    await tx.execute(sql`insert into ${digitalProductFiles} (product_id, filename, mime, size_bytes, bytes, sha256, version, position, uploaded_by) select ${r.id}, filename, mime, size_bytes, bytes, sha256, version, position, ${actor.userId} from ${digitalProductFiles} where product_id = ${id}`);
    await audit(tx, { actorUserId: actor.userId, actorType: "staff", action: "digital_product.duplicate", targetType: "digital_product", targetId: r.id, before: { from: src.id }, after: summary(r), ...client });
    return toAdminProduct(tx, r);
  });
}

export async function deleteProduct(db: Db, actor: Staff, id: string, raw: unknown, client: ClientInfo = {}) {
  const { version } = Versioned.parse(raw);
  await db.transaction(async (tx) => {
    const before = await lockForEdit(tx, id, version);
    await tx.delete(digitalProducts).where(eq(digitalProducts.id, id));
    await audit(tx, { actorUserId: actor.userId, actorType: "staff", action: "digital_product.delete", targetType: "digital_product", targetId: id, before: summary(before), ...client });
  });
}

/* ------------------------------------------------------------------ */
/*  Public lookups                                                     */
/* ------------------------------------------------------------------ */

/** Published products (with custom category names and file metadata), newest first. */
export async function livePublishedRows(db: Executor, slug?: string) {
  return db
    .select({ p: digitalProducts, customName: digitalCategories.name })
    .from(digitalProducts)
    .leftJoin(digitalCategories, eq(digitalCategories.slug, digitalProducts.category))
    .where(slug ? and(eq(digitalProducts.status, "published"), eq(digitalProducts.slug, slug)) : eq(digitalProducts.status, "published"))
    .orderBy(desc(digitalProducts.publishedAt))
    .limit(500);
}

export { mediaMap };

/** For the proxy: a published product, or a concept page while nothing real is published yet. */
export async function resolvePublicProductSlug(db: Executor, slug: string): Promise<"live" | "concept" | null> {
  if (!PRODUCT_SLUG_RE.test(slug) || slug.length > 80) return null;
  const [live] = await db.select({ id: digitalProducts.id }).from(digitalProducts).where(and(eq(digitalProducts.status, "published"), eq(digitalProducts.slug, slug)));
  if (live) return "live";
  if (!CONCEPT_SLUGS.has(slug)) return null;
  const [{ n }] = await db.select({ n: count() }).from(digitalProducts).where(eq(digitalProducts.status, "published"));
  return n === 0 ? "concept" : null;
}
