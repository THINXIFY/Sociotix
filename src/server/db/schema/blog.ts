import { sql } from "drizzle-orm";
import { boolean, check, customType, index, integer, jsonb, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { BLOG_CATEGORIES } from "../../../lib/blog/types";
import { BLOG_AUTHOR_KIND, BLOG_MEDIA_MIME, BLOG_MEDIA_SOURCE, BLOG_POST_STATUS } from "./enums";
import { createdAt, oneOf, ts, updatedAt } from "./helpers";
import { users } from "./identity";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });

/* -------------------------------------------------------------------------- */
/*  Blog Management                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Images for blog posts, stored in PostgreSQL (there is no object storage yet). Bytes are validated
 * by signature and dimensions before insert and served from /media/blog/{id} with nosniff.
 */
export const blogMedia = pgTable(
  "blog_media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    mime: text("mime").notNull(),
    bytes: bytea("bytes").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    sha256: text("sha256").notNull(),
    source: text("source").notNull(),
    sourceUrl: text("source_url"),
    uploadedBy: uuid("uploaded_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("blog_media_sha256_key").on(t.sha256),
    check("blog_media_mime_check", oneOf(t.mime, BLOG_MEDIA_MIME)),
    check("blog_media_source_check", oneOf(t.source, BLOG_MEDIA_SOURCE)),
    check("blog_media_size_check", sql`${t.sizeBytes} between 1 and 5242880 and octet_length(${t.bytes}) = ${t.sizeBytes}`),
    check("blog_media_dimensions_check", sql`${t.width} between 1 and 12000 and ${t.height} between 1 and 12000`),
  ],
);

export const blogPosts = pgTable(
  "blog_posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    /** Card and summary text; the meta description falls back to it. */
    excerpt: text("excerpt").notNull().default(""),
    /** RichBlock[] (validated JSON, never HTML). */
    content: jsonb("content").$type<unknown[]>().notNull().default([]),
    category: text("category").notNull(),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    status: text("status").notNull().default("draft"),
    featured: boolean("featured").notNull().default(false),
    authorKind: text("author_kind").notNull().default("organization"),
    authorName: text("author_name").notNull().default("Sociotix Team"),
    featuredImageId: uuid("featured_image_id").references(() => blogMedia.id, { onDelete: "set null" }),
    featuredImageAlt: text("featured_image_alt").notNull().default(""),
    focusKeyword: text("focus_keyword").notNull().default(""),
    keywords: jsonb("keywords").$type<string[]>().notNull().default([]),
    seoTitle: text("seo_title").notNull().default(""),
    metaDescription: text("meta_description").notNull().default(""),
    socialTitle: text("social_title").notNull().default(""),
    socialDescription: text("social_description").notNull().default(""),
    socialImageId: uuid("social_image_id").references(() => blogMedia.id, { onDelete: "set null" }),
    /** Set when published; a future value means scheduled. */
    publishedAt: ts("published_at"),
    /** Optimistic concurrency: an edit based on an older version is refused. */
    version: integer("version").notNull().default(1),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("blog_posts_slug_key").on(t.slug),
    index("blog_posts_public_idx").on(t.status, t.publishedAt.desc()),
    index("blog_posts_updated_idx").on(t.updatedAt.desc()),
    check("blog_posts_slug_check", sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(${t.slug}) <= 80`),
    check("blog_posts_title_check", sql`length(${t.title}) between 1 and 160`),
    // A built-in category id or a custom category slug (checked against blog_categories by the app).
    check("blog_posts_category_check", sql`${t.category} ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(${t.category}) <= 60`),
    check("blog_posts_status_check", oneOf(t.status, BLOG_POST_STATUS)),
    check("blog_posts_author_kind_check", oneOf(t.authorKind, BLOG_AUTHOR_KIND)),
    check("blog_posts_published_check", sql`${t.status} <> 'published' or ${t.publishedAt} is not null`),
  ],
);

/** Custom categories added in Blog Management, alongside the six built-in ones (which live in code and are reserved). */
export const blogCategories = pgTable(
  "blog_categories",
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
    uniqueIndex("blog_categories_slug_key").on(t.slug),
    uniqueIndex("blog_categories_name_key").on(sql`lower(${t.name})`),
    check("blog_categories_slug_check", sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(${t.slug}) <= 60`),
    check("blog_categories_name_check", sql`length(${t.name}) between 1 and 60`),
    check("blog_categories_reserved_check", sql`${t.slug} not in (${sql.raw(BLOG_CATEGORIES.map((c) => `'${c.id}'`).join(", "))})`),
  ],
);

/** Old slugs of renamed posts, so shared links keep working (permanent redirect to the current slug). */
export const blogSlugRedirects = pgTable(
  "blog_slug_redirects",
  {
    slug: text("slug").primaryKey(),
    postId: uuid("post_id")
      .notNull()
      .references(() => blogPosts.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [index("blog_slug_redirects_post_idx").on(t.postId)],
);
