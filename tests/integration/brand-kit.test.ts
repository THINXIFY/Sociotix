import { eq } from "drizzle-orm";
import { Client } from "pg";
import { ZodError } from "zod";
import { afterAll, beforeAll, describe, expect, inject, it, vi } from "vitest";
import { createDb, type Db } from "@/server/db/client";
import { brands, contentMedia, socialPosts, socialPostTargets } from "@/server/db/schema";
import { AppError } from "@/server/errors";
import { assertOwnBrand, brandContext, createBrand, deleteBrand, duplicateBrand, getBrand, listBrands, setDefaultBrand, updateBrand } from "@/server/brand";
import { bulkPosts, contentMeta, deleteMedia, importAiContent, setPostFlags, storeMedia } from "@/server/content";
import { duplicatePost, getPost, listPosts, saveDraft } from "@/server/social/publishing";
import { runMigrations } from "../../scripts/db/migrate";
import { makeCustomer } from "./auth-helpers";

vi.mock("next/headers", async () => (await import("./auth-helpers")).jarMock());

/*
 * BR-01: brand profiles. A customer keeps several brands with one default, can attach a brand to drafts without
 * touching the draft's content, and deleting a brand never deletes drafts or images. Nothing crosses customers.
 */
const scratch = `socivanta_brand_test_${Date.now()}`;
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

const png = (seed = 0) => Buffer.concat([Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64"), Buffer.from([seed])]);
const draft = { text: "A draft for the brand", timezone: "UTC" };

describe("brand profiles", () => {
  it("creates, normalises and reads back every field", async () => {
    const { customer } = await makeCustomer(db);
    const b = await createBrand(db, customer.id, {
      name: "  Bean   &  Leaf ",
      description: "Independent café.\r\nOpen daily.",
      website: "beanandleaf.example/menu/",
      industry: "Food & beverage",
      primaryColor: "#7047EB",
      secondaryColor: "c8f",
      accentColor: "C8FF52",
      personality: ["Warm", "warm", "Playful", ""],
      toneOfVoice: "Friendly, never pushy.",
      audience: "Students and remote workers",
      demographics: "18–35, urban",
      platforms: ["instagram", "tiktok", "instagram"],
      keywords: ["coffee", "Coffee", "latte art"],
      hashtags: ["beanandleaf", "BeanAndLeaf", "latteart"],
      writingGuidelines: "Short sentences. Emojis sparingly.",
      preferredPhrases: ["Fresh from the roaster"],
      avoidWords: ["cheap", "Cheap", "discount"],
    });
    expect(b).toMatchObject({
      name: "Bean & Leaf",
      description: "Independent café.\nOpen daily.",
      website: "https://beanandleaf.example/menu",
      primaryColor: "#7047eb",
      secondaryColor: "#cc88ff",
      accentColor: "#c8ff52",
      personality: ["Warm", "Playful"],
      platforms: ["instagram", "tiktok"],
      keywords: ["coffee", "latte art"],
      hashtags: ["beanandleaf", "latteart"],
      avoidWords: ["cheap", "discount"],
      isDefault: true,
      postCount: 0,
      version: 1,
    });
    expect(await getBrand(db, customer.id, b.id)).toEqual(b);
  });

  it("validates colors, websites, hashtags and lengths", async () => {
    const { customer } = await makeCustomer(db);
    for (const bad of [
      { name: "" },
      { name: "   " },
      { name: "x".repeat(61) },
      { name: "A", primaryColor: "purple" },
      { name: "A", primaryColor: "#12345" },
      { name: "A", accentColor: "#gggggg" },
      { name: "A", website: "javascript:alert(1)" },
      { name: "A", website: "ftp://example.com" },
      { name: "A", website: "nodot" },
      { name: "A", hashtags: ["has space"] },
      { name: "A", hashtags: ["a-b"] },
      { name: "A", personality: Array.from({ length: 9 }, (_, i) => `t${i}`) },
      { name: "A", avoidWords: ["x".repeat(61)] },
      { name: "A", description: "x".repeat(601) },
      { name: "A", platforms: ["myspace"] },
      { name: "A", unknown: 1 },
    ]) {
      expect(await codeOf(createBrand(db, customer.id, bad)), JSON.stringify(bad)).toBe("VALIDATION_FAILED");
    }
    expect(await listBrands(db, customer.id)).toHaveLength(0);
    // Empty optional colors and links clear them.
    const ok = await createBrand(db, customer.id, { name: "Plain", primaryColor: "", website: "" });
    expect(ok).toMatchObject({ primaryColor: null, website: null });
  });

  it("keeps names unique per customer and rejects a repeated submission", async () => {
    const { customer } = await makeCustomer(db);
    const { customer: other } = await makeCustomer(db);
    await createBrand(db, customer.id, { name: "Acme" });
    expect(await codeOf(createBrand(db, customer.id, { name: "acme" }))).toBe("CONFLICT");
    // The same name is fine for someone else.
    await createBrand(db, other.id, { name: "Acme" });
    // Two identical submissions at once: exactly one wins.
    const results = await Promise.all([createBrand(db, customer.id, { name: "Twin" }).then(() => "ok", (e) => (e as AppError).code), createBrand(db, customer.id, { name: "Twin" }).then(() => "ok", (e) => (e as AppError).code)]);
    expect(results.sort()).toEqual(["CONFLICT", "ok"]);
    expect((await listBrands(db, customer.id)).filter((b) => b.name === "Twin")).toHaveLength(1);
  });

  it("caps the number of brands", async () => {
    const { customer } = await makeCustomer(db);
    for (let i = 0; i < 20; i++) await createBrand(db, customer.id, { name: `Brand ${i}` });
    expect(await codeOf(createBrand(db, customer.id, { name: "One too many" }))).toBe("CONFLICT");
    expect(await codeOf(duplicateBrand(db, customer.id, (await listBrands(db, customer.id))[0]!.id))).toBe("CONFLICT");
  });

  it("edits with optimistic concurrency", async () => {
    const { customer } = await makeCustomer(db);
    const b = await createBrand(db, customer.id, { name: "Versioned", toneOfVoice: "Calm" });
    const v2 = await updateBrand(db, customer.id, b.id, { expectedVersion: 1, toneOfVoice: "Bold" });
    expect(v2).toMatchObject({ version: 2, toneOfVoice: "Bold", name: "Versioned" });
    // A stale tab can't overwrite.
    expect(await codeOf(updateBrand(db, customer.id, b.id, { expectedVersion: 1, toneOfVoice: "Stale" }))).toBe("CONFLICT");
    // Two saves from the same version at once: one wins, one is told to reload.
    const race = await Promise.all([updateBrand(db, customer.id, b.id, { expectedVersion: 2, industry: "A" }).then(() => "ok", (e) => (e as AppError).code), updateBrand(db, customer.id, b.id, { expectedVersion: 2, industry: "B" }).then(() => "ok", (e) => (e as AppError).code)]);
    expect(race.sort()).toEqual(["CONFLICT", "ok"]);
    expect((await getBrand(db, customer.id, b.id)).version).toBe(3);
    expect(await codeOf(updateBrand(db, customer.id, b.id, { expectedVersion: 3 }))).toBe("VALIDATION_FAILED");
    // Renaming onto another brand's name is refused cleanly.
    await createBrand(db, customer.id, { name: "Taken" });
    expect(await codeOf(updateBrand(db, customer.id, b.id, { expectedVersion: 3, name: "taken" }))).toBe("CONFLICT");
  });

  it("always has exactly one default", async () => {
    const { customer } = await makeCustomer(db);
    const a = await createBrand(db, customer.id, { name: "A" });
    const b = await createBrand(db, customer.id, { name: "B" });
    const c = await createBrand(db, customer.id, { name: "C" });
    expect([a.isDefault, b.isDefault, c.isDefault]).toEqual([true, false, false]);
    await setDefaultBrand(db, customer.id, b.id);
    let all = await listBrands(db, customer.id);
    expect(all.filter((x) => x.isDefault).map((x) => x.name)).toEqual(["B"]);
    expect(all[0]!.name).toBe("B"); // default first
    // Concurrent default changes still leave one.
    await Promise.all([setDefaultBrand(db, customer.id, a.id), setDefaultBrand(db, customer.id, c.id)]);
    all = await listBrands(db, customer.id);
    expect(all.filter((x) => x.isDefault)).toHaveLength(1);
    // The database itself refuses two defaults.
    const other = all.find((x) => !x.isDefault)!;
    await expect(db.update(brands).set({ isDefault: true }).where(eq(brands.id, other.id))).rejects.toThrow();
    // Deleting the default promotes the oldest remaining brand.
    const current = all.find((x) => x.isDefault)!;
    await deleteBrand(db, customer.id, current.id);
    all = await listBrands(db, customer.id);
    expect(all).toHaveLength(2);
    expect(all.filter((x) => x.isDefault)).toHaveLength(1);
    // Deleting the last one leaves none, and the next one created is the default again.
    for (const x of all) await deleteBrand(db, customer.id, x.id);
    expect(await listBrands(db, customer.id)).toHaveLength(0);
    expect((await createBrand(db, customer.id, { name: "Fresh" })).isDefault).toBe(true);
  });

  it("duplicates without becoming the default and picks a free name", async () => {
    const { customer } = await makeCustomer(db);
    const src = await createBrand(db, customer.id, { name: "Original", primaryColor: "#112233", hashtags: ["one"], avoidWords: ["no"] });
    const one = await duplicateBrand(db, customer.id, src.id);
    const two = await duplicateBrand(db, customer.id, src.id);
    expect(one).toMatchObject({ name: "Original (copy)", isDefault: false, primaryColor: "#112233", hashtags: ["one"], avoidWords: ["no"], version: 1 });
    expect(two.name).toBe("Original (copy 2)");
    expect(one.id).not.toBe(src.id);
    const long = await createBrand(db, customer.id, { name: "n".repeat(60) });
    expect(Array.from((await duplicateBrand(db, customer.id, long.id)).name).length).toBeLessThanOrEqual(60);
  });

  it("builds structured context for the AI tools from a brand's own data", async () => {
    const { customer } = await makeCustomer(db);
    const b = await createBrand(db, customer.id, { name: "Ctx", industry: "Tech", personality: ["Bold"], toneOfVoice: "Direct", audience: "Founders", platforms: ["linkedin"], avoidWords: ["synergy"], preferredPhrases: ["ship it"], writingGuidelines: "Plain English." });
    expect(await brandContext(db, customer.id, b.id)).toEqual({
      brandId: b.id,
      name: "Ctx",
      industry: "Tech",
      description: "",
      website: null,
      personality: ["Bold"],
      toneOfVoice: "Direct",
      audience: "Founders",
      demographics: "",
      platforms: ["linkedin"],
      keywords: [],
      hashtags: [],
      writing: { guidelines: "Plain English.", preferredPhrases: ["ship it"], avoidWords: ["synergy"] },
    });
  });
});

describe("account isolation", () => {
  it("never lets one customer see or change another's brands or images", async () => {
    const { customer: a } = await makeCustomer(db);
    const { customer: b } = await makeCustomer(db);
    const mine = await createBrand(db, a.id, { name: "Private" });
    const media = await storeMedia(db, a.id, png(1), "logo.png");
    for (const run of [
      () => getBrand(db, b.id, mine.id),
      () => updateBrand(db, b.id, mine.id, { expectedVersion: 1, name: "Hijacked" }),
      () => deleteBrand(db, b.id, mine.id),
      () => duplicateBrand(db, b.id, mine.id),
      () => setDefaultBrand(db, b.id, mine.id),
      () => brandContext(db, b.id, mine.id),
    ]) expect(await codeOf(run())).toBe("NOT_FOUND");
    expect(await codeOf(getBrand(db, b.id, "not-a-uuid"))).toBe("NOT_FOUND");
    expect(await listBrands(db, b.id)).toHaveLength(0);
    expect((await getBrand(db, a.id, mine.id)).name).toBe("Private");
    // Another customer's image can't be used as a logo, and a foreign brand can't be attached to a draft.
    expect(await codeOf(createBrand(db, b.id, { name: "Stolen logo", logoMediaId: media.id }))).toBe("VALIDATION_FAILED");
    const own = await createBrand(db, b.id, { name: "Mine" });
    expect(await codeOf(updateBrand(db, b.id, own.id, { expectedVersion: 1, coverMediaId: media.id }))).toBe("VALIDATION_FAILED");
    expect(await codeOf(saveDraft(db, b.id, null, { ...draft, brandId: mine.id }))).toBe("VALIDATION_FAILED");
    const post = await saveDraft(db, b.id, null, draft);
    expect(await codeOf(setPostFlags(db, b.id, post.id, { brandId: mine.id }))).toBe("VALIDATION_FAILED");
    expect(await codeOf(bulkPosts(db, b.id, { action: "brand", ids: [post.id], brandId: mine.id }))).toBe("resolved");
    expect((await getPost(db, b.id, post.id)).brandId).toBeNull();
    expect(await codeOf(assertOwnBrand(db, b.id, mine.id))).toBe("VALIDATION_FAILED");
    expect((await contentMeta(db, b.id)).brands.map((x) => x.name)).toEqual(["Mine"]);
  });
});

describe("logo and cover images", () => {
  it("uses library images, and deleting an image or a brand never removes the other", async () => {
    const { customer } = await makeCustomer(db);
    const logo = await storeMedia(db, customer.id, png(2), "Logo.png");
    const cover = await storeMedia(db, customer.id, png(3), "Cover.png");
    const b = await createBrand(db, customer.id, { name: "Visual", logoMediaId: logo.id, coverMediaId: cover.id });
    expect(b).toMatchObject({ logoMediaId: logo.id, coverMediaId: cover.id });
    // Deleting the image clears it from the brand; the brand stays.
    await deleteMedia(db, customer.id, cover.id);
    expect(await getBrand(db, customer.id, b.id)).toMatchObject({ logoMediaId: logo.id, coverMediaId: null });
    // Deleting the brand leaves the image in the library.
    await deleteBrand(db, customer.id, b.id);
    const left = await db.select({ id: contentMedia.id }).from(contentMedia).where(eq(contentMedia.id, logo.id));
    expect(left).toHaveLength(1);
    // A fake image is refused before it can be a logo.
    expect(await codeOf(storeMedia(db, customer.id, Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"), "logo.png"))).toBe("VALIDATION_FAILED");
  });
});

describe("content integration", () => {
  it("assigns a brand to drafts, filters by it and keeps unbranded posts working", async () => {
    const { customer } = await makeCustomer(db);
    const brand = await createBrand(db, customer.id, { name: "Cafe" });
    const withBrand = await saveDraft(db, customer.id, null, { ...draft, text: "Branded", brandId: brand.id });
    const without = await saveDraft(db, customer.id, null, { ...draft, text: "Plain" });
    expect(withBrand.brandId).toBe(brand.id);
    expect(without.brandId).toBeNull();
    expect((await listPosts(db, customer.id)).filter((p) => p.brandId === brand.id).map((p) => p.text)).toEqual(["Branded"]);
    expect((await contentMeta(db, customer.id)).brands).toEqual([expect.objectContaining({ id: brand.id, postCount: 1, isDefault: true })]);
    // An edit that leaves brandId out keeps it; null clears it.
    const edited = await saveDraft(db, customer.id, withBrand.id, { ...draft, text: "Branded, edited", expectedVersion: withBrand.version });
    expect(edited.brandId).toBe(brand.id);
    // A copy keeps the brand.
    expect((await duplicatePost(db, customer.id, withBrand.id)).brandId).toBe(brand.id);
  });

  it("changes a draft's brand without touching its content, version or plan", async () => {
    const { customer } = await makeCustomer(db);
    const a = await createBrand(db, customer.id, { name: "A" });
    const b = await createBrand(db, customer.id, { name: "B" });
    const post = await saveDraft(db, customer.id, null, { ...draft, text: "Keep me ✨", title: "Title", hashtags: ["tag"], notes: "n", providers: ["instagram"], brandId: a.id });
    await setPostFlags(db, customer.id, post.id, { plannedLocal: "2030-05-01T09:30", timezone: "UTC" });
    const before = await getPost(db, customer.id, post.id);
    await setPostFlags(db, customer.id, post.id, { brandId: b.id });
    const after = await getPost(db, customer.id, post.id);
    expect(after).toMatchObject({ brandId: b.id, text: "Keep me ✨", title: "Title", hashtags: ["tag"], notes: "n", providers: ["instagram"], plannedAt: before.plannedAt, version: before.version, status: "draft" });
    // Planning keeps the brand, and clearing the brand keeps the plan.
    await setPostFlags(db, customer.id, post.id, { plannedLocal: "2030-05-02T10:00", timezone: "UTC" });
    expect((await getPost(db, customer.id, post.id)).brandId).toBe(b.id);
    await setPostFlags(db, customer.id, post.id, { brandId: null });
    expect(await getPost(db, customer.id, post.id)).toMatchObject({ brandId: null, plannedAt: "2030-05-02T10:00:00.000Z" });
    // Nothing was scheduled or sent for approval along the way.
    expect(await db.select().from(socialPostTargets).where(eq(socialPostTargets.postId, post.id))).toHaveLength(0);
  });

  it("assigns a brand to many drafts at once and reports ones that can't change", async () => {
    const { customer } = await makeCustomer(db);
    const brand = await createBrand(db, customer.id, { name: "Bulk" });
    const posts = await Promise.all([1, 2, 3].map((n) => saveDraft(db, customer.id, null, { ...draft, text: `Post ${n}` })));
    const r = await bulkPosts(db, customer.id, { action: "brand", ids: posts.map((p) => p.id), brandId: brand.id });
    expect(r).toEqual({ done: 3, skipped: [] });
    expect((await contentMeta(db, customer.id)).brands[0]!.postCount).toBe(3);
    await bulkPosts(db, customer.id, { action: "brand", ids: [posts[0]!.id], brandId: null });
    expect((await getPost(db, customer.id, posts[0]!.id)).brandId).toBeNull();
  });

  it("deleting a brand keeps every draft, its content and its images", async () => {
    const { customer } = await makeCustomer(db);
    const img = await storeMedia(db, customer.id, png(9), "pic.png");
    const brand = await createBrand(db, customer.id, { name: "Doomed", logoMediaId: img.id });
    const post = await saveDraft(db, customer.id, null, { ...draft, text: "Survives", brandId: brand.id, mediaIds: [img.id] });
    await setPostFlags(db, customer.id, post.id, { plannedLocal: "2030-06-01T08:00", timezone: "UTC" });
    expect(await deleteBrand(db, customer.id, brand.id)).toEqual({ unlinked: 1 });
    const kept = await getPost(db, customer.id, post.id);
    expect(kept).toMatchObject({ text: "Survives", brandId: null, plannedAt: "2030-06-01T08:00:00.000Z", mediaIds: [img.id] });
    expect(await db.select({ id: socialPosts.id }).from(socialPosts).where(eq(socialPosts.id, post.id))).toHaveLength(1);
    expect((await contentMeta(db, customer.id)).media.map((m) => m.id)).toEqual([img.id]);
  });

  it("saves AI results into the chosen brand, never saves into a foreign one", async () => {
    const { customer } = await makeCustomer(db);
    const { customer: other } = await makeCustomer(db);
    const brand = await createBrand(db, customer.id, { name: "AI brand" });
    const foreign = await createBrand(db, other.id, { name: "Not mine" });
    const items = [{ title: "Instagram · Direct", text: "New arrivals are in.", providers: ["instagram"] }];
    const saved = await importAiContent(db, customer.id, { source: "caption-generator", kind: "draft", timezone: "UTC", brandId: brand.id, items });
    expect(saved.created).toHaveLength(1);
    expect((await getPost(db, customer.id, saved.created[0]!.id)).brandId).toBe(brand.id);
    // The same result again for the same brand is a duplicate; for no brand it is a different draft.
    expect((await importAiContent(db, customer.id, { source: "caption-generator", kind: "draft", timezone: "UTC", brandId: brand.id, items })).duplicates).toHaveLength(1);
    const unbranded = await importAiContent(db, customer.id, { source: "caption-generator", kind: "draft", timezone: "UTC", items });
    expect(unbranded.created).toHaveLength(1);
    expect((await getPost(db, customer.id, unbranded.created[0]!.id)).brandId).toBeNull();
    expect(await codeOf(importAiContent(db, customer.id, { source: "caption-generator", kind: "draft", timezone: "UTC", brandId: foreign.id, items }))).toBe("VALIDATION_FAILED");
    // Hashtag templates have no brand and still save.
    const t = await importAiContent(db, customer.id, { source: "hashtag-finder", kind: "template", timezone: "UTC", brandId: brand.id, items: [{ title: "Set", hashtags: ["a", "b"] }] });
    expect(t.created).toHaveLength(1);
  });
});
