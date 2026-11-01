import { eq } from "drizzle-orm";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, inject, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST as mediaPost } from "@/app/api/admin/blog/media/route";
import { POST as actionPost } from "@/app/api/admin/blog/posts/[id]/[action]/route";
import { DELETE as postDelete, GET as postGet, PATCH as postPatch } from "@/app/api/admin/blog/posts/[id]/route";
import { GET as listGet, POST as createPost } from "@/app/api/admin/blog/posts/route";
import { DELETE as categoryDelete, PATCH as categoryPatch } from "@/app/api/admin/blog/categories/[key]/route";
import { GET as categoriesGet, POST as categoryPost } from "@/app/api/admin/blog/categories/route";
import { GET as mediaGet } from "@/app/media/blog/[id]/route";
import { proxy } from "@/proxy";
import { createDb, type Db } from "@/server/db/client";
import { auditLog, blogPosts } from "@/server/db/schema";
import { resetEnvCache } from "@/server/env";
import { allPublishedArticles, findPublicArticle } from "@/server/blog/public";
import { resolvePublicSlug } from "@/server/blog/posts";
import type { AdminCategory, AdminPost, AdminPostList } from "@/lib/blog/admin";
import { runMigrations } from "../../scripts/db/migrate";
import { seedReferenceData } from "../../scripts/db/seed";
import { makeStaff, signInAs } from "./auth-helpers";

vi.mock("next/headers", async () => (await import("./auth-helpers")).jarMock());

/* Admin Blog Management against a scratch database: permissions, CRUD, publishing, images, public visibility. */
const scratch = `socivanta_blog_test_${Date.now()}`;
let db: Db;
let admin: Client;
let editor: Awaited<ReturnType<typeof makeStaff>>;
let support: Awaited<ReturnType<typeof makeStaff>>;

beforeAll(async () => {
  admin = new Client({ connectionString: inject("adminUrl") });
  await admin.connect();
  await admin.query(`create database ${scratch} encoding 'UTF8' template template0`);
  const u = new URL(inject("adminUrl"));
  u.pathname = `/${scratch}`;
  await runMigrations(u.toString());
  process.env.DATABASE_URL = u.toString();
  resetEnvCache();
  db = createDb(u.toString());
  await seedReferenceData(db);
  editor = await makeStaff(db, "admin");
  support = await makeStaff(db, "support");
}, 120_000);
afterAll(async () => {
  await db.$client.end();
  process.env.DATABASE_URL = inject("databaseUrl");
  resetEnvCache();
  await admin.query(`drop database if exists ${scratch} with (force)`);
  await admin.end();
});

const ORIGIN = "http://localhost:3000";
type Handler = (r: Request, c: unknown) => Promise<Response>;
const call = (fn: unknown, init: RequestInit & { json?: unknown } = {}, ctx: unknown = {}, url = "/api/admin/blog/posts") =>
  (fn as Handler)(new Request(ORIGIN + url, { ...init, ...(init.json !== undefined ? { body: JSON.stringify(init.json) } : {}), headers: { ...(init.json !== undefined ? { "content-type": "application/json" } : {}), origin: ORIGIN, ...(init.headers ?? {}) } }), ctx);
const idCtx = (id: string) => ({ params: Promise.resolve({ id }) });
const actCtx = (id: string, action: string) => ({ params: Promise.resolve({ id, action }) });

const MEDIA_PNG = (() => {
  const b = Buffer.alloc(40);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8);
  b.write("IHDR", 12, "latin1");
  b.writeUInt32BE(1200, 16);
  b.writeUInt32BE(630, 20);
  b.write("unique-png-bytes", 24, "latin1");
  return b;
})();

let seq = 0;
const draft = (over: Record<string, unknown> = {}) => ({
  title: "Plan a Content Calendar",
  slug: `plan-content-${Date.now().toString(36)}-${++seq}`,
  excerpt: "A simple way to plan a month of posts.",
  category: "guides",
  content: [
    { type: "p", runs: [{ text: "A content calendar keeps your posting steady. " }, { text: "Start small", b: true }, { text: "." }] },
    { type: "h2", runs: [{ text: "Pick themes" }] },
    { type: "ul", items: [[{ text: "Monday tips" }], [{ text: "Read the ", }, { text: "Help Center", href: "/help" }]] },
  ],
  tags: ["planning", "Planning", "content"],
  focusKeyword: "content calendar",
  ...over,
});

async function create(over: Record<string, unknown> = {}) {
  signInAs("staff", editor.token);
  const res = await call(createPost, { method: "POST", json: draft(over) });
  expect(res.status).toBe(201);
  return ((await res.json()) as { post: AdminPost }).post;
}

describe("permissions", () => {
  it("requires a signed-in staff member with Settings access", async () => {
    signInAs("customer", "nope");
    expect((await call(listGet)).status).toBe(401);
    signInAs("staff", support.token);
    expect((await call(listGet)).status).toBe(403);
    expect((await call(createPost, { method: "POST", json: draft() })).status).toBe(403);
    expect((await call(mediaPost, { method: "POST", json: { url: "https://example.com/a.png" } }, {}, "/api/admin/blog/media")).status).toBe(403);
  });

  it("refuses cross-site writes", async () => {
    signInAs("staff", editor.token);
    const res = await (createPost as Handler)(new Request(`${ORIGIN}/api/admin/blog/posts`, { method: "POST", body: JSON.stringify(draft()), headers: { "content-type": "application/json", origin: "https://evil.example" } }), {});
    expect(res.status).toBe(403);
  });
});

describe("posts", () => {
  it("creates a private draft with normalised fields and an audit entry", async () => {
    const p = await create();
    expect(p.state).toBe("draft");
    expect(p.tags).toEqual(["Planning", "content"]);
    expect(p.authorName).toBe("Sociotix Team");
    expect(p.url).toBe(`http://localhost:3000/blog/${p.slug}`);
    const [a] = await db.select().from(auditLog).where(eq(auditLog.targetId, p.id));
    expect(a.action).toBe("blog_post.create");
    expect(await resolvePublicSlug(db, p.slug)).toBeNull();
    expect(await findPublicArticle(p.slug, false)).toBeNull();
  });

  it("rejects unsafe content, invalid slugs and slugs already in use", async () => {
    signInAs("staff", editor.token);
    const bad = await call(createPost, { method: "POST", json: draft({ content: [{ type: "p", runs: [{ text: "x", href: "javascript:alert(1)" }] }] }) });
    expect(bad.status).toBe(400);
    const html = await call(createPost, { method: "POST", json: draft({ content: "<script>alert(1)</script>" }) });
    expect(html.status).toBe(400);
    expect((await call(createPost, { method: "POST", json: draft({ slug: "Not A Slug!" }) })).status).toBe(400);
    const taken = await call(createPost, { method: "POST", json: draft({ slug: "choose-the-right-social-media-service" }) });
    expect(taken.status).toBe(400);
    expect(((await taken.json()) as { error: { field: string } }).error.field).toBe("slug");
    const p = await create();
    const dup = await call(createPost, { method: "POST", json: draft({ slug: p.slug }) });
    expect(((await dup.json()) as { error: { field: string } }).error.field).toBe("slug");
    expect((await call(createPost, { method: "POST", json: { ...draft(), extra: "field" } })).status).toBe(400);
  });

  it("lists with search, filters, counts and pages", async () => {
    signInAs("staff", editor.token);
    const unique = `zebra-${Date.now().toString(36)}`;
    await create({ title: `Zebra growth ${unique}`, slug: unique, category: "growth" });
    const list = (await (await call(listGet, {}, {}, `/api/admin/blog/posts?q=${unique}`)).json()) as AdminPostList;
    expect(list.total).toBe(1);
    expect(list.items[0].category).toBe("growth");
    const none = (await (await call(listGet, {}, {}, `/api/admin/blog/posts?q=${unique}&category=tips`)).json()) as AdminPostList;
    expect(none.total).toBe(0);
    const paged = (await (await call(listGet, {}, {}, "/api/admin/blog/posts?pageSize=5&page=1")).json()) as AdminPostList;
    expect(paged.items.length).toBeLessThanOrEqual(5);
    expect(paged.counts.all).toBeGreaterThanOrEqual(paged.total);
  });

  it("refuses an edit based on an outdated version", async () => {
    const p = await create();
    const ok = await call(postPatch, { method: "PATCH", json: { ...draft({ slug: p.slug }), title: "Updated", version: p.version } }, idCtx(p.id));
    expect(ok.status).toBe(200);
    const stale = await call(postPatch, { method: "PATCH", json: { ...draft({ slug: p.slug }), title: "Lost update", version: p.version } }, idCtx(p.id));
    expect(stale.status).toBe(409);
    const now = ((await (await call(postGet, {}, idCtx(p.id))).json()) as { post: AdminPost }).post;
    expect(now.title).toBe("Updated");
  });

  it("publishes, shows on the public blog, and unpublishes", async () => {
    const p = await create({ title: "Live Post" });
    signInAs("staff", editor.token);
    const res = await call(actionPost, { method: "POST", json: { version: p.version } }, actCtx(p.id, "publish"));
    const live = ((await res.json()) as { post: AdminPost }).post;
    expect(live.state).toBe("published");
    expect(await resolvePublicSlug(db, p.slug)).toEqual({ kind: "live" });
    const article = await findPublicArticle(p.slug, false);
    expect(article?.status).toBe("published");
    expect(article?.rich?.[0]).toMatchObject({ type: "p" });
    expect((await allPublishedArticles()).some((a) => a.slug === p.slug)).toBe(true);

    const off = ((await (await call(actionPost, { method: "POST", json: { version: live.version } }, actCtx(p.id, "unpublish"))).json()) as { post: AdminPost }).post;
    expect(off.state).toBe("draft");
    expect(await findPublicArticle(p.slug, false)).toBeNull();
    // Republishing keeps the original publication date.
    const again = ((await (await call(actionPost, { method: "POST", json: { version: off.version } }, actCtx(p.id, "publish"))).json()) as { post: AdminPost }).post;
    expect(again.publishedAt).toBe(live.publishedAt);
  });

  it("won't publish an empty post or backdate one; schedules future posts without showing them", async () => {
    signInAs("staff", editor.token);
    const empty = await create({ content: [], excerpt: "" });
    expect((await call(actionPost, { method: "POST", json: { version: empty.version } }, actCtx(empty.id, "publish"))).status).toBe(400);

    const p = await create();
    const past = await call(actionPost, { method: "POST", json: { version: p.version, publishAt: "2020-01-01T00:00:00Z" } }, actCtx(p.id, "publish"));
    expect(past.status).toBe(400);
    const future = new Date(Date.now() + 3 * 86_400_000).toISOString();
    const s = ((await (await call(actionPost, { method: "POST", json: { version: p.version, publishAt: future } }, actCtx(p.id, "publish"))).json()) as { post: AdminPost }).post;
    expect(s.state).toBe("scheduled");
    expect(await resolvePublicSlug(db, p.slug)).toBeNull();
    // Time passes: the same row becomes live without another action.
    await db.update(blogPosts).set({ publishedAt: new Date(Date.now() - 1000) }).where(eq(blogPosts.id, p.id));
    expect(await resolvePublicSlug(db, p.slug)).toEqual({ kind: "live" });
  });

  it("keeps a renamed live post's old URL as a redirect", async () => {
    const p = await create();
    signInAs("staff", editor.token);
    const live = ((await (await call(actionPost, { method: "POST", json: { version: p.version } }, actCtx(p.id, "publish"))).json()) as { post: AdminPost }).post;
    const newSlug = `${p.slug}-renamed`;
    const renamed = ((await (await call(postPatch, { method: "PATCH", json: { ...draft({ slug: newSlug }), version: live.version } }, idCtx(p.id))).json()) as { post: AdminPost }).post;
    expect(renamed.previousSlugs).toEqual([p.slug]);
    expect(await resolvePublicSlug(db, p.slug)).toEqual({ kind: "redirect", slug: newSlug });

    const res = await proxy(new NextRequest(`${ORIGIN}/blog/${p.slug}`));
    expect(res.status).toBe(308);
    expect(res.headers.get("location")).toBe(`${ORIGIN}/blog/${newSlug}`);
    expect((await proxy(new NextRequest(`${ORIGIN}/blog/${newSlug}`))).headers.get("x-middleware-next")).toBe("1");
    expect((await proxy(new NextRequest(`${ORIGIN}/blog/never-existed-${Date.now()}`))).headers.get("x-middleware-rewrite")).toContain("/__not-found");
    // The blog index's social image is not an article slug.
    expect((await proxy(new NextRequest(`${ORIGIN}/blog/opengraph-image`))).headers.get("x-middleware-next")).toBe("1");
    expect((await proxy(new NextRequest(`${ORIGIN}/blog/opengraph-image/extra`))).headers.get("x-middleware-rewrite")).toContain("/__not-found");
    // Another post can't take the old address.
    const clash = await call(createPost, { method: "POST", json: draft({ slug: p.slug }) });
    expect(clash.status).toBe(400);
  });

  it("deletes a post with its redirects", async () => {
    const p = await create();
    signInAs("staff", editor.token);
    expect((await call(postDelete, { method: "DELETE", json: { version: p.version } }, idCtx(p.id))).status).toBe(200);
    expect((await call(postGet, {}, idCtx(p.id))).status).toBe(404);
    const [a] = await db.select().from(auditLog).where(eq(auditLog.action, "blog_post.delete"));
    expect(a.before).toMatchObject({ slug: p.slug });
  });
});

describe("images", () => {
  it("stores a validated upload once and serves it safely", async () => {
    signInAs("staff", editor.token);
    const form = () => {
      const f = new FormData();
      f.set("file", new File([new Uint8Array(MEDIA_PNG)], "cover.png", { type: "image/png" }));
      return f;
    };
    const res = await call(mediaPost, { method: "POST", body: form() }, {}, "/api/admin/blog/media");
    expect(res.status).toBe(201);
    const { image } = (await res.json()) as { image: { id: string; src: string; width: number; height: number; mime: string } };
    expect(image).toMatchObject({ width: 1200, height: 630, mime: "image/png" });
    const again = (await (await call(mediaPost, { method: "POST", body: form() }, {}, "/api/admin/blog/media")).json()) as { image: { id: string } };
    expect(again.image.id).toBe(image.id);

    const served = await mediaGet(new Request(`${ORIGIN}${image.src}`), { params: Promise.resolve({ id: image.id }) });
    expect(served.headers.get("content-type")).toBe("image/png");
    expect(served.headers.get("x-content-type-options")).toBe("nosniff");
    expect(served.headers.get("content-security-policy")).toContain("sandbox");
    expect(Buffer.from(await served.arrayBuffer()).equals(MEDIA_PNG)).toBe(true);

    // The post can use it as featured image and inline; publishing needs alt text.
    const p = await create({ featuredImageId: image.id, content: [{ type: "p", runs: [{ text: "Intro" }] }, { type: "img", src: image.src, alt: "", width: 1200, height: 630 }] });
    expect(p.featuredImage?.id).toBe(image.id);
    const noAlt = await call(actionPost, { method: "POST", json: { version: p.version } }, actCtx(p.id, "publish"));
    expect(((await noAlt.json()) as { error: { field: string } }).error.field).toBe("featuredImageAlt");
  });

  it("refuses non-images, disguised files and internal URLs", async () => {
    signInAs("staff", editor.token);
    const svg = new FormData();
    svg.set("file", new File([`<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`], "x.png", { type: "image/png" }));
    expect((await call(mediaPost, { method: "POST", body: svg }, {}, "/api/admin/blog/media")).status).toBe(400);
    for (const url of ["http://127.0.0.1:3000/favicon.ico", "http://localhost/a.png", "http://169.254.169.254/latest/meta-data/", "file:///etc/passwd"]) {
      const res = await call(mediaPost, { method: "POST", json: { url } }, {}, "/api/admin/blog/media");
      expect(res.status, url).toBe(400);
    }
    expect((await mediaGet(new Request(`${ORIGIN}/media/blog/x`), { params: Promise.resolve({ id: "not-a-uuid" }) })).status).toBe(404);
  });

  it("refuses posts that reference images that don't exist", async () => {
    signInAs("staff", editor.token);
    const res = await call(createPost, { method: "POST", json: draft({ featuredImageId: "0b7c3c6e-6d55-4f5e-9a51-1d1f3c7d9e10" }) });
    expect(res.status).toBe(400);
  });
});

describe("custom categories", () => {
  const CAT = "/api/admin/blog/categories";
  const keyCtx = (key: string) => ({ params: Promise.resolve({ key }) });

  it("lists the six built-in categories and adds custom ones", async () => {
    signInAs("staff", editor.token);
    const list = ((await (await call(categoriesGet, {}, {}, CAT)).json()) as { categories: AdminCategory[] }).categories;
    expect(list.filter((c) => c.builtIn).map((c) => c.id)).toEqual(["social-media", "ai-marketing", "growth", "automation", "guides", "tips"]);
    const res = await call(categoryPost, { method: "POST", json: { name: "Case Studies", description: "Real results" } }, {}, CAT);
    expect(res.status).toBe(201);
    const { category } = (await res.json()) as { category: AdminCategory };
    expect(category).toMatchObject({ id: "case-studies", name: "Case Studies", builtIn: false });
  });

  it("refuses duplicates, built-in names and reserved ids", async () => {
    signInAs("staff", editor.token);
    for (const name of ["case studies", "Growth Strategies", "Growth", "!!!"]) {
      const res = await call(categoryPost, { method: "POST", json: { name } }, {}, CAT);
      expect(res.status, name).toBe(400);
    }
  });

  it("lets posts use a custom category and shows its name publicly", async () => {
    const p = await create({ category: "case-studies", title: "A Case Study" });
    expect(p.categoryName).toBe("Case Studies");
    signInAs("staff", editor.token);
    expect((await call(createPost, { method: "POST", json: draft({ category: "not-a-category" }) })).status).toBe(400);
    const live = ((await (await call(actionPost, { method: "POST", json: { version: p.version } }, actCtx(p.id, "publish"))).json()) as { post: AdminPost }).post;
    const a = await findPublicArticle(live.slug, false);
    expect(a).toMatchObject({ category: "case-studies", categoryName: "Case Studies" });
    const rows = (await (await call(listGet, {}, {}, "/api/admin/blog/posts?category=case-studies")).json()) as AdminPostList;
    expect(rows.items.map((x) => x.categoryName)).toEqual(["Case Studies"]);
  });

  it("renames, refuses deleting a category in use, then deletes when unused", async () => {
    signInAs("staff", editor.token);
    const list = ((await (await call(categoriesGet, {}, {}, CAT)).json()) as { categories: AdminCategory[] }).categories;
    const cs = list.find((c) => c.id === "case-studies")!;
    expect(cs.postCount).toBe(1);
    const renamed = ((await (await call(categoryPatch, { method: "PATCH", json: { name: "Customer Stories" } }, keyCtx(cs.key!), CAT)).json()) as { category: AdminCategory }).category;
    expect(renamed).toMatchObject({ id: "case-studies", name: "Customer Stories" });
    expect((await call(categoryDelete, { method: "DELETE" }, keyCtx(cs.key!), CAT)).status).toBe(409);
    const extra = ((await (await call(categoryPost, { method: "POST", json: { name: "Temporary" } }, {}, CAT)).json()) as { category: AdminCategory }).category;
    expect((await call(categoryDelete, { method: "DELETE" }, keyCtx(extra.key!), CAT)).status).toBe(200);
    const [a] = await db.select().from(auditLog).where(eq(auditLog.action, "blog_category.delete"));
    expect(a.before).toMatchObject({ slug: "temporary" });
  });

  it("requires Settings access", async () => {
    signInAs("staff", support.token);
    expect((await call(categoriesGet, {}, {}, CAT)).status).toBe(403);
    expect((await call(categoryPost, { method: "POST", json: { name: "Nope" } }, {}, CAT)).status).toBe(403);
  });
});
