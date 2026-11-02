import { sql } from "drizzle-orm";
import { boolean, check, customType, index, integer, jsonb, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { DIGITAL_CATEGORIES } from "../../../lib/digital-products";
import { blogMedia } from "./blog";
import { createdAt, oneOf, ts, updatedAt } from "./helpers";
import { users } from "./identity";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });

/* -------------------------------------------------------------------------- */
/*  Digital Products Marketplace                                              */
/* -------------------------------------------------------------------------- */

export const DIGITAL_PRODUCT_STATUS = ["draft", "published", "archived"] as const;
export const DIGITAL_PRODUCT_PRICING = ["free", "paid", "unset"] as const;
export const DIGITAL_PRODUCT_AVAILABILITY = ["coming_soon", "available"] as const;
export const DIGITAL_FILE_MIME = ["application/zip", "application/pdf", "application/epub+zip", "image/png", "image/jpeg", "image/webp"] as const;

/**
 * Products written in Admin → Digital Products. Images reference blog_media (the existing validated image
 * store). Download links are kept here but never sent to public pages; they're released by an authorised
 * endpoint only. Published means visible on the marketplace; it never enables purchases.
 */
export const digitalProducts = pgTable(
  "digital_products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    shortDescription: text("short_description").notNull().default(""),
    /** RichBlock[] (validated JSON, never HTML). */
    content: jsonb("content").$type<unknown[]>().notNull().default([]),
    category: text("category").notNull(),
    productType: text("product_type").notNull(),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    pricing: text("pricing").notNull().default("unset"),
    priceCents: integer("price_cents"),
    currency: text("currency").notNull().default("USD"),
    availability: text("availability").notNull().default("coming_soon"),
    status: text("status").notNull().default("draft"),
    featured: boolean("featured").notNull().default(false),
    featuredImageId: uuid("featured_image_id").references(() => blogMedia.id, { onDelete: "set null" }),
    featuredImageAlt: text("featured_image_alt").notNull().default(""),
    gallery: jsonb("gallery").$type<{ mediaId: string; alt: string }[]>().notNull().default([]),
    includes: jsonb("includes").$type<string[]>().notNull().default([]),
    highlights: jsonb("highlights").$type<string[]>().notNull().default([]),
    specifications: jsonb("specifications").$type<string[]>().notNull().default([]),
    compatibility: jsonb("compatibility").$type<string[]>().notNull().default([]),
    requirements: jsonb("requirements").$type<string[]>().notNull().default([]),
    licenseType: text("license_type").notNull().default(""),
    usageTerms: text("usage_terms").notNull().default(""),
    /** [{ id, url, label, title, instructions }] — private; see note above. */
    downloadLinks: jsonb("download_links").$type<{ id: string; url: string; label: string; title: string; instructions: string }[]>().notNull().default([]),
    focusKeyword: text("focus_keyword").notNull().default(""),
    keywords: jsonb("keywords").$type<string[]>().notNull().default([]),
    seoTitle: text("seo_title").notNull().default(""),
    metaDescription: text("meta_description").notNull().default(""),
    socialTitle: text("social_title").notNull().default(""),
    socialDescription: text("social_description").notNull().default(""),
    socialImageId: uuid("social_image_id").references(() => blogMedia.id, { onDelete: "set null" }),
    publishedAt: ts("published_at"),
    version: integer("version").notNull().default(1),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("digital_products_slug_key").on(t.slug),
    index("digital_products_public_idx").on(t.status, t.publishedAt.desc()),
    index("digital_products_updated_idx").on(t.updatedAt.desc()),
    check("digital_products_slug_check", sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(${t.slug}) <= 80`),
    check("digital_products_title_check", sql`length(${t.title}) between 1 and 160`),
    check("digital_products_category_check", sql`${t.category} ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(${t.category}) <= 60`),
    check("digital_products_pricing_check", oneOf(t.pricing, DIGITAL_PRODUCT_PRICING)),
    check("digital_products_price_check", sql`(${t.pricing} = 'paid' and ${t.priceCents} between 1 and 100000000) or (${t.pricing} <> 'paid' and ${t.priceCents} is null)`),
    check("digital_products_currency_check", sql`${t.currency} ~ '^[A-Z]{3}$'`),
    check("digital_products_availability_check", oneOf(t.availability, DIGITAL_PRODUCT_AVAILABILITY)),
    check("digital_products_status_check", oneOf(t.status, DIGITAL_PRODUCT_STATUS)),
    check("digital_products_published_check", sql`${t.status} <> 'published' or ${t.publishedAt} is not null`),
  ],
);

/** Downloadable files, stored privately in PostgreSQL and served only by a permission-checked endpoint. */
export const digitalProductFiles = pgTable(
  "digital_product_files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => digitalProducts.id, { onDelete: "cascade" }),
    filename: text("filename").notNull(),
    mime: text("mime").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    bytes: bytea("bytes").notNull(),
    sha256: text("sha256").notNull(),
    version: text("version").notNull().default(""),
    position: integer("position").notNull().default(0),
    uploadedBy: uuid("uploaded_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [
    index("digital_product_files_product_idx").on(t.productId, t.position),
    check("digital_product_files_mime_check", oneOf(t.mime, DIGITAL_FILE_MIME)),
    check("digital_product_files_size_check", sql`${t.sizeBytes} between 1 and 8388608 and octet_length(${t.bytes}) = ${t.sizeBytes}`),
    check("digital_product_files_name_check", sql`length(${t.filename}) between 1 and 160`),
    check("digital_product_files_version_check", sql`length(${t.version}) <= 40`),
  ],
);

/** Custom marketplace categories, alongside the eight built-in ones (which live in code and are reserved). */
export const digitalCategories = pgTable(
  "digital_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("digital_categories_slug_key").on(t.slug),
    uniqueIndex("digital_categories_name_key").on(sql`lower(${t.name})`),
    check("digital_categories_slug_check", sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(${t.slug}) <= 60`),
    check("digital_categories_name_check", sql`length(${t.name}) between 1 and 60`),
    check("digital_categories_reserved_check", sql`${t.slug} not in (${sql.raw(DIGITAL_CATEGORIES.map((c) => `'${c.id}'`).join(", "))})`),
  ],
);
