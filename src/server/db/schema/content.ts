import { sql } from "drizzle-orm";
import { boolean, check, customType, index, integer, pgTable, primaryKey, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { BLOG_MEDIA_MIME } from "./enums";
import { createdAt, oneOf, updatedAt } from "./helpers";
import { customers } from "./identity";
import { socialPosts } from "./publishing";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });

/*
 * Content workspace (CM-01): the customer's media library and reusable templates. Folders live next to
 * the posts they organise. Everything here belongs to exactly one customer and is only ever read or
 * changed through that customer's session.
 */

/**
 * Images a customer uploaded. Bytes are validated by signature and dimensions before insert (JPEG, PNG
 * or WebP only, never SVG) and served only to their owner from /media/library/{id}. Identical files are
 * stored once per customer.
 */
export const contentMedia = pgTable(
  "content_media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    mime: text("mime").notNull(),
    bytes: bytea("bytes").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    sha256: text("sha256").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("content_media_customer_sha_idx").on(t.customerId, t.sha256),
    index("content_media_customer_idx").on(t.customerId, t.createdAt),
    check("content_media_name_check", sql`char_length(btrim(${t.name})) between 1 and 100`),
    check("content_media_mime_check", oneOf(t.mime, BLOG_MEDIA_MIME)),
    check("content_media_size_check", sql`${t.sizeBytes} between 1 and 5242880 and octet_length(${t.bytes}) = ${t.sizeBytes}`),
    check("content_media_dimensions_check", sql`${t.width} between 1 and 12000 and ${t.height} between 1 and 12000`),
  ],
);

/** Which library images a post uses. The post's own `media` summary is rebuilt from this. */
export const contentPostMedia = pgTable(
  "content_post_media",
  {
    postId: uuid("post_id")
      .notNull()
      .references(() => socialPosts.id, { onDelete: "cascade" }),
    mediaId: uuid("media_id")
      .notNull()
      .references(() => contentMedia.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.postId, t.mediaId] }), index("content_post_media_media_idx").on(t.mediaId)],
);

/** A reusable caption: personal to one customer, copied (never linked) into a new draft when used. */
export const contentTemplates = pgTable(
  "content_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    body: text("body").notNull().default(""),
    hashtags: text("hashtags").array().notNull().default(sql`'{}'::text[]`),
    providers: text("providers").array().notNull().default(sql`'{}'::text[]`),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("content_templates_customer_idx").on(t.customerId, t.updatedAt),
    check("content_templates_check", sql`char_length(btrim(${t.name})) between 1 and 60 and char_length(${t.body}) <= 5000 and cardinality(${t.hashtags}) <= 30`),
  ],
);

/**
 * A brand profile (BR-01): one customer's identity, audience and voice, reusable across drafts and AI tools. The
 * logo and cover are images from the customer's own media library (deleting one just clears it here). A customer
 * can have several brands and at most one default, enforced by the partial unique index. Deleting a brand never
 * deletes drafts or media: posts simply lose the link.
 */
export const brands = pgTable(
  "brands",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    website: text("website"),
    industry: text("industry").notNull().default(""),
    logoMediaId: uuid("logo_media_id").references(() => contentMedia.id, { onDelete: "set null" }),
    coverMediaId: uuid("cover_media_id").references(() => contentMedia.id, { onDelete: "set null" }),
    primaryColor: text("primary_color"),
    secondaryColor: text("secondary_color"),
    accentColor: text("accent_color"),
    personality: text("personality").array().notNull().default(sql`'{}'::text[]`),
    toneOfVoice: text("tone_of_voice").notNull().default(""),
    audience: text("audience").notNull().default(""),
    demographics: text("demographics").notNull().default(""),
    platforms: text("platforms").array().notNull().default(sql`'{}'::text[]`),
    keywords: text("keywords").array().notNull().default(sql`'{}'::text[]`),
    hashtags: text("hashtags").array().notNull().default(sql`'{}'::text[]`),
    writingGuidelines: text("writing_guidelines").notNull().default(""),
    preferredPhrases: text("preferred_phrases").array().notNull().default(sql`'{}'::text[]`),
    avoidWords: text("avoid_words").array().notNull().default(sql`'{}'::text[]`),
    isDefault: boolean("is_default").notNull().default(false),
    /** Bumped on every edit so two tabs can't silently overwrite each other. */
    version: integer("version").notNull().default(1),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("brands_name_idx").on(t.customerId, sql`lower(${t.name})`),
    uniqueIndex("brands_default_idx").on(t.customerId).where(sql`${t.isDefault}`),
    index("brands_customer_idx").on(t.customerId, t.updatedAt),
    check("brands_name_check", sql`char_length(btrim(${t.name})) between 1 and 60`),
    check("brands_text_check", sql`char_length(${t.description}) <= 600 and char_length(${t.industry}) <= 60 and (${t.website} is null or char_length(${t.website}) <= 200) and char_length(${t.toneOfVoice}) <= 500 and char_length(${t.audience}) <= 1000 and char_length(${t.demographics}) <= 500 and char_length(${t.writingGuidelines}) <= 2000`),
    check("brands_colors_check", sql`(${t.primaryColor} is null or ${t.primaryColor} ~ '^#[0-9a-f]{6}$') and (${t.secondaryColor} is null or ${t.secondaryColor} ~ '^#[0-9a-f]{6}$') and (${t.accentColor} is null or ${t.accentColor} ~ '^#[0-9a-f]{6}$')`),
    check("brands_lists_check", sql`cardinality(${t.personality}) <= 8 and cardinality(${t.keywords}) <= 20 and cardinality(${t.hashtags}) <= 30 and cardinality(${t.preferredPhrases}) <= 20 and cardinality(${t.avoidWords}) <= 20 and cardinality(${t.platforms}) <= 6`),
  ],
);
