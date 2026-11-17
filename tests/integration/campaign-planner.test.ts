import { eq } from "drizzle-orm";
import { Client } from "pg";
import { ZodError } from "zod";
import { afterAll, beforeAll, describe, expect, inject, it, vi } from "vitest";
import { createDb, type Db } from "@/server/db/client";
import { campaignTasks, socialPosts } from "@/server/db/schema";
import { AppError } from "@/server/errors";
import { createBrand, deleteBrand } from "@/server/brand";
import {
  addMilestone,
  addTask,
  createCampaign,
  deleteCampaign,
  deleteMilestone,
  deleteTask,
  deleteTemplate,
  duplicateCampaign,
  exportCampaign,
  getCampaign,
  linkPosts,
  listCampaigns,
  listTemplates,
  reorderTasks,
  saveAsTemplate,
  summaryOf,
  unlinkPost,
  updateCampaign,
  updateMilestone,
  updateTask,
  updateTemplate,
} from "@/server/campaign";
import { bulkPosts, contentMeta, setPostFlags } from "@/server/content";
import { getPost, saveDraft } from "@/server/social/publishing";
import { runMigrations } from "../../scripts/db/migrate";
import { makeCustomer } from "./auth-helpers";

vi.mock("next/headers", async () => (await import("./auth-helpers")).jarMock());

/*
 * CP-01: Campaign Planner. Campaigns, milestones, tasks and templates belong to one customer; content is linked
 * (never copied), unlinking or deleting never deletes a draft, linked content stays on the campaign's brand, and
 * progress is counted only from real tasks.
 */
const scratch = `socivanta_campaign_test_${Date.now()}`;
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
const draft = (text = "A campaign draft") => ({ text, timezone: "UTC" });

describe("campaigns", () => {
  it("creates, normalises and validates a campaign", async () => {
    const { customer } = await makeCustomer(db);
    const brand = await createBrand(db, customer.id, { name: "Bean" });
    const c = await createCampaign(db, customer.id, {
      name: "  Spring   launch ",
      description: "Launch week.\r\nThree drops.",
      brandId: brand.id,
      objective: "launch",
      platforms: ["instagram", "tiktok", "instagram"],
      status: "planned",
      startDate: "2030-03-01",
      endDate: "2030-03-31",
      budgetCents: 150050,
      budgetCurrency: "EUR",
      notes: "Approvals by Friday.",
    });
    expect(c).toMatchObject({ name: "Spring launch", description: "Launch week.\nThree drops.", brandId: brand.id, objective: "launch", platforms: ["instagram", "tiktok"], status: "planned", startDate: "2030-03-01", endDate: "2030-03-31", budgetCents: 150050, budgetCurrency: "EUR", milestones: [], tasks: [], postIds: [], version: 1 });
    expect(await getCampaign(db, customer.id, c.id)).toEqual(c);
    // Defaults: a draft with no dates.
    expect(await createCampaign(db, customer.id, { name: "Ideas" })).toMatchObject({ status: "draft", objective: "awareness", startDate: null, budgetCents: null, budgetCurrency: "USD" });

    for (const bad of [
      {},
      { name: "   " },
      { name: "x".repeat(81) },
      { name: "A", startDate: "2030-02-30" },
      { name: "A", startDate: "2030-03-10", endDate: "2030-03-01" },
      { name: "A", status: "active" },
      { name: "A", status: "live" },
      { name: "A", objective: "virality" },
      { name: "A", budgetCents: -1 },
      { name: "A", budgetCents: 1.5 },
      { name: "A", budgetCurrency: "BTC" },
      { name: "A", platforms: ["myspace"] },
      { name: "A", unknown: 1 },
    ])
      expect(await codeOf(createCampaign(db, customer.id, bad)), JSON.stringify(bad)).toBe("VALIDATION_FAILED");
  });

  it("protects edits with versions, allows status-only changes, and keeps dates consistent", async () => {
    const { customer } = await makeCustomer(db);
    const c = await createCampaign(db, customer.id, { name: "Summer" });
    const v2 = await updateCampaign(db, customer.id, c.id, { description: "Hot", expectedVersion: 1 });
    expect(v2.version).toBe(2);
    expect(await codeOf(updateCampaign(db, customer.id, c.id, { description: "Stale", expectedVersion: 1 }))).toBe("CONFLICT");
    // Content edits need a version; a status-only change (archive/restore) does not.
    expect(await codeOf(updateCampaign(db, customer.id, c.id, { description: "No version" }))).toBe("VALIDATION_FAILED");
    const archived = await updateCampaign(db, customer.id, c.id, { status: "archived" });
    expect(archived).toMatchObject({ status: "archived", version: 3 });
    // Planned / in progress need a start date, including when only the status changes.
    expect(await codeOf(updateCampaign(db, customer.id, c.id, { status: "active" }))).toBe("VALIDATION_FAILED");
    const dated = await updateCampaign(db, customer.id, c.id, { startDate: "2030-06-01", endDate: "2030-06-30", status: "active", expectedVersion: archived.version });
    expect(dated).toMatchObject({ status: "active", startDate: "2030-06-01" });
    // An end date before the existing start date is refused.
    expect(await codeOf(updateCampaign(db, customer.id, c.id, { endDate: "2030-05-01", expectedVersion: dated.version }))).toBe("VALIDATION_FAILED");
  });

  it("isolates customers completely", async () => {
    const { customer: a } = await makeCustomer(db);
    const { customer: b } = await makeCustomer(db);
    const c = await createCampaign(db, a.id, { name: "Private" });
    const m = await addMilestone(db, a.id, c.id, { title: "M" });
    const t = await addTask(db, a.id, c.id, { title: "T" });
    const tpl = await saveAsTemplate(db, a.id, c.id, { name: "Mine" });
    const bBrand = await createBrand(db, b.id, { name: "Other" });
    const bPost = await saveDraft(db, b.id, null, draft());

    for (const call of [
      () => getCampaign(db, b.id, c.id),
      () => updateCampaign(db, b.id, c.id, { status: "archived" }),
      () => duplicateCampaign(db, b.id, c.id),
      () => deleteCampaign(db, b.id, c.id),
      () => addMilestone(db, b.id, c.id, { title: "x" }),
      () => updateMilestone(db, b.id, c.id, m.id, { title: "x", expectedVersion: 1 }),
      () => deleteMilestone(db, b.id, c.id, m.id),
      () => addTask(db, b.id, c.id, { title: "x" }),
      () => updateTask(db, b.id, c.id, t.id, { completed: true }),
      () => deleteTask(db, b.id, c.id, t.id),
      () => reorderTasks(db, b.id, c.id, { ids: [t.id] }),
      () => linkPosts(db, b.id, c.id, { postIds: [bPost.id] }),
      () => saveAsTemplate(db, b.id, c.id, { name: "steal" }),
      () => exportCampaign(db, b.id, c.id),
      () => updateTemplate(db, b.id, tpl.id, { name: "x" }),
      () => deleteTemplate(db, b.id, tpl.id),
      () => getCampaign(db, a.id, "not-a-uuid"),
    ])
      expect(await codeOf(call())).toBe("NOT_FOUND");
    // Another customer's brand, template or draft can't be attached.
    expect(await codeOf(createCampaign(db, a.id, { name: "x", brandId: bBrand.id }))).toBe("VALIDATION_FAILED");
    expect(await codeOf(createCampaign(db, b.id, { name: "x", templateId: tpl.id }))).toBe("VALIDATION_FAILED");
    const r = await linkPosts(db, a.id, c.id, { postIds: [bPost.id] });
    expect(r).toEqual({ linked: 0, skipped: [{ id: bPost.id, reason: "That post wasn't found." }] });
    expect((await getPost(db, b.id, bPost.id)).campaignId).toBeNull();
    // A milestone from another campaign can't hold this campaign's task.
    const other = await createCampaign(db, a.id, { name: "Other" });
    const om = await addMilestone(db, a.id, other.id, { title: "OM" });
    expect(await codeOf(addTask(db, a.id, c.id, { title: "x", milestoneId: om.id }))).toBe("VALIDATION_FAILED");
    expect((await listCampaigns(db, b.id)).length).toBe(0);
    expect(await listTemplates(db, b.id)).toEqual([]);
  });
});

describe("milestones and tasks", () => {
  it("tracks progress from real tasks and keeps tasks when a milestone is deleted", async () => {
    const { customer } = await makeCustomer(db);
    const c = await createCampaign(db, customer.id, { name: "Tasks" });
    expect(summaryOf(c)).toMatchObject({ taskCount: 0, tasksDone: 0, milestones: [] });
    const m = await addMilestone(db, customer.id, c.id, { title: "Content ready", dueDate: "2030-04-10" });
    const t1 = await addTask(db, customer.id, c.id, { title: "Write captions", milestoneId: m.id, priority: "high", dueDate: "2030-04-05" });
    const t2 = await addTask(db, customer.id, c.id, { title: "Shoot photos", milestoneId: m.id });
    const t3 = await addTask(db, customer.id, c.id, { title: "Loose task" });
    expect([t1.position, t2.position, t3.position]).toEqual([0, 1, 2]);

    await updateTask(db, customer.id, c.id, t1.id, { completed: true });
    let s = summaryOf(await getCampaign(db, customer.id, c.id));
    expect(s).toMatchObject({ taskCount: 3, tasksDone: 1, milestones: [{ id: m.id, done: false }] });
    expect(s.openTasks.map((t) => t.id)).toEqual([]); // t2/t3 have no due date; t1 is done
    await updateTask(db, customer.id, c.id, t2.id, { completed: true });
    s = summaryOf(await getCampaign(db, customer.id, c.id));
    expect(s.milestones[0]!.done).toBe(true);
    // Ticking twice keeps the original completion time; unticking clears it. Neither bumps the version.
    const done = (await getCampaign(db, customer.id, c.id)).tasks.find((t) => t.id === t1.id)!;
    const again = await updateTask(db, customer.id, c.id, t1.id, { completed: true });
    expect(again).toMatchObject({ completedAt: done.completedAt, version: 1 });
    expect((await updateTask(db, customer.id, c.id, t1.id, { completed: false })).completedAt).toBeNull();

    // Content edits need the version and bump it.
    expect(await codeOf(updateTask(db, customer.id, c.id, t3.id, { title: "No version" }))).toBe("VALIDATION_FAILED");
    expect((await updateTask(db, customer.id, c.id, t3.id, { title: "Renamed", notes: "n", expectedVersion: 1 })).version).toBe(2);
    expect(await codeOf(updateTask(db, customer.id, c.id, t3.id, { title: "Stale", expectedVersion: 1 }))).toBe("CONFLICT");
    expect(await codeOf(updateMilestone(db, customer.id, c.id, m.id, { title: "Ready", expectedVersion: 1 }))).toBe("resolved");
    expect(await codeOf(updateMilestone(db, customer.id, c.id, m.id, { title: "Stale", expectedVersion: 1 }))).toBe("CONFLICT");
    for (const bad of [{ title: "" }, { title: "x".repeat(141) }, { title: "x", priority: "urgent" }, { title: "x", dueDate: "tomorrow" }]) expect(await codeOf(addTask(db, customer.id, c.id, bad))).toBe("VALIDATION_FAILED");

    await deleteMilestone(db, customer.id, c.id, m.id);
    const after = await getCampaign(db, customer.id, c.id);
    expect(after.milestones).toEqual([]);
    expect(after.tasks.map((t) => [t.title, t.milestoneId])).toEqual([
      ["Write captions", null],
      ["Shoot photos", null],
      ["Renamed", null],
    ]);
    await deleteTask(db, customer.id, c.id, t3.id);
    expect((await getCampaign(db, customer.id, c.id)).tasks.length).toBe(2);
  });

  it("reorders only with the exact current task list", async () => {
    const { customer } = await makeCustomer(db);
    const c = await createCampaign(db, customer.id, { name: "Order" });
    const [a, b, d] = [await addTask(db, customer.id, c.id, { title: "A" }), await addTask(db, customer.id, c.id, { title: "B" }), await addTask(db, customer.id, c.id, { title: "C" })];
    await reorderTasks(db, customer.id, c.id, { ids: [d.id, a.id, b.id] });
    expect((await getCampaign(db, customer.id, c.id)).tasks.map((t) => t.title)).toEqual(["C", "A", "B"]);
    // A stale list (missing or duplicated tasks) is refused, so concurrent edits are never lost.
    expect(await codeOf(reorderTasks(db, customer.id, c.id, { ids: [a.id, b.id] }))).toBe("CONFLICT");
    expect(await codeOf(reorderTasks(db, customer.id, c.id, { ids: [a.id, a.id, b.id] }))).toBe("CONFLICT");
  });

  it("serialises concurrent task additions", async () => {
    const { customer } = await makeCustomer(db);
    const c = await createCampaign(db, customer.id, { name: "Rapid" });
    await Promise.all(Array.from({ length: 8 }, (_, i) => addTask(db, customer.id, c.id, { title: `T${i}` })));
    const positions = (await db.select({ p: campaignTasks.position }).from(campaignTasks).where(eq(campaignTasks.campaignId, c.id))).map((r) => r.p).sort((x, y) => x - y);
    expect(positions).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });
});

describe("content links", () => {
  it("links without copying, keeps brands consistent, and never deletes drafts", async () => {
    const { customer } = await makeCustomer(db);
    const bean = await createBrand(db, customer.id, { name: "Bean" });
    const leaf = await createBrand(db, customer.id, { name: "Leaf" });
    const c = await createCampaign(db, customer.id, { name: "Bean week", brandId: bean.id });
    const unbranded = await saveDraft(db, customer.id, null, draft("Unbranded"));
    const onBrand = await saveDraft(db, customer.id, null, { ...draft("On brand"), brandId: bean.id });
    const offBrand = await saveDraft(db, customer.id, null, { ...draft("Off brand"), brandId: leaf.id });
    const before = await db.select({ n: socialPosts.id }).from(socialPosts).where(eq(socialPosts.customerId, customer.id));

    const r = await linkPosts(db, customer.id, c.id, { postIds: [unbranded.id, onBrand.id, offBrand.id, onBrand.id] });
    expect(r.linked).toBe(2);
    expect(r.skipped).toEqual([{ id: offBrand.id, reason: "It's for a different brand than this plan." }]);
    // No copies; the unbranded draft took the campaign's brand; versions untouched.
    expect((await db.select({ n: socialPosts.id }).from(socialPosts).where(eq(socialPosts.customerId, customer.id))).length).toBe(before.length);
    const u = await getPost(db, customer.id, unbranded.id);
    expect(u).toMatchObject({ campaignId: c.id, brandId: bean.id, version: unbranded.version, text: "Unbranded" });
    expect((await getCampaign(db, customer.id, c.id)).postIds.sort()).toEqual([unbranded.id, onBrand.id].sort());

    // A linked draft can't drift to another brand through any path; clearing the brand is allowed.
    expect(await codeOf(setPostFlags(db, customer.id, onBrand.id, { brandId: leaf.id }))).toBe("CONFLICT");
    expect(await codeOf(saveDraft(db, customer.id, onBrand.id, { ...draft("On brand"), brandId: leaf.id, expectedVersion: onBrand.version }))).toBe("CONFLICT");
    const bulk = await bulkPosts(db, customer.id, { action: "brand", ids: [onBrand.id, offBrand.id], brandId: leaf.id });
    expect(bulk.done).toBe(1);
    expect(bulk.skipped[0]!.id).toBe(onBrand.id);
    // The campaign's brand can't change while linked drafts are for another brand.
    const fresh = await getCampaign(db, customer.id, c.id);
    expect(await codeOf(updateCampaign(db, customer.id, c.id, { brandId: leaf.id, expectedVersion: fresh.version }))).toBe("CONFLICT");

    // A draft in one campaign isn't silently moved to another.
    const c2 = await createCampaign(db, customer.id, { name: "Second" });
    expect((await linkPosts(db, customer.id, c2.id, { postIds: [onBrand.id] })).skipped[0]!.reason).toBe("It's already part of another plan.");

    // Composer edits keep the link and the version check still works.
    const edited = await saveDraft(db, customer.id, onBrand.id, { ...draft("Edited"), expectedVersion: onBrand.version });
    expect(edited).toMatchObject({ campaignId: c.id, text: "Edited", version: onBrand.version + 1 });
    expect(await codeOf(saveDraft(db, customer.id, onBrand.id, { ...draft("Stale"), expectedVersion: onBrand.version }))).toBe("CONFLICT");

    // Unlinking keeps the draft exactly as it is.
    await unlinkPost(db, customer.id, c.id, { postId: onBrand.id });
    expect(await getPost(db, customer.id, onBrand.id)).toMatchObject({ campaignId: null, text: "Edited", brandId: bean.id });
    expect(await codeOf(unlinkPost(db, customer.id, c.id, { postId: onBrand.id }))).toBe("NOT_FOUND");

    // Deleting the campaign unlinks; deleting its brand clears the campaign's brand. No draft is deleted.
    expect(await deleteCampaign(db, customer.id, c.id)).toEqual({ unlinked: 1 });
    expect(await getPost(db, customer.id, unbranded.id)).toMatchObject({ campaignId: null, text: "Unbranded" });
    const c3 = await createCampaign(db, customer.id, { name: "Leaf week", brandId: leaf.id });
    await deleteBrand(db, customer.id, leaf.id);
    expect((await getCampaign(db, customer.id, c3.id)).brandId).toBeNull();
    expect((await db.select({ n: socialPosts.id }).from(socialPosts).where(eq(socialPosts.customerId, customer.id))).length).toBe(before.length);
  });

  it("shares campaign summaries with the content workspace", async () => {
    const { customer } = await makeCustomer(db);
    const c = await createCampaign(db, customer.id, { name: "Calendar", startDate: "2030-05-01", endDate: "2030-05-31" });
    await addMilestone(db, customer.id, c.id, { title: "Teaser", dueDate: "2030-05-10" });
    const meta = await contentMeta(db, customer.id);
    expect(meta.campaigns).toEqual([expect.objectContaining({ id: c.id, name: "Calendar", startDate: "2030-05-01", endDate: "2030-05-31", milestones: [expect.objectContaining({ title: "Teaser", dueDate: "2030-05-10", done: false })] })]);
  });
});

describe("templates, duplicates and export", () => {
  it("saves independent templates and creates campaigns from them", async () => {
    const { customer } = await makeCustomer(db);
    const c = await createCampaign(db, customer.id, { name: "Launch", objective: "launch", platforms: ["instagram"], startDate: "2030-01-01", endDate: "2030-01-31", budgetCents: 500, notes: "secret" });
    const m = await addMilestone(db, customer.id, c.id, { title: "Assets", dueDate: "2030-01-10" });
    await addTask(db, customer.id, c.id, { title: "Brief", milestoneId: m.id, dueDate: "2030-01-03", priority: "high", notes: "n" });
    await addTask(db, customer.id, c.id, { title: "Loose" });
    const post = await saveDraft(db, customer.id, null, draft());
    await linkPosts(db, customer.id, c.id, { postIds: [post.id] });

    const tpl = await saveAsTemplate(db, customer.id, c.id, { name: "Launch kit" });
    expect(tpl).toMatchObject({ name: "Launch kit", objective: "launch", platforms: ["instagram"], structure: { milestones: [{ title: "Assets", offsetDays: 9 }], tasks: [{ title: "Brief", priority: "high", milestone: 0, offsetDays: 2, notes: "n" }, { title: "Loose", milestone: null, offsetDays: null }] } });
    expect(JSON.stringify(tpl)).not.toContain("secret");
    expect(await codeOf(saveAsTemplate(db, customer.id, c.id, { name: "launch KIT" }))).toBe("CONFLICT");

    const fromTpl = await createCampaign(db, customer.id, { name: "Launch 2", templateId: tpl.id, startDate: "2031-02-01" });
    expect(fromTpl).toMatchObject({ objective: "launch", platforms: ["instagram"], postIds: [] });
    expect(fromTpl.milestones).toEqual([expect.objectContaining({ title: "Assets", dueDate: "2031-02-10" })]);
    expect(fromTpl.tasks.map((t) => [t.title, t.dueDate, t.milestoneId === fromTpl.milestones[0]!.id, t.completedAt])).toEqual([
      ["Brief", "2031-02-03", true, null],
      ["Loose", null, false, null],
    ]);
    // Built-in starter plans: stages and to-dos placed from the start date, never mixed with a template.
    const fromStarter = await createCampaign(db, customer.id, { name: "Sale", starter: "sale", startDate: "2031-11-01" });
    expect(fromStarter).toMatchObject({ objective: "sales", postIds: [] });
    expect(fromStarter.milestones.map((m) => [m.title, m.dueDate])).toEqual([
      ["Plan the offer", "2031-11-04"],
      ["Sale is live", "2031-11-08"],
      ["Wrap up", "2031-11-15"],
    ]);
    expect(fromStarter.tasks.length).toBe(6);
    expect(fromStarter.tasks.every((t) => t.milestoneId && !t.completedAt)).toBe(true);
    expect((await createCampaign(db, customer.id, { name: "Undated", starter: "weekly" })).tasks.every((t) => t.dueDate === null)).toBe(true);
    expect(await codeOf(createCampaign(db, customer.id, { name: "x", starter: "party" }))).toBe("VALIDATION_FAILED");
    expect(await codeOf(createCampaign(db, customer.id, { name: "x", starter: "sale", templateId: tpl.id }))).toBe("VALIDATION_FAILED");
    // Templates are independent: editing or deleting one never touches campaigns.
    await updateTemplate(db, customer.id, tpl.id, { name: "Renamed kit" });
    await deleteTemplate(db, customer.id, tpl.id);
    expect((await getCampaign(db, customer.id, fromTpl.id)).tasks.length).toBe(2);
    expect(await codeOf(createCampaign(db, customer.id, { name: "x", templateId: tpl.id }))).toBe("VALIDATION_FAILED");

    // Duplicates are drafts with the same structure, open tasks and no linked content.
    await updateTask(db, customer.id, c.id, (await getCampaign(db, customer.id, c.id)).tasks[0]!.id, { completed: true });
    const dup = await duplicateCampaign(db, customer.id, c.id);
    expect(dup).toMatchObject({ name: "Launch (copy)", status: "draft", postIds: [], budgetCents: 500 });
    expect(dup.tasks.every((t) => t.completedAt === null)).toBe(true);
    expect(dup.milestones.length).toBe(1);

    // CSV export: real rows only, formulas neutralised.
    await addTask(db, customer.id, c.id, { title: "=HYPERLINK(1)" });
    const { csv, filename } = await exportCampaign(db, customer.id, c.id);
    expect(filename).toBe("marketing-plan-launch.csv");
    expect(csv.split("\r\n")[0]).toBe("Type,Title,Stage,Due or planned,Priority,Status,Platforms");
    expect(csv).toContain("Stage,Assets,,2030-01-10,,1/1 to-dos done,");
    expect(csv).toContain("'=HYPERLINK(1)");
    expect(csv).toContain("Post,A campaign draft");
  });
});
