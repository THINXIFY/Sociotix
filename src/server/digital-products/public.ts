import "server-only";
import { cacheLife, cacheTag, revalidateTag } from "next/cache";
import { type DigitalProduct, PREVIEW_PRODUCTS, toneFor } from "@/lib/digital-products";
import { type AdminProduct, DOWNLOADABLE_TYPES, linkProvider } from "@/lib/digital-products/admin";
import { getDb } from "../db/client";
import { AppError } from "../errors";
import { logger } from "../log";
import { livePublishedRows, toAdminProduct } from "./products";

/*
 * The public marketplace = published admin products. Until at least one is published it shows the concept
 * previews instead (no prices, noindex). Read through a tagged cache that every admin write clears.
 * The public shape carries file names and sizes and link labels only: never file bytes or link URLs.
 */

export const DIGITAL_PRODUCTS_TAG = "digital-products";

/** Call after any admin change to products or categories so pages and the sitemap rebuild on their next request. */
export const digitalProductsChanged = () => revalidateTag(DIGITAL_PRODUCTS_TAG, { expire: 0 });

const day = (d: string | null) => (d ? d.slice(0, 10) : undefined);

/** Maps an admin product to the public shape (also used for staff previews of drafts). */
export function toDigitalProduct(a: AdminProduct): DigitalProduct {
  const images = [a.featuredImage, ...a.galleryImages].filter((x): x is NonNullable<typeof x> => x !== null);
  const formats = [...new Set(a.files.map((f) => DOWNLOADABLE_TYPES[f.mime] ?? f.mime))];
  const image = a.featuredImage ?? a.galleryImages[0] ?? null;
  return {
    id: a.slug,
    title: a.title,
    category: a.category,
    categoryName: a.categoryName,
    type: a.productType,
    description: a.shortDescription,
    includes: a.includes,
    price: a.pricing === "paid" && a.priceCents ? { kind: "paid", cents: a.priceCents, currency: a.currency } : a.pricing === "free" ? { kind: "free" } : { kind: "unset" },
    featured: a.featured,
    tone: toneFor(a.slug),
    ...(a.status === "published" && a.publishedAt ? { listedAt: day(a.publishedAt) } : {}),
    ...(images.length ? { images: images.map((i) => ({ src: i.src, alt: i.alt || a.title, width: i.width, height: i.height })) } : {}),
    ...(formats.length ? { formats } : {}),
    ...(a.specifications.length ? { specifications: a.specifications } : {}),
    ...(a.compatibility.length ? { compatibility: a.compatibility } : {}),
    ...(a.requirements.length ? { requirements: a.requirements } : {}),
    ...(a.licenseType ? { license: a.licenseType } : {}),
    source: "admin",
    availability: a.availability,
    rich: a.content,
    ...(a.highlights.length ? { highlights: a.highlights } : {}),
    ...(a.usageTerms ? { licenseTerms: a.usageTerms } : {}),
    downloads: {
      files: a.files.map((f) => ({ id: f.id, name: f.filename, sizeBytes: f.sizeBytes, type: DOWNLOADABLE_TYPES[f.mime] ?? f.mime, version: f.version })),
      links: a.downloadLinks.map((l) => ({ id: l.id, label: l.label || "Download", title: l.title, instructions: l.instructions, provider: linkProvider(l.url) })),
    },
    ...(a.seoTitle ? { seoTitle: a.seoTitle } : {}),
    metaDescription: a.metaDescription || a.shortDescription,
    keywords: [a.focusKeyword, ...a.keywords].filter(Boolean),
    social: {
      title: a.socialTitle || undefined,
      description: a.socialDescription || undefined,
      image: a.socialImage ? { src: a.socialImage.src, mime: a.socialImage.mime } : image ? { src: image.src, mime: image.mime } : undefined,
    },
  };
}

async function readLive(slug?: string): Promise<DigitalProduct[]> {
  try {
    const db = getDb();
    const rows = await livePublishedRows(db, slug);
    return await Promise.all(rows.map(async ({ p }) => toDigitalProduct(await toAdminProduct(db, p))));
  } catch (e) {
    // No database configured is normal (public-only deployments); anything else is worth a warning.
    if (!(e instanceof AppError)) logger().warn({ reason: (e instanceof Error ? (e.cause instanceof Error ? e.cause.message : e.message) : String(e)).split("\n")[0].slice(0, 200) }, "digital products unavailable");
    return [];
  }
}

/** Published products, newest first. */
export async function liveDigitalProducts(): Promise<DigitalProduct[]> {
  "use cache";
  cacheTag(DIGITAL_PRODUCTS_TAG);
  cacheLife("minutes");
  return readLive();
}

/** One published product, cached per slug (a product published after the build has no build-time entry). */
export async function liveDigitalProduct(slug: string): Promise<DigitalProduct | null> {
  "use cache";
  cacheTag(DIGITAL_PRODUCTS_TAG);
  cacheLife("minutes");
  const [p] = await readLive(slug);
  return p ?? null;
}

/** What the marketplace lists: published products, or the labelled concept previews while there are none. */
export async function getMarketplace(): Promise<{ products: DigitalProduct[]; preview: boolean }> {
  const live = await liveDigitalProducts();
  return live.length ? { products: live, preview: false } : { products: PREVIEW_PRODUCTS, preview: true };
}

/** A public product page: a published product, or a concept while nothing real is published. */
export async function findMarketplaceProduct(slug: string): Promise<{ product: DigitalProduct; products: DigitalProduct[]; preview: boolean } | null> {
  const product = await liveDigitalProduct(slug);
  const market = await getMarketplace();
  if (product) return { product, products: market.preview ? [product] : market.products, preview: false };
  if (!market.preview) return null;
  const concept = PREVIEW_PRODUCTS.find((p) => p.id === slug);
  return concept ? { product: concept, products: PREVIEW_PRODUCTS, preview: true } : null;
}
