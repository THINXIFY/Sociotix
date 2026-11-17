import { count, eq } from "drizzle-orm";
import { Client } from "pg";
import { ZodError } from "zod";
import { afterAll, beforeAll, describe, expect, inject, it, vi } from "vitest";
import { createDb, type Db } from "@/server/db/client";
import { socialPosts, socialPostTargets } from "@/server/db/schema";
import { AppError } from "@/server/errors";
import { bulkPosts, setPostFlags, setPostMedia, storeMedia } from "@/server/content";
import { getPost, listPosts, saveDraft } from "@/server/social/publishing";
import { runMigrations } from "../../scripts/db/migrate";
import { makeCustomer } from "./auth-helpers";

vi.mock("next/headers", async () => (await import("./auth-helpers")).jarMock());

/*
 * CM-02 calendar planning against a UTF-8 scratch database: planning the existing post (never a copy), keeping
 * archived content out, changing a planned draft's images with ownership, order and version protection, and
 * the guarantee that planning can never schedule or publish anything.
 */
const scratch = `socivanta_planning_test_${Date.now()}`;
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

const draft = { text: "Plan me", providers: ["instagram"], timezone: "UTC" } as const;
const png = (seed: number) => Buffer.concat([Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64"), Buffer.from([seed])]);

describe("planning a saved draft", () => {
  it("plans, re-plans and clears the same post without copying it, changing its content or bumping its version", async () => {
    const { customer } = await makeCustomer(db);
    const p = await saveDraft(db, customer.id, null, { ...draft, hashtags: ["plan"], notes: "keep" });
    const before = (await db.select({ n: count() }).from(socialPosts).where(eq(socialPosts.customerId, customer.id)))[0]!.n;

    await setPostFlags(db, customer.id, p.id, { plannedLocal: "2031-06-01T09:00", timezone: "Europe/London" });
    let now = await getPost(db, customer.id, p.id);
    expect(now.state).toBe("planned");
    expect(now.plannedAt).toBe("2031-06-01T08:00:00.000Z"); // 09:00 BST
    expect(now.timezone).toBe("Europe/London");

    // Rescheduling the same post (twice in a row, as a double click would) leaves exactly one post.
    await Promise.all([setPostFlags(db, customer.id, p.id, { plannedLocal: "2031-06-02T10:00", timezone: "Europe/London" }), setPostFlags(db, customer.id, p.id, { plannedLocal: "2031-06-02T10:00", timezone: "Europe/London" })]);
    now = await getPost(db, customer.id, p.id);
    expect(now.plannedAt).toBe("2031-06-02T09:00:00.000Z");
    expect((await db.select({ n: count() }).from(socialPosts).where(eq(socialPosts.customerId, customer.id)))[0]!.n).toBe(before);

    // Content is untouched and the version (used to catch conflicting edits) did not move.
    expect(now).toMatchObject({ text: "Plan me", hashtags: ["plan"], notes: "keep", version: p.version, status: "draft" });

    await setPostFlags(db, customer.id, p.id, { plannedLocal: null });
    now = await getPost(db, customer.id, p.id);
    expect(now.plannedAt).toBeNull();
    expect(now.state).toBe("draft");
  });

  it("never creates a publishing target or an approval, whatever is planned", async () => {
    const { customer } = await makeCustomer(db);
    const p = await saveDraft(db, customer.id, null, draft);
    await setPostFlags(db, customer.id, p.id, { plannedLocal: "2031-01-01T10:00", timezone: "UTC" });
    const row = (await db.select().from(socialPosts).where(eq(socialPosts.id, p.id)))[0]!;
    expect(row.status).toBe("draft");
    expect(row.approvedAt).toBeNull();
    expect(row.scheduledAt).toBeNull();
    expect((await db.select({ n: count() }).from(socialPostTargets).where(eq(socialPostTargets.postId, p.id)))[0]!.n).toBe(0);
  });

  it("keeps archived content out of planning and out of the calendar's data", async () => {
    const { customer } = await makeCustomer(db);
    const p = await saveDraft(db, customer.id, null, draft);
    await setPostFlags(db, customer.id, p.id, { plannedLocal: "2031-03-03T09:00", timezone: "UTC" });
    await setPostFlags(db, customer.id, p.id, { archived: true });
    expect((await listPosts(db, customer.id)).map((x) => x.id)).not.toContain(p.id); // what the calendar loads
    // An archived post can't be planned or re-planned…
    expect(await codeOf(setPostFlags(db, customer.id, p.id, { plannedLocal: "2031-04-04T09:00", timezone: "UTC" }))).toBe("CONFLICT");
    expect(await codeOf(bulkPosts(db, customer.id, { action: "move", ids: [p.id], folderId: null }).then((r) => (r.done === 1 ? "resolved" : "skipped")))).toBe("resolved");
    // …but its date can still be cleared, and restoring brings it back with its date.
    await setPostFlags(db, customer.id, p.id, { archived: false });
    expect((await getPost(db, customer.id, p.id)).plannedAt).toBe("2031-03-03T09:00:00.000Z");
    await setPostFlags(db, customer.id, p.id, { archived: true });
    await setPostFlags(db, customer.id, p.id, { plannedLocal: null });
    expect((await getPost(db, customer.id, p.id)).plannedAt).toBeNull();
    // Restoring and planning together is allowed.
    await setPostFlags(db, customer.id, p.id, { archived: false, plannedLocal: "2031-05-05T09:00", timezone: "UTC" });
    expect((await getPost(db, customer.id, p.id)).state).toBe("planned");
  });

  it("rejects bad dates and times that do not exist", async () => {
    const { customer } = await makeCustomer(db);
    const p = await saveDraft(db, customer.id, null, draft);
    expect(await codeOf(setPostFlags(db, customer.id, p.id, { plannedLocal: "not a date", timezone: "UTC" }))).toBe("VALIDATION_FAILED");
    expect(await codeOf(setPostFlags(db, customer.id, p.id, { plannedLocal: "2031-01-01T10:00" }))).toBe("VALIDATION_FAILED"); // needs a zone
    expect(await codeOf(setPostFlags(db, customer.id, p.id, { plannedLocal: "2031-03-30T01:30", timezone: "Europe/London" }))).toBe("VALIDATION_FAILED"); // skipped by DST
  });

  it("does not let another customer plan, re-plan or clear someone else's post", async () => {
    const { customer: a } = await makeCustomer(db);
    const { customer: b } = await makeCustomer(db);
    const p = await saveDraft(db, a.id, null, draft);
    await setPostFlags(db, a.id, p.id, { plannedLocal: "2031-07-07T09:00", timezone: "UTC" });
    expect(await codeOf(setPostFlags(db, b.id, p.id, { plannedLocal: "2031-08-08T09:00", timezone: "UTC" }))).toBe("NOT_FOUND");
    expect(await codeOf(setPostFlags(db, b.id, p.id, { plannedLocal: null }))).toBe("NOT_FOUND");
    expect((await getPost(db, a.id, p.id)).plannedAt).toBe("2031-07-07T09:00:00.000Z");
  });
});

describe("images on a planned draft", () => {
  it("replaces the images in the order given, bumps the version and leaves the date and text alone", async () => {
    const { customer } = await makeCustomer(db);
    const one = await storeMedia(db, customer.id, png(1), "one.png");
    const two = await storeMedia(db, customer.id, png(2), "two.png");
    const three = await storeMedia(db, customer.id, png(3), "three.png");
    const p = await saveDraft(db, customer.id, null, { ...draft, mediaIds: [one.id, two.id] });
    await setPostFlags(db, customer.id, p.id, { plannedLocal: "2031-09-09T09:00", timezone: "UTC" });
    const planned = await getPost(db, customer.id, p.id);

    const r = await setPostMedia(db, customer.id, p.id, { mediaIds: [three.id, one.id, two.id], expectedVersion: planned.version });
    expect(r.version).toBe(planned.version + 1);
    const after = await getPost(db, customer.id, p.id);
    expect(after.mediaIds).toEqual([three.id, one.id, two.id]); // order preserved
    expect(after.media.map((m) => m.name)).toEqual(["three", "one", "two"]);
    expect(after).toMatchObject({ text: "Plan me", plannedAt: planned.plannedAt, state: "planned" });

    expect((await setPostMedia(db, customer.id, p.id, { mediaIds: [], expectedVersion: after.version })).mediaIds).toEqual([]);
    expect((await getPost(db, customer.id, p.id)).media).toEqual([]);
  });

  it("refuses a stale version, more than ten images, other people's images and scheduled posts", async () => {
    const { customer: a } = await makeCustomer(db);
    const { customer: b } = await makeCustomer(db);
    const mine = await storeMedia(db, a.id, png(20), "mine.png");
    const theirs = await storeMedia(db, b.id, png(21), "theirs.png");
    const p = await saveDraft(db, a.id, null, draft);

    expect(await codeOf(setPostMedia(db, a.id, p.id, { mediaIds: [mine.id], expectedVersion: p.version + 5 }))).toBe("CONFLICT");
    expect(await codeOf(setPostMedia(db, a.id, p.id, { mediaIds: [theirs.id], expectedVersion: p.version }))).toBe("VALIDATION_FAILED");
    expect(await codeOf(setPostMedia(db, b.id, p.id, { mediaIds: [theirs.id], expectedVersion: p.version }))).toBe("NOT_FOUND");
    expect(await codeOf(setPostMedia(db, a.id, p.id, { mediaIds: Array.from({ length: 11 }, () => mine.id), expectedVersion: p.version }))).toBe("VALIDATION_FAILED");
    expect(await codeOf(setPostMedia(db, a.id, p.id, { mediaIds: [mine.id] }))).toBe("VALIDATION_FAILED"); // version is required
    expect((await getPost(db, a.id, p.id)).mediaIds).toEqual([]); // nothing changed by any of the above

    // Two edits racing from the same version: exactly one wins.
    const results = await Promise.all([setPostMedia(db, a.id, p.id, { mediaIds: [mine.id], expectedVersion: p.version }), setPostMedia(db, a.id, p.id, { mediaIds: [], expectedVersion: p.version })].map(codeOf));
    expect(results.sort()).toEqual(["CONFLICT", "resolved"]);

    await db.update(socialPosts).set({ status: "scheduled", scheduledAt: new Date(Date.now() + 3_600_000), approvedAt: new Date() }).where(eq(socialPosts.id, p.id));
    const cur = await getPost(db, a.id, p.id);
    expect(await codeOf(setPostMedia(db, a.id, p.id, { mediaIds: [], expectedVersion: cur.version }))).toBe("CONFLICT");
  });
});
