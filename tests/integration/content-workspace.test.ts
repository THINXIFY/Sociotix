import { and, eq } from "drizzle-orm";
import { Client } from "pg";
import { ZodError } from "zod";
import { afterAll, beforeAll, describe, expect, inject, it, vi } from "vitest";
import { createDb, type Db } from "@/server/db/client";
import { contentMedia, contentPostMedia, socialPosts } from "@/server/db/schema";
import { AppError } from "@/server/errors";
import { bulkPosts, contentMeta, createFolder, createTemplate, deleteFolder, deleteMedia, deleteTemplate, getMediaBytes, mediaNameFrom, renameFolder, renameMedia, setPostFlags, storeMedia, updateTemplate, useTemplate } from "@/server/content";
import { cancelPost, duplicatePost, getPost, listPosts, saveDraft } from "@/server/social/publishing";
import { runMigrations } from "../../scripts/db/migrate";
import { makeCustomer } from "./auth-helpers";

vi.mock("next/headers", async () => (await import("./auth-helpers")).jarMock());

/*
 * CM-01 content workspace against a UTF-8 scratch database: favorites, archive, folders, bulk actions,
 * templates, the media library, concurrent edits and — above all — that one customer can never see or
 * change another customer's content.
 */
const scratch = `socivanta_content_test_${Date.now()}`;
let db: Db;
let admin: Client;

beforeAll(async () => {
  admin = new Client({ connectionString: inject("adminUrl") });
  await admin.connect();
  await admin.query(`create database ${scratch} encoding 'UTF8' template template0`);
  const u = new URL(inject("adminUrl"));
  u.pathname = `/${scratch}`;
  await runMigrations(u.toString());
  db = createDb(u.toString());
}, 120_000);
afterAll(async () => {
  await db.$client.end();
  await admin.query(`drop database if exists ${scratch} with (force)`);
  await admin.end();
});

const codeOf = (p: Promise<unknown>) =>
  p.then(
    () => "resolved",
    (e) => (e instanceof AppError ? e.code : e instanceof ZodError ? "VALIDATION_FAILED" : `other:${String(e).slice(0, 200)}`),
  );

const draft = { text: "Launch day!", providers: ["instagram"], timezone: "UTC" } as const;

/** A tiny real PNG (1×1), different per `seed` so each has its own hash. */
function png(seed = 0): Buffer {
  const b = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
  // Change the IDAT payload's last pixel byte region is brittle; instead append an ancillary tEXt-like tail that parsers ignore.
  return Buffer.concat([b, Buffer.from([seed])]);
}

describe("posts: favorite, archive, folders, bulk", () => {
  it("keeps organisation on the post and out of the publishing lists when archived", async () => {
    const { customer } = await makeCustomer(db);
    const a = await saveDraft(db, customer.id, null, draft);
    const b = await saveDraft(db, customer.id, null, { ...draft, text: "Second" });
    await setPostFlags(db, customer.id, a.id, { favorite: true });
    await setPostFlags(db, customer.id, b.id, { archived: true });
    expect((await getPost(db, customer.id, a.id)).favorite).toBe(true);
    expect((await listPosts(db, customer.id)).map((p) => p.id)).toEqual([a.id]);
    expect((await listPosts(db, customer.id, "only")).map((p) => p.id)).toEqual([b.id]);
    expect((await listPosts(db, customer.id, "include")).length).toBe(2);
    await setPostFlags(db, customer.id, b.id, { archived: false });
    expect((await listPosts(db, customer.id)).length).toBe(2);
  });

  it("files posts in folders, rejects duplicate folder names and keeps posts when a folder is deleted", async () => {
    const { customer } = await makeCustomer(db);
    const f = await createFolder(db, customer.id, { name: "  Summer   Campaign " });
    expect(f.name).toBe("Summer Campaign");
    expect(await codeOf(createFolder(db, customer.id, { name: "summer campaign" }))).toBe("CONFLICT");
    expect(await codeOf(createFolder(db, customer.id, { name: "   " }))).toBe("VALIDATION_FAILED");
    expect(await codeOf(createFolder(db, customer.id, { name: "x".repeat(41) }))).toBe("VALIDATION_FAILED");
    const p = await saveDraft(db, customer.id, null, { ...draft, folderId: f.id });
    expect(p.folderId).toBe(f.id);
    expect((await contentMeta(db, customer.id)).folders).toEqual([{ id: f.id, name: "Summer Campaign", count: 1 }]);
    await renameFolder(db, customer.id, f.id, { name: "Autumn" });
    await deleteFolder(db, customer.id, f.id);
    const after = await getPost(db, customer.id, p.id);
    expect(after.folderId).toBeNull();
    expect(after.text).toBe("Launch day!");
  });

  it("applies a bulk action per post and reports the ones it had to skip", async () => {
    const { customer } = await makeCustomer(db);
    const f = await createFolder(db, customer.id, { name: "Batch" });
    const ids = [] as string[];
    for (let i = 0; i < 3; i++) ids.push((await saveDraft(db, customer.id, null, { ...draft, text: `Post ${i}` })).id);
    const moved = await bulkPosts(db, customer.id, { action: "move", ids, folderId: f.id });
    expect(moved).toEqual({ done: 3, skipped: [] });
    const gone = await bulkPosts(db, customer.id, { action: "delete", ids: [...ids, "00000000-0000-4000-8000-000000000000"] });
    expect(gone.done).toBe(3);
    expect(gone.skipped).toHaveLength(1);
    expect(await codeOf(bulkPosts(db, customer.id, { action: "delete", ids: [] }))).toBe("VALIDATION_FAILED");
    expect(await codeOf(bulkPosts(db, customer.id, { action: "explode", ids }))).toBe("VALIDATION_FAILED");
  });

  it("refuses to archive or re-plan a scheduled post and to schedule an archived one", async () => {
    const { customer } = await makeCustomer(db);
    const p = await saveDraft(db, customer.id, null, draft);
    // A scheduled post is created directly: scheduling needs a connected account, which is not what is under test.
    await db.update(socialPosts).set({ status: "scheduled", scheduledAt: new Date(Date.now() + 3_600_000), approvedAt: new Date() }).where(eq(socialPosts.id, p.id));
    expect(await codeOf(setPostFlags(db, customer.id, p.id, { archived: true }))).toBe("CONFLICT");
    expect(await codeOf(setPostFlags(db, customer.id, p.id, { plannedLocal: "2031-01-01T10:00", timezone: "UTC" }))).toBe("CONFLICT");
    await setPostFlags(db, customer.id, p.id, { favorite: true }); // favoriting is harmless
    await cancelPost(db, customer.id, p.id);
    await setPostFlags(db, customer.id, p.id, { archived: true });
    expect((await listPosts(db, customer.id)).length).toBe(0);
  });

  it("links a draft to the calendar with a planned date, and clears it", async () => {
    const { customer } = await makeCustomer(db);
    const p = await saveDraft(db, customer.id, null, draft);
    await setPostFlags(db, customer.id, p.id, { plannedLocal: "2031-03-04T09:30", timezone: "America/New_York" });
    const planned = await getPost(db, customer.id, p.id);
    expect(planned.state).toBe("planned");
    expect(planned.plannedAt).toBe("2031-03-04T14:30:00.000Z");
    expect(planned.version).toBe(p.version); // organising isn't a content edit
    await setPostFlags(db, customer.id, p.id, { plannedLocal: null });
    expect((await getPost(db, customer.id, p.id)).plannedAt).toBeNull();
  });
});

describe("editing: hashtags, notes, versions", () => {
  it("stores hashtags and notes, keeps them when a later save leaves them out, and copies them on duplicate", async () => {
    const { customer } = await makeCustomer(db);
    const p = await saveDraft(db, customer.id, null, { ...draft, hashtags: ["Launch", "launch", "summer_2026"], notes: "Ask legal about the claim." });
    expect(p.hashtags).toEqual(["Launch", "summer_2026"]);
    const later = await saveDraft(db, customer.id, p.id, { ...draft, text: "Edited" });
    expect(later.hashtags).toEqual(["Launch", "summer_2026"]);
    expect(later.notes).toBe("Ask legal about the claim.");
    const copy = await duplicatePost(db, customer.id, p.id);
    expect(copy.hashtags).toEqual(["Launch", "summer_2026"]);
    expect(copy.notes).toBe("Ask legal about the claim.");
    expect(await codeOf(saveDraft(db, customer.id, p.id, { ...draft, hashtags: ["bad tag"] }))).toBe("VALIDATION_FAILED");
    expect(await codeOf(saveDraft(db, customer.id, p.id, { ...draft, hashtags: Array.from({ length: 31 }, (_, i) => `t${i}`) }))).toBe("VALIDATION_FAILED");
    expect(await codeOf(saveDraft(db, customer.id, p.id, { ...draft, notes: "n".repeat(2001) }))).toBe("VALIDATION_FAILED");
  });

  it("rejects a save made from a stale version instead of overwriting newer work", async () => {
    const { customer } = await makeCustomer(db);
    const p = await saveDraft(db, customer.id, null, draft);
    const second = await saveDraft(db, customer.id, p.id, { ...draft, text: "Tab two", expectedVersion: p.version });
    expect(second.version).toBe(p.version + 1);
    expect(await codeOf(saveDraft(db, customer.id, p.id, { ...draft, text: "Tab one (stale)", expectedVersion: p.version }))).toBe("CONFLICT");
    expect((await getPost(db, customer.id, p.id)).text).toBe("Tab two");
    // Two saves racing from the same version: exactly one wins.
    const base = second.version;
    const results = await Promise.all([saveDraft(db, customer.id, p.id, { ...draft, text: "A", expectedVersion: base }), saveDraft(db, customer.id, p.id, { ...draft, text: "B", expectedVersion: base })].map(codeOf));
    expect(results.sort()).toEqual(["CONFLICT", "resolved"]);
  });
});

describe("templates", () => {
  it("creates, updates, copies into a draft (independent of the template) and deletes", async () => {
    const { customer } = await makeCustomer(db);
    const t = await createTemplate(db, customer.id, { name: "Product drop", text: "New arrival ✨", hashtags: ["new", "drop"], providers: ["instagram", "facebook", "instagram"] });
    expect(t.providers).toEqual(["instagram", "facebook"]);
    const edited = await updateTemplate(db, customer.id, t.id, { name: "Product drop v2", text: "New arrival ✨ now", hashtags: ["new"], providers: ["instagram"] });
    expect(edited.name).toBe("Product drop v2");
    const post = await useTemplate(db, customer.id, t.id, { timezone: "UTC" });
    expect(post.status).toBe("draft");
    expect(post.text).toBe("New arrival ✨ now");
    expect(post.hashtags).toEqual(["new"]);
    await deleteTemplate(db, customer.id, t.id);
    expect((await getPost(db, customer.id, post.id)).text).toBe("New arrival ✨ now"); // the draft is unaffected
    expect(await codeOf(useTemplate(db, customer.id, t.id, { timezone: "UTC" }))).toBe("NOT_FOUND");
  });

  it("saves a draft as a personal template", async () => {
    const { customer } = await makeCustomer(db);
    const p = await saveDraft(db, customer.id, null, { ...draft, title: "Weekly tip", hashtags: ["tips"] });
    const t = await createTemplate(db, customer.id, { fromPostId: p.id });
    expect(t).toMatchObject({ name: "Weekly tip", body: "Launch day!", hashtags: ["tips"], providers: ["instagram"] });
    expect(await codeOf(createTemplate(db, customer.id, { name: "", text: "x" }))).toBe("VALIDATION_FAILED");
    expect(await codeOf(createTemplate(db, customer.id, { name: "ok", text: "x".repeat(5001) }))).toBe("VALIDATION_FAILED");
  });
});

describe("media library", () => {
  it("stores valid images once per customer, renames them and serves bytes only to the owner", async () => {
    const { customer: a } = await makeCustomer(db);
    const { customer: b } = await makeCustomer(db);
    const one = await storeMedia(db, a.id, png(1), "Summer Sale (final).PNG");
    expect(one).toMatchObject({ name: "Summer Sale (final)", mime: "image/png", width: 1, height: 1 });
    const again = await storeMedia(db, a.id, png(1), "other-name.png");
    expect(again.id).toBe(one.id);
    expect((await contentMeta(db, a.id)).media).toHaveLength(1);
    // Another customer can upload the identical file and gets their own copy.
    const theirs = await storeMedia(db, b.id, png(1), "mine.png");
    expect(theirs.id).not.toBe(one.id);
    await renameMedia(db, a.id, one.id, { name: "  Hero   banner " });
    expect((await contentMeta(db, a.id)).media[0]!.name).toBe("Hero banner");
    expect(await getMediaBytes(db, a.id, one.id)).not.toBeNull();
    expect(await getMediaBytes(db, b.id, one.id)).toBeNull();
    expect(await getMediaBytes(db, a.id, "not-a-uuid")).toBeNull();
    expect(await codeOf(renameMedia(db, b.id, one.id, { name: "stolen" }))).toBe("NOT_FOUND");
    expect(await codeOf(deleteMedia(db, b.id, one.id))).toBe("NOT_FOUND");
  });

  it("rejects anything that is not a real JPEG, PNG or WebP, whatever it is called", async () => {
    const { customer } = await makeCustomer(db);
    expect(await codeOf(storeMedia(db, customer.id, Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), "logo.png"))).toBe("VALIDATION_FAILED");
    expect(await codeOf(storeMedia(db, customer.id, Buffer.from("GIF89a....."), "x.png"))).toBe("VALIDATION_FAILED");
    expect(await codeOf(storeMedia(db, customer.id, Buffer.alloc(0), "empty.png"))).toBe("VALIDATION_FAILED");
    expect(await codeOf(storeMedia(db, customer.id, Buffer.alloc(5 * 1024 * 1024 + 1, 1), "big.jpg"))).toBe("VALIDATION_FAILED");
    expect(mediaNameFrom("../../etc/passwd.png")).toBe("passwd");
    expect(mediaNameFrom("   .png")).toBe("Image");
  });

  it("attaches only the customer's own images, rebuilds the summary on rename and delete, and blocks deleting what a scheduled post uses", async () => {
    const { customer: a } = await makeCustomer(db);
    const { customer: b } = await makeCustomer(db);
    const mine = await storeMedia(db, a.id, png(10), "mine.png");
    const theirs = await storeMedia(db, b.id, png(11), "theirs.png");
    expect(await codeOf(saveDraft(db, a.id, null, { ...draft, mediaIds: [theirs.id] }))).toBe("VALIDATION_FAILED");
    const p = await saveDraft(db, a.id, null, { ...draft, mediaIds: [mine.id] });
    expect(p.mediaIds).toEqual([mine.id]);
    expect(p.media).toEqual([{ kind: "image", name: "mine", bytes: expect.any(Number), type: "image/png" }]);
    await renameMedia(db, a.id, mine.id, { name: "Renamed" });
    expect((await getPost(db, a.id, p.id)).media[0]!.name).toBe("Renamed");
    // Reusable across drafts, and counted.
    const q = await saveDraft(db, a.id, null, { ...draft, text: "Another", mediaIds: [mine.id] });
    expect((await contentMeta(db, a.id)).media[0]!.usedBy).toBe(2);
    // Duplicating a post carries its images.
    expect((await duplicatePost(db, a.id, q.id)).mediaIds).toEqual([mine.id]);
    // A scheduled post pins its images.
    await db.update(socialPosts).set({ status: "scheduled", scheduledAt: new Date(Date.now() + 3_600_000), approvedAt: new Date() }).where(eq(socialPosts.id, p.id));
    expect(await codeOf(deleteMedia(db, a.id, mine.id))).toBe("CONFLICT");
    await cancelPost(db, a.id, p.id);
    await deleteMedia(db, a.id, mine.id);
    expect((await getPost(db, a.id, p.id)).media).toEqual([]);
    expect((await getPost(db, a.id, p.id)).mediaIds).toEqual([]);
    expect(await db.select().from(contentPostMedia).where(eq(contentPostMedia.mediaId, mine.id))).toEqual([]);
  });

  it("enforces the library's file-count limit", async () => {
    const { customer } = await makeCustomer(db);
    await db.insert(contentMedia).values(Array.from({ length: 100 }, (_, i) => ({ customerId: customer.id, name: `f${i}`, mime: "image/png", bytes: Buffer.from([1]), sizeBytes: 1, width: 1, height: 1, sha256: i.toString(16).padStart(64, "0") })));
    expect(await codeOf(storeMedia(db, customer.id, png(200), "one-too-many.png"))).toBe("CONFLICT");
  });
});

describe("customer isolation", () => {
  it("never lets one customer read or change another's posts, folders, templates or media", async () => {
    const { customer: a } = await makeCustomer(db);
    const { customer: b } = await makeCustomer(db);
    const post = await saveDraft(db, a.id, null, draft);
    const folder = await createFolder(db, a.id, { name: "Private" });
    const template = await createTemplate(db, a.id, { name: "Private t", text: "secret" });
    const image = await storeMedia(db, a.id, png(50), "private.png");

    expect(await codeOf(setPostFlags(db, b.id, post.id, { favorite: true }))).toBe("NOT_FOUND");
    expect(await codeOf(setPostFlags(db, b.id, post.id, { archived: true }))).toBe("NOT_FOUND");
    expect(await codeOf(saveDraft(db, b.id, post.id, draft))).toBe("NOT_FOUND");
    expect(await codeOf(duplicatePost(db, b.id, post.id))).toBe("NOT_FOUND");
    expect(await codeOf(createTemplate(db, b.id, { fromPostId: post.id }))).toBe("NOT_FOUND");
    expect((await bulkPosts(db, b.id, { action: "delete", ids: [post.id] })).skipped).toHaveLength(1);
    expect(await codeOf(renameFolder(db, b.id, folder.id, { name: "Mine now" }))).toBe("NOT_FOUND");
    expect(await codeOf(deleteFolder(db, b.id, folder.id))).toBe("NOT_FOUND");
    expect(await codeOf(updateTemplate(db, b.id, template.id, { name: "x", text: "y" }))).toBe("NOT_FOUND");
    expect(await codeOf(useTemplate(db, b.id, template.id, { timezone: "UTC" }))).toBe("NOT_FOUND");
    expect(await codeOf(deleteTemplate(db, b.id, template.id))).toBe("NOT_FOUND");
    expect(await codeOf(saveDraft(db, b.id, null, { ...draft, folderId: folder.id }))).toBe("VALIDATION_FAILED");
    expect(await codeOf(setPostFlags(db, b.id, (await saveDraft(db, b.id, null, draft)).id, { folderId: folder.id }))).toBe("VALIDATION_FAILED");
    expect(await codeOf(saveDraft(db, b.id, null, { ...draft, mediaIds: [image.id] }))).toBe("VALIDATION_FAILED");

    const meta = await contentMeta(db, b.id);
    expect(meta.folders).toEqual([]);
    expect(meta.templates).toEqual([]);
    expect(meta.media).toEqual([]);
    // …and nothing of A's changed.
    expect((await getPost(db, a.id, post.id)).favorite).toBe(false);
    expect((await contentMeta(db, a.id)).folders[0]!.name).toBe("Private");
    expect(await db.select().from(socialPosts).where(and(eq(socialPosts.id, post.id), eq(socialPosts.customerId, a.id)))).toHaveLength(1);
  });
});
