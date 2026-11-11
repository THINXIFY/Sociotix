import { sql } from "drizzle-orm";
import { check, customType, index, integer, pgTable, primaryKey, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
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
