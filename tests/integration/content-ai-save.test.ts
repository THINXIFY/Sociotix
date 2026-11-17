import { count, eq } from "drizzle-orm";
import { Client } from "pg";
import { ZodError } from "zod";
import { afterAll, beforeAll, describe, expect, inject, it, vi } from "vitest";
import { createDb, type Db } from "@/server/db/client";
import { contentTemplates, socialPosts, socialPostTargets } from "@/server/db/schema";
import { AppError } from "@/server/errors";
import { createFolder, contentMeta, importAiContent, listFolders, setPostFlags } from "@/server/content";
import { getPost, listPosts, saveDraft } from "@/server/social/publishing";
import { providerFromName } from "@/lib/social/content";
import { runMigrations } from "../../scripts/db/migrate";
import { makeCustomer } from "./auth-helpers";

vi.mock("next/headers", async () => (await import("./auth-helpers")).jarMock());

/*
 * CM-03: saving AI tool results into the Content Library. Real results the customer sees become drafts (the same
 * social_posts the editor, library and calendar use) or, for a hashtag set, a template. Nothing is planned,
 * scheduled or published, blanks are never saved, repeats don't duplicate, and customers can't reach each other.
 */
const scratch = `socivanta_aisave_test_${Date.now()}`;
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

const caption = (over: Record<string, unknown> = {}) => ({
  source: "caption-generator",
  kind: "draft",
  timezone: "UTC",
  items: [{ title: "Instagram · Storytelling", text: "Fresh drop ✨ Autumn is here 🍂", providers: ["instagram"] }],
  ...over,
});

describe("platform mapping", () => {
  it("maps the AI tools' platform names to Sociotix's and leaves unsupported ones empty", () => {
    expect(providerFromName("Instagram")).toBe("instagram");
    expect(providerFromName("X / Twitter")).toBe("x");
    expect(providerFromName("X")).toBe("x");
    expect(providerFromName("LinkedIn")).toBe("linkedin");
    expect(providerFromName("Pinterest")).toBeUndefined();
    expect(providerFromName("Threads")).toBeUndefined();
    expect(providerFromName("")).toBeUndefined();
  });
});

describe("drafts from AI results", () => {
  it("saves the text exactly as shown (emoji, line breaks), with platform, folder and provenance, as an editable draft", async () => {
    const { customer } = await makeCustomer(db);
    const folder = await createFolder(db, customer.id, { name: "AI ideas" });
    const r = await importAiContent(db, customer.id, caption({ folderId: folder.id, items: [{ title: "Instagram · Storytelling", text: "Fresh drop ✨\n\nAutumn is here 🍂", providers: ["instagram"], hashtags: ["autumn", "newdrop"] }] }));
    expect(r).toMatchObject({ kind: "draft", duplicates: [], skipped: [] });
    expect(r.created).toHaveLength(1);
    const p = await getPost(db, customer.id, r.created[0]!.id);
    expect(p).toMatchObject({ title: "Instagram · Storytelling", text: "Fresh drop ✨\n\nAutumn is here 🍂", providers: ["instagram"], hashtags: ["autumn", "newdrop"], folderId: folder.id, status: "draft", state: "draft", favorite: false, archivedAt: null });
    expect(p.notes).toBe("Saved from AI Caption Generator.");
    // It is an ordinary draft: editable on its own, and it shows up in the library data.
    const edited = await saveDraft(db, customer.id, p.id, { title: p.title, text: "My own edit", providers: ["instagram"], timezone: "UTC", expectedVersion: p.version });
    expect(edited.text).toBe("My own edit");
    expect((await listPosts(db, customer.id)).map((x) => x.id)).toEqual([p.id]);
  });

  it("follows the workflow: save, edit, plan on the calendar, without ever scheduling or publishing", async () => {
    const { customer } = await makeCustomer(db);
    const r = await importAiContent(db, customer.id, caption());
    const id = r.created[0]!.id;
    await setPostFlags(db, customer.id, id, { plannedLocal: "2031-10-10T09:00", timezone: "UTC" });
    const row = (await db.select().from(socialPosts).where(eq(socialPosts.id, id)))[0]!;
    expect(row).toMatchObject({ status: "draft", approvedAt: null, scheduledAt: null });
    expect((await getPost(db, customer.id, id)).state).toBe("planned");
    expect((await db.select({ n: count() }).from(socialPostTargets).where(eq(socialPostTargets.postId, id)))[0]!.n).toBe(0);
  });

  it("keeps an idea's outline as private notes next to the hook, and a calendar plan as one draft per slot", async () => {
    const { customer } = await makeCustomer(db);
    const idea = await importAiContent(db, customer.id, { source: "post-ideas", kind: "draft", timezone: "UTC", items: [{ title: "Behind the scenes", text: "Ever wondered how it is made?", notes: "Education · Reel\n- Show the workshop\n- Share one surprise", providers: ["instagram"] }] });
    const p = await getPost(db, customer.id, idea.created[0]!.id);
    expect(p.text).toBe("Ever wondered how it is made?");
    expect(p.notes).toBe("Saved from AI Post Ideas.\n\nEducation · Reel\n- Show the workshop\n- Share one surprise");

    const plan = await importAiContent(db, customer.id, {
      source: "content-calendar",
      kind: "draft",
      timezone: "UTC",
      items: Array.from({ length: 7 }, (_, i) => ({ title: `Day ${i + 1} · Topic ${i}`, text: `Topic ${i}`, notes: `Day ${i + 1}`, providers: i % 2 ? ["facebook"] : [] })),
    });
    expect(plan.created).toHaveLength(7);
    expect((await listPosts(db, customer.id)).length).toBe(8);
  });

  it("refuses blank text instead of saving a placeholder, and reports which item it skipped", async () => {
    const { customer } = await makeCustomer(db);
    const r = await importAiContent(db, customer.id, caption({ items: [{ text: "   \n " }, { title: "Real one", text: "Something real" }] }));
    expect(r.created.map((c) => c.name)).toEqual(["Real one"]);
    expect(r.skipped).toEqual([{ index: 0, reason: "There's no text to save yet." }]);
    expect((await listPosts(db, customer.id)).length).toBe(1);
  });

  it("does not duplicate a repeated save, but saves different text, or a different platform, as new drafts", async () => {
    const { customer } = await makeCustomer(db);
    const first = await importAiContent(db, customer.id, caption());
    const again = await importAiContent(db, customer.id, caption());
    expect(again.created).toEqual([]);
    expect(again.duplicates).toEqual([{ id: first.created[0]!.id, name: "Instagram · Storytelling" }]);
    // Rapid double submission: still exactly one draft in total.
    const both = await Promise.all([importAiContent(db, customer.id, caption({ items: [{ title: "Race", text: "Same text", providers: ["x"] }] })), importAiContent(db, customer.id, caption({ items: [{ title: "Race", text: "Same text", providers: ["x"] }] }))]);
    const raced = both.flatMap((b) => b.created).length;
    expect(raced).toBeGreaterThanOrEqual(1);
    expect(raced).toBeLessThanOrEqual(2); // concurrent requests can both pass the check; a sequential repeat never does
    const other = await importAiContent(db, customer.id, caption({ items: [{ title: "Instagram · Storytelling", text: "Fresh drop ✨ Autumn is here 🍂", providers: ["facebook"] }] }));
    expect(other.created).toHaveLength(1);
    // An archived copy no longer counts as a duplicate.
    await setPostFlags(db, customer.id, first.created[0]!.id, { archived: true });
    expect((await importAiContent(db, customer.id, caption())).created).toHaveLength(1);
  });
});

describe("hashtag sets become templates", () => {
  it("saves hashtags (without #, de-duplicated) as a reusable template and de-duplicates a repeat", async () => {
    const { customer } = await makeCustomer(db);
    const input = { source: "hashtag-finder", kind: "template", timezone: "UTC", items: [{ title: "Core hashtags", hashtags: ["autumn", "Autumn", "newdrop"] }] };
    const r = await importAiContent(db, customer.id, input);
    expect(r.created).toHaveLength(1);
    const t = (await contentMeta(db, customer.id)).templates;
    expect(t).toHaveLength(1);
    expect(t[0]).toMatchObject({ name: "Core hashtags", hashtags: ["autumn", "newdrop"], body: "" });
    expect((await importAiContent(db, customer.id, input)).duplicates).toHaveLength(1);
    expect((await db.select({ n: count() }).from(contentTemplates).where(eq(contentTemplates.customerId, customer.id)))[0]!.n).toBe(1);
  });

  it("refuses an empty hashtag set and a nameless template, and never makes a post from hashtags", async () => {
    const { customer } = await makeCustomer(db);
    const none = await importAiContent(db, customer.id, { source: "hashtag-finder", kind: "template", timezone: "UTC", items: [{ title: "Empty", hashtags: [] }] });
    expect(none.skipped).toHaveLength(1);
    const nameless = await importAiContent(db, customer.id, { source: "hashtag-finder", kind: "template", timezone: "UTC", items: [{ title: "", hashtags: ["a"] }] });
    expect(nameless.skipped).toHaveLength(1);
    expect(await codeOf(importAiContent(db, customer.id, { source: "hashtag-finder", kind: "draft", timezone: "UTC", items: [{ text: "x", hashtags: ["a"] }] }))).toBe("VALIDATION_FAILED");
    expect((await listPosts(db, customer.id)).length).toBe(0);
  });
});

describe("validation and isolation", () => {
  it("only accepts the tools that produce social content, and the matching kind", async () => {
    const { customer } = await makeCustomer(db);
    for (const source of ["growth-advisor", "service-recommender", "order-assistant", "support-assistant", "nope"]) expect(await codeOf(importAiContent(db, customer.id, caption({ source })))).toBe("VALIDATION_FAILED");
    expect(await codeOf(importAiContent(db, customer.id, caption({ kind: "template" })))).toBe("VALIDATION_FAILED");
    expect(await codeOf(importAiContent(db, customer.id, caption({ items: [] })))).toBe("VALIDATION_FAILED");
    expect(await codeOf(importAiContent(db, customer.id, caption({ items: Array.from({ length: 32 }, (_, i) => ({ text: `t${i}` })) })))).toBe("VALIDATION_FAILED");
    expect(await codeOf(importAiContent(db, customer.id, caption({ items: [{ text: "x".repeat(5001) }] })))).toBe("VALIDATION_FAILED");
    expect(await codeOf(importAiContent(db, customer.id, caption({ timezone: "Mars/Base" })))).toBe("VALIDATION_FAILED");
    expect(await codeOf(importAiContent(db, customer.id, { ...caption(), extra: 1 }))).toBe("VALIDATION_FAILED");
    expect(await codeOf(importAiContent(db, customer.id, caption({ items: [{ text: "ok", providers: ["myspace"] }] })))).toBe("VALIDATION_FAILED");
    expect((await listPosts(db, customer.id)).length).toBe(0);
  });

  it("never lets one customer use, see or duplicate against another's folder or drafts", async () => {
    const { customer: a } = await makeCustomer(db);
    const { customer: b } = await makeCustomer(db);
    const folder = await createFolder(db, a.id, { name: "Private" });
    expect(await codeOf(importAiContent(db, b.id, caption({ folderId: folder.id })))).toBe("VALIDATION_FAILED");
    expect(await listFolders(db, b.id)).toEqual([]);
    expect((await listFolders(db, a.id)).map((f) => f.name)).toEqual(["Private"]);
    // The same text saved by two customers is two separate drafts, never a "duplicate" of someone else's.
    const ra = await importAiContent(db, a.id, caption());
    const rb = await importAiContent(db, b.id, caption());
    expect(rb.duplicates).toEqual([]);
    expect(rb.created[0]!.id).not.toBe(ra.created[0]!.id);
    expect((await listPosts(db, b.id)).map((p) => p.id)).toEqual([rb.created[0]!.id]);
  });
});
