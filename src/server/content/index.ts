import "server-only";
import { createHash } from "node:crypto";
import { and, count, eq, isNotNull, sql } from "drizzle-orm";
import { z } from "zod";
import {
  AI_SAVE_SOURCES,
  BULK_MAX,
  IMPORT_MAX,
  NOTES_MAX,
  FOLDER_NAME_MAX,
  FOLDERS_MAX,
  HASHTAGS_MAX,
  MEDIA_FILES_MAX,
  MEDIA_NAME_MAX,
  MEDIA_PER_POST_MAX,
  MEDIA_TOTAL_BYTES,
  TEMPLATE_NAME_MAX,
  TEMPLATES_MAX,
  type ContentMeta,
  type MediaView,
} from "@/lib/social/content";
import { isSocialProvider, SOCIAL_PROVIDER_IDS } from "@/lib/social/platforms";
import { POST_TEXT_MAX } from "@/lib/social/publishing";
import { isTimeZone } from "@/lib/social/time";
import { hit } from "../auth/rate-limit";
import { inspectImage } from "../blog/media";
import type { Db, Executor } from "../db/client";
import { assertOwnBrand, brandSummaries } from "../brand";
import { campaignSummaries } from "../campaign";
import { assertBrandFitsCampaign } from "../campaign/rules";
import { contentFolders, contentMedia, contentPostMedia, contentTemplates, socialPosts } from "../db/schema";
import { AppError, errors, pgErrorOf } from "../errors";
import { attachMedia, deletePost, ownPost, rebuildPostMedia, saveDraft, toUtc } from "../social/publishing";

/**
 * The content workspace (CM-01): organising posts (favorites, archive, folders), reusable templates and
 * the customer's media library. Every function takes the signed-in customer's id and only ever reads or
 * changes that customer's rows; a record that belongs to someone else is reported as "not found".
 */

const uuid = z.string().uuid();
const isUuid = (s: string) => uuid.safeParse(s).success;

async function limitWrites(db: Executor, customerId: string) {
  const r = await hit(db, "contentWrites", customerId, { limit: 600, windowSeconds: 3600 });
  if (!r.ok) throw new AppError("RATE_LIMITED", "You've made a lot of changes in a short time. Please wait a few minutes.");
}

/** Single-spaced, control-free text for names. */
const tidy = (s: string) => s.normalize("NFC").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
const name = (max: number, what: string) =>
  z
    .string()
    .transform(tidy)
    .refine((s) => s.length >= 1, `${what} can't be empty.`)
    .refine((s) => Array.from(s).length <= max, `${what} can be up to ${max} characters.`);

/* -------------------------------------------------------------------------- */
/*  Overview                                                                  */
/* -------------------------------------------------------------------------- */

export async function contentMeta(db: Db, customerId: string): Promise<ContentMeta> {
  const [folders, folderCounts, templates, media, usage, brandList] = await Promise.all([
    db.select().from(contentFolders).where(eq(contentFolders.customerId, customerId)).orderBy(sql`lower(${contentFolders.name})`),
    db.select({ folderId: socialPosts.folderId, n: count() }).from(socialPosts).where(and(eq(socialPosts.customerId, customerId), isNotNull(socialPosts.folderId))).groupBy(socialPosts.folderId),
    db.select().from(contentTemplates).where(eq(contentTemplates.customerId, customerId)).orderBy(sql`${contentTemplates.updatedAt} desc`),
    db
      .select({ id: contentMedia.id, name: contentMedia.name, mime: contentMedia.mime, sizeBytes: contentMedia.sizeBytes, width: contentMedia.width, height: contentMedia.height, createdAt: contentMedia.createdAt })
      .from(contentMedia)
      .where(eq(contentMedia.customerId, customerId))
      .orderBy(sql`${contentMedia.createdAt} desc`),
    db.select({ mediaId: contentPostMedia.mediaId, n: count() }).from(contentPostMedia).where(eq(contentPostMedia.customerId, customerId)).groupBy(contentPostMedia.mediaId),
    brandSummaries(db, customerId),
  ]);
  const campaignList = await campaignSummaries(db, customerId);
  const used = new Map(usage.map((u) => [u.mediaId, u.n]));
  const counts = new Map(folderCounts.map((c) => [c.folderId, c.n]));
  const mediaViews: MediaView[] = media.map((m) => ({ ...m, createdAt: m.createdAt.toISOString(), usedBy: used.get(m.id) ?? 0 }));
  return {
    folders: folders.map((f) => ({ id: f.id, name: f.name, count: counts.get(f.id) ?? 0 })),
    brands: brandList,
    campaigns: campaignList,
    templates: templates.map((t) => ({ id: t.id, name: t.name, body: t.body, hashtags: t.hashtags, providers: t.providers.filter(isSocialProvider), updatedAt: t.updatedAt.toISOString() })),
    media: mediaViews,
    mediaBytes: mediaViews.reduce((a, m) => a + m.sizeBytes, 0),
  };
}

/* -------------------------------------------------------------------------- */
/*  Folders                                                                   */
/* -------------------------------------------------------------------------- */

export async function listFolders(db: Db, customerId: string) {
  const rows = await db.select({ id: contentFolders.id, name: contentFolders.name }).from(contentFolders).where(eq(contentFolders.customerId, customerId)).orderBy(sql`lower(${contentFolders.name})`);
  return rows;
}

const folderInput = z.strictObject({ name: name(FOLDER_NAME_MAX, "A folder name") });

function mapFolderError(e: unknown): never {
  if (pgErrorOf(e)?.code === "23505") throw errors.conflict("You already have a folder with that name.");
  throw e;
}

export async function createFolder(db: Db, customerId: string, raw: unknown) {
  const { name: n } = folderInput.parse(raw);
  await limitWrites(db, customerId);
  const [{ c }] = (await db.select({ c: count() }).from(contentFolders).where(eq(contentFolders.customerId, customerId))) as [{ c: number }];
  if (c >= FOLDERS_MAX) throw errors.conflict(`You can keep up to ${FOLDERS_MAX} folders.`);
  try {
    const [f] = await db.insert(contentFolders).values({ customerId, name: n }).returning();
    return { id: f!.id, name: f!.name, count: 0 };
  } catch (e) {
    mapFolderError(e);
  }
}

export async function renameFolder(db: Db, customerId: string, id: string, raw: unknown) {
  const { name: n } = folderInput.parse(raw);
  if (!isUuid(id)) throw errors.notFound("That folder");
  await limitWrites(db, customerId);
  try {
    const [f] = await db.update(contentFolders).set({ name: n, updatedAt: new Date() }).where(and(eq(contentFolders.id, id), eq(contentFolders.customerId, customerId))).returning();
    if (!f) throw errors.notFound("That folder");
    return { id: f.id, name: f.name };
  } catch (e) {
    if (e instanceof AppError) throw e;
    mapFolderError(e);
  }
}

/** Deleting a folder never deletes its posts; they simply become unfiled. */
export async function deleteFolder(db: Db, customerId: string, id: string) {
  if (!isUuid(id)) throw errors.notFound("That folder");
  await limitWrites(db, customerId);
  const gone = await db.delete(contentFolders).where(and(eq(contentFolders.id, id), eq(contentFolders.customerId, customerId))).returning({ id: contentFolders.id });
  if (!gone.length) throw errors.notFound("That folder");
}

/* -------------------------------------------------------------------------- */
/*  Posts: favorites, archive, folders, planning, bulk                         */
/* -------------------------------------------------------------------------- */

const flagsInput = z
  .strictObject({
    favorite: z.boolean().optional(),
    archived: z.boolean().optional(),
    folderId: z.string().uuid().nullable().optional(),
    /** Brand Kit (BR-01): assign a brand, or null to clear it. Changing it never touches the draft's content or version. */
    brandId: z.string().uuid().nullable().optional(),
    /** Plan the draft on the calendar (a local date and time), or clear it with null. */
    plannedLocal: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/).nullable().optional(),
    timezone: z.string().refine(isTimeZone, "Unknown time zone.").optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "Nothing to change.")
  .refine((v) => v.plannedLocal === undefined || v.plannedLocal === null || v.timezone !== undefined, "A planned time needs a time zone.");
export type PostFlags = z.infer<typeof flagsInput>;

async function applyFlags(tx: Executor, customerId: string, id: string, f: PostFlags) {
  const p = await ownPost(tx, customerId, id, true);
  const set: Partial<typeof socialPosts.$inferInsert> = {};
  if (f.archived === true && p.status === "scheduled") throw errors.conflict("This post is scheduled. Cancel the schedule before archiving it.");
  if (f.plannedLocal !== undefined && p.status === "scheduled") throw errors.conflict("This post is scheduled. Cancel the schedule to change its planned date.");
  // Archived content stays out of planning: restore it first (clearing a date is always allowed).
  if (f.plannedLocal && (p.archivedAt ? f.archived !== false : false)) throw errors.conflict("This post is archived. Restore it before planning it on the calendar.");
  if (f.favorite !== undefined) set.favorite = f.favorite;
  if (f.archived !== undefined) set.archivedAt = f.archived ? (p.archivedAt ?? new Date()) : null;
  if (f.folderId !== undefined) {
    if (f.folderId) {
      const [own] = await tx.select({ id: contentFolders.id }).from(contentFolders).where(and(eq(contentFolders.id, f.folderId), eq(contentFolders.customerId, customerId)));
      if (!own) throw new AppError("VALIDATION_FAILED", "That folder isn't available.", { details: { field: "folderId" } });
    }
    set.folderId = f.folderId;
  }
  if (f.brandId !== undefined) {
    await assertOwnBrand(tx, customerId, f.brandId);
    await assertBrandFitsCampaign(tx, customerId, p.campaignId, f.brandId);
    set.brandId = f.brandId;
  }
  if (f.plannedLocal !== undefined) {
    set.plannedAt = f.plannedLocal ? new Date(toUtc(f.plannedLocal, f.timezone!).iso) : null;
    if (f.timezone) set.timezone = f.timezone;
  }
  // Organising a post is not an edit of its content, so the version (used to catch conflicting edits) stays put.
  await tx.update(socialPosts).set({ ...set, updatedAt: new Date() }).where(and(eq(socialPosts.id, id), eq(socialPosts.customerId, customerId)));
}

export async function setPostFlags(db: Db, customerId: string, id: string, raw: unknown) {
  const flags = flagsInput.parse(raw);
  await limitWrites(db, customerId);
  await db.transaction((tx) => applyFlags(tx, customerId, id, flags));
}

const mediaInput = z.strictObject({ mediaIds: z.array(z.string().uuid()).max(MEDIA_PER_POST_MAX, `Attach up to ${MEDIA_PER_POST_MAX} images.`), expectedVersion: z.number().int().min(1) });

/**
 * Replaces the images attached to one of the caller's own drafts (order kept) without touching its text, planned
 * date or anything else. Like any content edit it needs the version the caller last saw, so a stale tab can't
 * overwrite newer work, and it bumps the version.
 */
export async function setPostMedia(db: Db, customerId: string, id: string, raw: unknown) {
  const input = mediaInput.parse(raw);
  await limitWrites(db, customerId);
  return db.transaction(async (tx) => {
    const p = await ownPost(tx, customerId, id, true);
    if (p.status === "scheduled") throw errors.conflict("This post is scheduled. Cancel the schedule to change its images.");
    if (p.version !== input.expectedVersion) throw errors.conflict("This draft was changed somewhere else (another tab or device). Reload to see the latest version before editing.");
    await attachMedia(tx, customerId, id, input.mediaIds);
    const [u] = await tx
      .update(socialPosts)
      .set({ version: sql`${socialPosts.version} + 1`, updatedAt: new Date() })
      .where(and(eq(socialPosts.id, id), eq(socialPosts.customerId, customerId)))
      .returning({ version: socialPosts.version });
    return { version: u!.version, mediaIds: [...new Set(input.mediaIds)] };
  });
}

const bulkInput = z.discriminatedUnion("action", [
  z.strictObject({ action: z.enum(["favorite", "unfavorite", "archive", "restore", "delete"]), ids: z.array(z.string().uuid()).min(1).max(BULK_MAX) }),
  z.strictObject({ action: z.literal("move"), ids: z.array(z.string().uuid()).min(1).max(BULK_MAX), folderId: z.string().uuid().nullable() }),
  z.strictObject({ action: z.literal("brand"), ids: z.array(z.string().uuid()).min(1).max(BULK_MAX), brandId: z.string().uuid().nullable() }),
]);

type BulkInput = z.infer<typeof bulkInput>;
function flagsFor(input: BulkInput): PostFlags {
  switch (input.action) {
    case "favorite":
      return { favorite: true };
    case "unfavorite":
      return { favorite: false };
    case "archive":
      return { archived: true };
    case "restore":
      return { archived: false };
    case "move":
      return { folderId: input.folderId };
    case "brand":
      return { brandId: input.brandId };
    default:
      throw new AppError("VALIDATION_FAILED", "Unknown action.");
  }
}

/** Applies one action to several posts. Each post is handled on its own, so one that can't change (for example a scheduled post) doesn't stop the rest. */
export async function bulkPosts(db: Db, customerId: string, raw: unknown): Promise<{ done: number; skipped: { id: string; reason: string }[] }> {
  const input = bulkInput.parse(raw);
  await limitWrites(db, customerId);
  const ids = [...new Set(input.ids)];
  let done = 0;
  const skipped: { id: string; reason: string }[] = [];
  for (const id of ids) {
    try {
      if (input.action === "delete") await deletePost(db, customerId, id);
      else {
        const flags = flagsFor(input);
        await db.transaction((tx) => applyFlags(tx, customerId, id, flags));
      }
      done++;
    } catch (e) {
      if (!(e instanceof AppError)) throw e;
      skipped.push({ id, reason: e.message });
    }
  }
  return { done, skipped };
}

/* -------------------------------------------------------------------------- */
/*  Templates                                                                 */
/* -------------------------------------------------------------------------- */

const tagList = z
  .array(z.string().normalize("NFC").pipe(z.string().regex(/^[\p{L}\p{N}_]{1,50}$/u, "Hashtags can use letters, numbers and underscores.")))
  .max(HASHTAGS_MAX)
  .transform((a) => a.filter((t, i) => a.findIndex((u) => u.toLowerCase() === t.toLowerCase()) === i));
const body = z
  .string()
  .transform((s) => s.normalize("NFC").replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ""))
  .refine((s) => Array.from(s).length <= POST_TEXT_MAX, `A template can be up to ${POST_TEXT_MAX.toLocaleString("en-US")} characters.`);
const providers = z.array(z.enum(SOCIAL_PROVIDER_IDS)).max(6).transform((a) => [...new Set(a)]);

const templateInput = z.strictObject({ name: name(TEMPLATE_NAME_MAX, "A template name"), text: body.default(""), hashtags: tagList.default([]), providers: providers.default([]) });
const templateFromPost = z.strictObject({ fromPostId: z.string().uuid(), name: name(TEMPLATE_NAME_MAX, "A template name").optional() });

export async function createTemplate(db: Db, customerId: string, raw: unknown) {
  await limitWrites(db, customerId);
  const [{ c }] = (await db.select({ c: count() }).from(contentTemplates).where(eq(contentTemplates.customerId, customerId))) as [{ c: number }];
  if (c >= TEMPLATES_MAX) throw errors.conflict(`You can keep up to ${TEMPLATES_MAX} templates.`);
  const asPost = templateFromPost.safeParse(raw);
  let values: { name: string; body: string; hashtags: string[]; providers: string[] };
  if (asPost.success) {
    const p = await ownPost(db, customerId, asPost.data.fromPostId);
    const title = tidy(p.title ?? "") || tidy(p.body.split("\n")[0] ?? "") || "Untitled template";
    values = { name: asPost.data.name ?? Array.from(title).slice(0, TEMPLATE_NAME_MAX).join(""), body: p.body, hashtags: p.hashtags, providers: p.providers };
  } else {
    const i = templateInput.parse(raw);
    values = { name: i.name, body: i.text, hashtags: i.hashtags, providers: i.providers };
  }
  const [t] = await db.insert(contentTemplates).values({ customerId, ...values }).returning();
  return { id: t!.id, name: t!.name, body: t!.body, hashtags: t!.hashtags, providers: t!.providers.filter(isSocialProvider), updatedAt: t!.updatedAt.toISOString() };
}

export async function updateTemplate(db: Db, customerId: string, id: string, raw: unknown) {
  const i = templateInput.parse(raw);
  if (!isUuid(id)) throw errors.notFound("That template");
  await limitWrites(db, customerId);
  const [t] = await db
    .update(contentTemplates)
    .set({ name: i.name, body: i.text, hashtags: i.hashtags, providers: i.providers, updatedAt: new Date() })
    .where(and(eq(contentTemplates.id, id), eq(contentTemplates.customerId, customerId)))
    .returning();
  if (!t) throw errors.notFound("That template");
  return { id: t.id, name: t.name, body: t.body, hashtags: t.hashtags, providers: t.providers.filter(isSocialProvider), updatedAt: t.updatedAt.toISOString() };
}

export async function deleteTemplate(db: Db, customerId: string, id: string) {
  if (!isUuid(id)) throw errors.notFound("That template");
  await limitWrites(db, customerId);
  const gone = await db.delete(contentTemplates).where(and(eq(contentTemplates.id, id), eq(contentTemplates.customerId, customerId))).returning({ id: contentTemplates.id });
  if (!gone.length) throw errors.notFound("That template");
}

/** Copies a template into a new draft (the draft is independent of the template afterwards). */
export async function useTemplate(db: Db, customerId: string, id: string, raw: unknown) {
  const { timezone } = z.strictObject({ timezone: z.string().refine(isTimeZone, "Unknown time zone.") }).parse(raw);
  if (!isUuid(id)) throw errors.notFound("That template");
  const [t] = await db.select().from(contentTemplates).where(and(eq(contentTemplates.id, id), eq(contentTemplates.customerId, customerId)));
  if (!t) throw errors.notFound("That template");
  return saveDraft(db, customerId, null, { title: t.name, text: t.body, providers: t.providers.filter(isSocialProvider), hashtags: t.hashtags, timezone });
}

/* -------------------------------------------------------------------------- */
/*  Saving AI results (CM-03)                                                 */
/* -------------------------------------------------------------------------- */

const importItem = z.strictObject({
  title: z.string().transform(tidy).default(""),
  text: body.default(""),
  notes: z
    .string()
    .transform((s) => s.normalize("NFC").replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ""))
    .default(""),
  providers: providers.default([]),
  hashtags: tagList.default([]),
});
const importInput = z.strictObject({
  source: z.enum(Object.keys(AI_SAVE_SOURCES) as [keyof typeof AI_SAVE_SOURCES, ...(keyof typeof AI_SAVE_SOURCES)[]]),
  kind: z.enum(["draft", "template"]),
  folderId: z.string().uuid().nullable().optional(),
  /** Brand Kit (BR-01): the brand the saved drafts are for. Hashtag templates have no brand. */
  brandId: z.string().uuid().nullable().optional(),
  timezone: z.string().refine(isTimeZone, "Unknown time zone."),
  items: z.array(importItem).min(1, "There's nothing to save.").max(IMPORT_MAX, `Save up to ${IMPORT_MAX} items at a time.`),
});

const DUPLICATE_WINDOW_MS = 30 * 60_000;
const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

export interface ImportResult {
  kind: "draft" | "template";
  /** Saved now. */
  created: { id: string; name: string }[];
  /** Already saved from the same result a moment ago (a repeated click or request), so nothing new was made. */
  duplicates: { id: string; name: string }[];
  /** Items that couldn't be saved, with the reason. */
  skipped: { index: number; reason: string }[];
}

/**
 * Saves results the customer is looking at from an AI tool: social-content results become drafts (the same
 * social_posts records the editor, library and calendar use), hashtag sets become templates. Only text that is
 * really there is saved; blank items are refused, never padded. Saving the same thing again within a few minutes
 * returns what was saved before instead of making a second copy. Nothing is planned, scheduled or published.
 */
export async function importAiContent(db: Db, customerId: string, raw: unknown): Promise<ImportResult> {
  const input = importInput.parse(raw);
  const source = AI_SAVE_SOURCES[input.source];
  if (source.kind !== input.kind) throw new AppError("VALIDATION_FAILED", input.kind === "draft" ? "Hashtag sets are saved as templates." : "Those results are saved as drafts.");
  await limitWrites(db, customerId);
  if (input.folderId) {
    const [own] = await db.select({ id: contentFolders.id }).from(contentFolders).where(and(eq(contentFolders.id, input.folderId), eq(contentFolders.customerId, customerId)));
    if (!own) throw new AppError("VALIDATION_FAILED", "That folder isn't available.", { details: { field: "folderId" } });
  }
  await assertOwnBrand(db, customerId, input.brandId);
  const provenance = `Saved from ${source.label}.`;
  const since = new Date(Date.now() - DUPLICATE_WINDOW_MS);
  const out: ImportResult = { kind: input.kind, created: [], duplicates: [], skipped: [] };

  for (const [index, it] of input.items.entries()) {
    try {
      if (input.kind === "template") {
        if (!it.title) throw new AppError("VALIDATION_FAILED", "Give the template a name.");
        if (!it.hashtags.length && !it.text.trim()) throw new AppError("VALIDATION_FAILED", "There are no hashtags to save.");
        const name = Array.from(it.title).slice(0, TEMPLATE_NAME_MAX).join("");
        const recent = await db.select().from(contentTemplates).where(and(eq(contentTemplates.customerId, customerId), eq(contentTemplates.name, name), sql`${contentTemplates.createdAt} > ${since}`));
        const dupe = recent.find((t) => t.body === it.text && sameSet(t.hashtags, it.hashtags) && sameSet(t.providers, it.providers));
        if (dupe) {
          out.duplicates.push({ id: dupe.id, name: dupe.name });
          continue;
        }
        const t = await createTemplate(db, customerId, { name, text: it.text, hashtags: it.hashtags, providers: it.providers });
        out.created.push({ id: t.id, name: t.name });
        continue;
      }
      if (!it.text.trim()) throw new AppError("VALIDATION_FAILED", "There's no text to save yet.");
      const title = it.title ? Array.from(it.title).slice(0, 100).join("") : null;
      const notes = (it.notes.trim() ? `${provenance}\n\n${it.notes.trim()}` : provenance).slice(0, NOTES_MAX);
      const recent = await db
        .select({ id: socialPosts.id, title: socialPosts.title, providers: socialPosts.providers, hashtags: socialPosts.hashtags, brandId: socialPosts.brandId })
        .from(socialPosts)
        .where(and(eq(socialPosts.customerId, customerId), eq(socialPosts.body, it.text), sql`${socialPosts.archivedAt} is null`, sql`${socialPosts.createdAt} > ${since}`, sql`${socialPosts.notes} like 'Saved from AI%'`));
      const dupe = recent.find((p) => (p.title ?? null) === title && p.brandId === (input.brandId ?? null) && sameSet(p.providers, it.providers) && sameSet(p.hashtags, it.hashtags));
      if (dupe) {
        out.duplicates.push({ id: dupe.id, name: title ?? "Draft" });
        continue;
      }
      const post = await saveDraft(db, customerId, null, { title, text: it.text, providers: it.providers, hashtags: it.hashtags, notes, folderId: input.folderId ?? null, brandId: input.kind === "draft" ? (input.brandId ?? null) : null, timezone: input.timezone });
      out.created.push({ id: post.id, name: title ?? "Draft" });
    } catch (e) {
      if (!(e instanceof AppError) && !(e instanceof z.ZodError)) throw e;
      out.skipped.push({ index, reason: e instanceof z.ZodError ? (e.issues[0]?.message ?? "That couldn't be saved.") : e.message });
    }
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/*  Media library                                                             */
/* -------------------------------------------------------------------------- */

/** "Summer Sale (final).PNG" → "Summer Sale (final)": a readable default name from the uploaded file's name. */
export function mediaNameFrom(fileName: string): string {
  const base = tidy(fileName.replace(/^.*[\\/]/, "").replace(/\.[a-z0-9]{1,5}$/i, ""));
  return Array.from(base || "Image").slice(0, MEDIA_NAME_MAX).join("");
}

/** Validates the bytes (JPEG, PNG or WebP by signature, never SVG), enforces the library limits and stores the image once per customer. */
export async function storeMedia(db: Db, customerId: string, bytes: Buffer, fileName: string): Promise<MediaView> {
  const info = inspectImage(bytes);
  await limitWrites(db, customerId);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const [existing] = await db.select({ id: contentMedia.id }).from(contentMedia).where(and(eq(contentMedia.customerId, customerId), eq(contentMedia.sha256, sha256)));
  if (!existing) {
    const [{ n, total }] = (await db
      .select({ n: count(), total: sql<number>`coalesce(sum(${contentMedia.sizeBytes}), 0)::int` })
      .from(contentMedia)
      .where(eq(contentMedia.customerId, customerId))) as [{ n: number; total: number }];
    if (n >= MEDIA_FILES_MAX) throw errors.conflict(`Your library holds up to ${MEDIA_FILES_MAX} images. Delete some you no longer use.`);
    if (total + bytes.length > MEDIA_TOTAL_BYTES) throw errors.conflict("Your media library is full. Delete some images you no longer use.");
  }
  await db
    .insert(contentMedia)
    .values({ customerId, name: mediaNameFrom(fileName), mime: info.mime, bytes, sizeBytes: bytes.length, width: info.width, height: info.height, sha256 })
    .onConflictDoNothing({ target: [contentMedia.customerId, contentMedia.sha256] });
  const [row] = await db
    .select({ id: contentMedia.id, name: contentMedia.name, mime: contentMedia.mime, sizeBytes: contentMedia.sizeBytes, width: contentMedia.width, height: contentMedia.height, createdAt: contentMedia.createdAt })
    .from(contentMedia)
    .where(and(eq(contentMedia.customerId, customerId), eq(contentMedia.sha256, sha256)));
  return { ...row!, createdAt: row!.createdAt.toISOString(), usedBy: 0 };
}

export async function renameMedia(db: Db, customerId: string, id: string, raw: unknown) {
  const { name: n } = z.strictObject({ name: name(MEDIA_NAME_MAX, "A name") }).parse(raw);
  if (!isUuid(id)) throw errors.notFound("That image");
  await limitWrites(db, customerId);
  await db.transaction(async (tx) => {
    const [m] = await tx.update(contentMedia).set({ name: n, updatedAt: new Date() }).where(and(eq(contentMedia.id, id), eq(contentMedia.customerId, customerId))).returning({ id: contentMedia.id });
    if (!m) throw errors.notFound("That image");
    const posts = await tx.select({ postId: contentPostMedia.postId }).from(contentPostMedia).where(and(eq(contentPostMedia.mediaId, id), eq(contentPostMedia.customerId, customerId)));
    for (const p of posts) await rebuildPostMedia(tx, customerId, p.postId);
  });
}

/** Removes an image from the library. Drafts that used it lose that attachment; an image used by a scheduled post stays until the schedule is cancelled. */
export async function deleteMedia(db: Db, customerId: string, id: string) {
  if (!isUuid(id)) throw errors.notFound("That image");
  await limitWrites(db, customerId);
  await db.transaction(async (tx) => {
    const used = await tx
      .select({ postId: contentPostMedia.postId, status: socialPosts.status })
      .from(contentPostMedia)
      .innerJoin(socialPosts, eq(socialPosts.id, contentPostMedia.postId))
      .where(and(eq(contentPostMedia.mediaId, id), eq(contentPostMedia.customerId, customerId)));
    if (used.some((u) => u.status === "scheduled")) throw errors.conflict("This image is used by a scheduled post. Cancel that schedule first.");
    const gone = await tx.delete(contentMedia).where(and(eq(contentMedia.id, id), eq(contentMedia.customerId, customerId))).returning({ id: contentMedia.id });
    if (!gone.length) throw errors.notFound("That image");
    for (const u of used) await rebuildPostMedia(tx, customerId, u.postId);
  });
}

/** The image bytes, only for the customer who owns it. */
export async function getMediaBytes(db: Db, customerId: string, id: string) {
  if (!isUuid(id)) return null;
  const [row] = await db.select({ mime: contentMedia.mime, bytes: contentMedia.bytes, sha256: contentMedia.sha256 }).from(contentMedia).where(and(eq(contentMedia.id, id), eq(contentMedia.customerId, customerId)));
  return row ?? null;
}

