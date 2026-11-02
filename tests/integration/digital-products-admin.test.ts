import { and, eq } from "drizzle-orm";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, inject, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST as mediaPost } from "@/app/api/admin/blog/media/route";
import { POST as actionPost } from "@/app/api/admin/digital-products/[id]/[action]/route";
import { DELETE as fileDelete, PATCH as filePatch } from "@/app/api/admin/digital-products/[id]/files/[fileId]/route";
import { POST as filePost } from "@/app/api/admin/digital-products/[id]/files/route";
import { DELETE as productDelete, GET as productGet, PATCH as productPatch } from "@/app/api/admin/digital-products/[id]/route";
import { DELETE as categoryDelete, PATCH as categoryPatch } from "@/app/api/admin/digital-products/categories/[key]/route";
import { GET as categoriesGet, POST as categoryPost } from "@/app/api/admin/digital-products/categories/route";
import { GET as listGet, POST as createPost } from "@/app/api/admin/digital-products/route";
import { GET as downloadFile } from "@/app/api/digital-products/[slug]/files/[fileId]/route";
import { GET as followLink } from "@/app/api/digital-products/[slug]/links/[linkId]/route";
import sitemap from "@/app/sitemap";
import { proxy } from "@/proxy";
import type { AdminCategory } from "@/lib/blog/admin";
import { PREVIEW_PRODUCTS } from "@/lib/digital-products";
import type { AdminProduct, AdminProductList } from "@/lib/digital-products/admin";
import { createDb, type Db } from "@/server/db/client";
import { auditLog, digitalProductFiles } from "@/server/db/schema";
import { getMarketplace, liveDigitalProduct } from "@/server/digital-products/public";
import { resetEnvCache } from "@/server/env";
import { runMigrations } from "../../scripts/db/migrate";
import { seedReferenceData } from "../../scripts/db/seed";
import { makeCustomer, makeStaff, signInAs } from "./auth-helpers";

vi.mock("next/headers", async () => (await import("./auth-helpers")).jarMock());

/* Admin → Digital Products against a scratch database: permissions, CRUD, publishing, files, links, downloads, public visibility. */
const scratch = `socivanta_dp_test_${Date.now()}`;
let db: Db;
let admin: Client;
let editor: Awaited<ReturnType<typeof makeStaff>>;
let support: Awaited<ReturnType<typeof makeStaff>>;
let customer: Awaited<ReturnType<typeof makeCustomer>>;
let unverified: Awaited<ReturnType<typeof makeCustomer>>;

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
  customer = await makeCustomer(db);
  unverified = await makeCustomer(db, { verified: false });
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
const call = (fn: unknown, init: RequestInit & { json?: unknown } = {}, ctx: unknown = {}, url = "/api/admin/digital-products") =>
  (fn as Handler)(new Request(ORIGIN + url, { ...init, ...(init.json !== undefined ? { body: JSON.stringify(init.json) } : {}), headers: { ...(init.json !== undefined ? { "content-type": "application/json" } : {}), origin: ORIGIN, ...(init.headers ?? {}) } }), ctx);
const idCtx = (id: string) => ({ params: Promise.resolve({ id }) });
const actCtx = (id: string, action: string) => ({ params: Promise.resolve({ id, action }) });
const fileCtx = (id: string, fileId: string) => ({ params: Promise.resolve({ id, fileId }) });
const get = (fn: unknown, url: string, params: Record<string, string>) => (fn as Handler)(new Request(ORIGIN + url), { params: Promise.resolve(params) });

const ZIP = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from("zip-contents-for-test", "latin1"), Buffer.alloc(32)]);
const PNG = (() => {
  const b = Buffer.alloc(40);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8);
  b.write("IHDR", 12, "latin1");
  b.writeUInt32BE(1600, 16);
  b.writeUInt32BE(1000, 20);
  b.write("dp-png-bytes", 24, "latin1");
  return b;
})();

let seq = 0;
const draft = (over: Record<string, unknown> = {}) => ({
  title: "Carousel Template Pack",
  slug: `carousel-pack-${Date.now().toString(36)}-${++seq}`,
  shortDescription: "Editable carousel layouts for explaining one idea per swipe.",
  category: "social-templates",
  productType: "Template",
  content: [{ type: "p", runs: [{ text: "Twenty carousel layouts. " }, { text: "Edit in Canva", b: true }, { text: "." }] }],
  includes: ["20 carousel layouts", "Light and dark colourways"],
  tags: ["carousel", "Carousel", "canva"],
  pricing: "free",
  availability: "available",
  downloadLinks: [{ url: "https://drive.google.com/drive/folders/abc123", label: "Open in Drive", title: "Template folder", instructions: "Make a copy first." }],
  ...over,
});

async function create(over: Record<string, unknown> = {}) {
  signInAs("staff", editor.token);
  const res = await call(createPost, { method: "POST", json: draft(over) });
  expect(res.status, JSON.stringify(await res.clone().json())).toBe(201);
  return ((await res.json()) as { product: AdminProduct }).product;
}
async function act(p: { id: string; version: number }, action: string) {
  signInAs("staff", editor.token);
  const res = await call(actionPost, { method: "POST", json: { version: p.version } }, actCtx(p.id, action));
  return { res, product: res.ok ? ((await res.json()) as { product: AdminProduct }).product : null };
}
async function upload(productId: string, bytes: Buffer, name: string, version = "", as = editor) {
  signInAs("staff", as.token);
  const form = new FormData();
  form.set("file", new File([new Uint8Array(bytes)], name));
  form.set("version", version);
  return call(filePost, { method: "POST", body: form }, idCtx(productId), `/api/admin/digital-products/${productId}/files`);
}
const fieldOf = async (res: Response) => ((await res.json()) as { error: { field?: string; issues?: { path: string }[] } }).error;

describe("permissions", () => {
  it("requires a signed-in staff member with Settings access", async () => {
    signInAs("customer", customer.token);
    expect((await call(listGet)).status).toBe(401);
    signInAs("staff", support.token);
    expect((await call(listGet)).status).toBe(403);
    expect((await call(createPost, { method: "POST", json: draft() })).status).toBe(403);
    expect((await call(categoriesGet)).status).toBe(403);
  });

  it("refuses cross-site writes", async () => {
    signInAs("staff", editor.token);
    const res = await (createPost as Handler)(new Request(`${ORIGIN}/api/admin/digital-products`, { method: "POST", body: JSON.stringify(draft()), headers: { "content-type": "application/json", origin: "https://evil.example" } }), {});
    expect(res.status).toBe(403);
  });
});

describe("products", () => {
  it("creates a private draft with normalised fields and an audit entry", async () => {
    const p = await create();
    expect(p.status).toBe("draft");
    expect(p.tags).toEqual(["Carousel", "canva"]);
    expect(p.downloadLinks[0]).toMatchObject({ label: "Open in Drive", url: "https://drive.google.com/drive/folders/abc123" });
    expect(p.downloadLinks[0].id).toMatch(/^[a-z0-9-]{6,40}$/);
    const [entry] = await db.select().from(auditLog).where(and(eq(auditLog.action, "digital_product.create"), eq(auditLog.targetId, p.id)));
    expect(entry.actorUserId).toBe(editor.user.id);
    expect(await liveDigitalProduct(p.slug)).toBeNull();
  });

  it("validates on the server: slugs, links, prices, categories and unsafe content", async () => {
    signInAs("staff", editor.token);
    const bad = async (over: Record<string, unknown>) => call(createPost, { method: "POST", json: draft(over) });
    expect((await bad({ slug: "Bad Slug!" })).status).toBe(400);
    for (const url of ["http://example.com/file.zip", "https://localhost/x", "https://127.0.0.1/x", "https://user:pw@example.com/x", "javascript:alert(1)"]) expect((await bad({ downloadLinks: [{ url, label: "x", title: "", instructions: "" }] })).status, url).toBe(400);
    expect((await fieldOf(await bad({ pricing: "paid", priceCents: null }))).issues?.[0].path).toBe("priceCents");
    expect((await fieldOf(await bad({ category: "no-such-category" }))).field).toBe("category");
    expect((await bad({ content: [{ type: "p", runs: [{ text: "x", href: "javascript:alert(1)" }] }] })).status).toBe(400);
    expect((await bad({ unexpected: true })).status).toBe(400);
    const p = await create();
    const dup = await call(createPost, { method: "POST", json: draft({ slug: p.slug }) });
    expect((await fieldOf(dup)).field).toBe("slug");
    expect((await fieldOf(await bad({ slug: "opengraph-image" }))).field).toBe("slug");
  });

  it("lists with search, filters, sorting, counts and metrics", async () => {
    const tagged = await create({ title: "Zebra Planner Unique", category: "planners", productType: "Planner", pricing: "paid", priceCents: 1900, downloadLinks: [] });
    signInAs("staff", editor.token);
    const list = async (q: string) => (await (await call(listGet, {}, {}, `/api/admin/digital-products?${q}`)).json()) as AdminProductList;
    const found = await list("q=zebra%20planner");
    expect(found.items.map((x) => x.id)).toEqual([tagged.id]);
    expect(found.items[0]).toMatchObject({ categoryName: "Content Calendars & Planners", pricing: "paid", priceCents: 1900, linkCount: 0, fileCount: 0 });
    expect((await list("category=planners")).items.every((x) => x.category === "planners")).toBe(true);
    expect((await list("status=published")).items).toHaveLength(0);
    const all = await list("pageSize=5&sort=title");
    expect(all.items.map((x) => x.title)).toEqual([...all.items.map((x) => x.title)].sort((a, b) => a.localeCompare(b)));
    expect(all.counts.all).toBeGreaterThanOrEqual(3);
    expect(all.metrics.paid).toBeGreaterThanOrEqual(1);
    expect(all.metrics.withDownloads).toBeGreaterThanOrEqual(1);
  });

  it("refuses an edit based on an outdated version", async () => {
    const p = await create();
    signInAs("staff", editor.token);
    const ok = await call(productPatch, { method: "PATCH", json: { ...draft({ slug: p.slug, title: "Renamed" }), version: p.version } }, idCtx(p.id));
    expect(ok.status).toBe(200);
    const stale = await call(productPatch, { method: "PATCH", json: { ...draft({ slug: p.slug }), version: p.version } }, idCtx(p.id));
    expect(stale.status).toBe(409);
  });

  it("publishes (never enabling purchases), appears publicly and in the sitemap, then unpublishes and archives", async () => {
    expect((await getMarketplace()).preview).toBe(true);
    const p = await create({ title: "Published Pack" });
    const { product: live } = await act(p, "publish");
    expect(live!.status).toBe("published");
    expect(live!.publishedAt).toBeTruthy();
    const pub = (await liveDigitalProduct(p.slug))!;
    expect(pub).toMatchObject({ title: "Published Pack", source: "admin", availability: "available", price: { kind: "free" } });
    // Public data never carries a link's URL.
    expect(JSON.stringify(pub)).not.toContain("drive.google.com/drive/folders");
    expect(pub.downloads!.links[0]).toMatchObject({ label: "Open in Drive", provider: "Google Drive" });
    const market = await getMarketplace();
    expect(market.preview).toBe(false);
    expect(market.products.some((x) => x.id === PREVIEW_PRODUCTS[0].id)).toBe(false);
    expect((await sitemap()).map((e) => e.url)).toEqual(expect.arrayContaining([expect.stringMatching(/\/digital-products$/), expect.stringContaining(`/digital-products/${p.slug}`)]));
    // The proxy lets the product through and 404s concepts now that real products exist.
    expect((await proxy(new NextRequest(`${ORIGIN}/digital-products/${p.slug}`))).headers.get("x-middleware-next")).toBe("1");
    expect((await proxy(new NextRequest(`${ORIGIN}/digital-products/${PREVIEW_PRODUCTS[0].id}`))).headers.get("x-middleware-rewrite")).toContain("/__not-found");
    const [audited] = await db.select().from(auditLog).where(and(eq(auditLog.action, "digital_product.publish"), eq(auditLog.targetId, p.id)));
    expect(audited).toBeTruthy();

    const { product: draftAgain } = await act(live!, "unpublish");
    expect(draftAgain!.status).toBe("draft");
    expect(await liveDigitalProduct(p.slug)).toBeNull();
    const { product: archived } = await act(draftAgain!, "archive");
    expect(archived!.status).toBe("archived");
    expect(await liveDigitalProduct(p.slug)).toBeNull();
    expect((await proxy(new NextRequest(`${ORIGIN}/digital-products/${p.slug}`))).headers.get("x-middleware-rewrite")).toContain("/__not-found");
  });

  it("won't publish an incomplete product", async () => {
    const p = await create({ shortDescription: "", content: [], includes: [] });
    const { res } = await act(p, "publish");
    expect((await fieldOf(res)).field).toBe("shortDescription");
  });

  it("duplicates as a private draft with its files, and deletes with its files", async () => {
    const p = await create();
    expect((await upload(p.id, ZIP, "pack.zip")).status).toBe(201);
    const { res, product: copy } = await act(p, "duplicate");
    expect(res.status).toBe(201);
    expect(copy).toMatchObject({ status: "draft", title: `${p.title} (copy)`, slug: `${p.slug}-copy` });
    expect(copy!.files).toHaveLength(1);
    expect(copy!.downloadLinks[0].id).not.toBe(p.downloadLinks[0].id);
    signInAs("staff", editor.token);
    const fresh = ((await (await call(productGet, {}, idCtx(copy!.id))).json()) as { product: AdminProduct }).product;
    expect((await call(productDelete, { method: "DELETE", json: { version: fresh.version } }, idCtx(copy!.id))).status).toBe(200);
    expect(await db.select().from(digitalProductFiles).where(eq(digitalProductFiles.productId, copy!.id))).toHaveLength(0);
    expect((await call(productGet, {}, idCtx(copy!.id))).status).toBe(404);
  });
});

describe("images", () => {
  it("uses validated images for the featured image and gallery, and needs alt text to publish", async () => {
    signInAs("staff", editor.token);
    const form = new FormData();
    form.set("file", new File([new Uint8Array(PNG)], "cover.png", { type: "image/png" }));
    const { image } = (await (await call(mediaPost, { method: "POST", body: form }, {}, "/api/admin/blog/media")).json()) as { image: { id: string; src: string } };
    const p = await create({ featuredImageId: image.id, featuredImageAlt: "", gallery: [{ mediaId: image.id, alt: "Slide preview" }] });
    expect(p.featuredImage).toMatchObject({ mediaId: image.id, width: 1600, height: 1000 });
    expect(p.galleryImages).toHaveLength(1);
    expect((await fieldOf((await act(p, "publish")).res)).field).toBe("featuredImageAlt");
    const missing = await call(createPost, { method: "POST", json: draft({ featuredImageId: "00000000-0000-4000-8000-000000000000" }) });
    expect((await fieldOf(missing)).field).toBe("image");
  });
});

describe("files and downloads", () => {
  it("accepts real files by their bytes and refuses disguised or oversized ones", async () => {
    const p = await create();
    const ok = await upload(p.id, ZIP, "../../etc/My Pack.zip", "1.0");
    expect(ok.status).toBe(201);
    const { file, productVersion } = (await ok.json()) as { file: { id: string; filename: string; mime: string; version: string }; productVersion: number };
    expect(file).toMatchObject({ filename: "My Pack.zip", mime: "application/zip", version: "1.0" });
    expect(productVersion).toBe(p.version + 1);
    expect((await upload(p.id, Buffer.from("<html><script>alert(1)</script></html>"), "evil.zip")).status).toBe(400);
    expect((await upload(p.id, Buffer.from("MZ\x90\x00 fake exe"), "setup.pdf")).status).toBe(400);
    expect((await upload(p.id, Buffer.alloc(8 * 1024 * 1024 + 1, 0x41), "big.pdf")).status).toBe(400);
    signInAs("staff", editor.token);
    const renamed = await call(filePatch, { method: "PATCH", json: { version: "1.1" } }, fileCtx(p.id, file.id), `/api/admin/digital-products/${p.id}/files/${file.id}`);
    expect(((await renamed.json()) as { file: { version: string } }).file.version).toBe("1.1");
    expect((await upload(p.id, ZIP, "x.zip", "", support)).status).toBe(403);
  });

  it("releases files and links only to signed-in customers, for published, released, free products", async () => {
    const p = await create();
    const { file } = (await (await upload(p.id, ZIP, "pack.zip")).json()) as { file: { id: string } };
    const fresh = ((await (await call(productGet, {}, idCtx(p.id))).json()) as { product: AdminProduct }).product;
    const link = fresh.downloadLinks[0].id;
    const dl = () => get(downloadFile, `/api/digital-products/${p.slug}/files/${file.id}`, { slug: p.slug, fileId: file.id });
    const go = () => get(followLink, `/api/digital-products/${p.slug}/links/${link}`, { slug: p.slug, linkId: link });

    // A draft doesn't exist publicly, even for signed-in customers; staff can check their uploads.
    signInAs("customer", customer.token);
    expect((await dl()).status).toBe(404);
    expect((await go()).status).toBe(404);
    signInAs("staff", editor.token);
    const staffDl = await dl();
    expect(staffDl.status).toBe(200);
    expect(Buffer.from(await staffDl.arrayBuffer()).equals(ZIP)).toBe(true);

    const { product: live } = await act(fresh, "publish");
    // Signed out: sent to sign in, then back to the product page.
    signInAs("customer", "not-a-session");
    const anon = await dl();
    expect(anon.status).toBe(303);
    expect(anon.headers.get("location")).toBe(`/login?next=${encodeURIComponent(`/digital-products/${p.slug}`)}`);
    expect((await go()).headers.get("location")).toContain("/login?next=");
    signInAs("customer", unverified.token);
    expect((await dl()).status).toBe(403);

    signInAs("customer", customer.token);
    const ok = await dl();
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-disposition")).toMatch(/^attachment; filename="pack\.zip"/);
    expect(ok.headers.get("cache-control")).toContain("no-store");
    expect(ok.headers.get("x-content-type-options")).toBe("nosniff");
    const redirect = await go();
    expect(redirect.status).toBe(302);
    expect(redirect.headers.get("location")).toBe("https://drive.google.com/drive/folders/abc123");
    expect(redirect.headers.get("referrer-policy")).toBe("no-referrer");
    expect((await get(followLink, "/x", { slug: p.slug, linkId: "nope-nope" })).status).toBe(404);
    expect(await db.select().from(auditLog).where(and(eq(auditLog.action, "digital_product.download"), eq(auditLog.targetId, p.id)))).toHaveLength(2);

    // Paid: purchasing isn't open, so nothing is released and no purchase is assumed.
    signInAs("staff", editor.token);
    const paid = ((await (await call(productPatch, { method: "PATCH", json: { ...draft({ slug: p.slug, pricing: "paid", priceCents: 1500, downloadLinks: live!.downloadLinks }), version: live!.version } }, idCtx(p.id))).json()) as { product: AdminProduct }).product;
    signInAs("customer", customer.token);
    expect((await dl()).status).toBe(403);
    expect((await go()).status).toBe(403);
    signInAs("customer", "not-a-session");
    expect((await dl()).status).toBe(403);

    // Free but not released yet: nothing either.
    signInAs("staff", editor.token);
    await call(productPatch, { method: "PATCH", json: { ...draft({ slug: p.slug, availability: "coming_soon", downloadLinks: paid.downloadLinks }), version: paid.version } }, idCtx(p.id));
    signInAs("customer", customer.token);
    expect((await dl()).status).toBe(403);

    // Removing a file makes it unavailable.
    signInAs("staff", editor.token);
    expect((await call(fileDelete, { method: "DELETE" }, fileCtx(p.id, file.id), `/api/admin/digital-products/${p.id}/files/${file.id}`)).status).toBe(200);
    expect((await dl()).status).toBe(404);
  });
});

describe("custom categories", () => {
  it("lists the eight built-in categories, adds, uses, renames and deletes custom ones", async () => {
    signInAs("staff", editor.token);
    const list = async () => ((await (await call(categoriesGet, {}, {}, "/api/admin/digital-products/categories")).json()) as { categories: AdminCategory[] }).categories;
    expect((await list()).filter((c) => c.builtIn)).toHaveLength(8);
    const res = await call(categoryPost, { method: "POST", json: { name: "Notion Templates", description: "Workspaces" } }, {}, "/api/admin/digital-products/categories");
    expect(res.status).toBe(201);
    const { category } = (await res.json()) as { category: AdminCategory };
    expect(category.id).toBe("notion-templates");
    expect((await call(categoryPost, { method: "POST", json: { name: "notion templates" } }, {}, "/api/admin/digital-products/categories")).status).toBe(400);
    expect((await call(categoryPost, { method: "POST", json: { name: "Branding & Design Assets" } }, {}, "/api/admin/digital-products/categories")).status).toBe(400);

    const p = await create({ category: "notion-templates" });
    expect(p.categoryName).toBe("Notion Templates");
    await act(p, "publish");
    expect((await liveDigitalProduct(p.slug))!.categoryName).toBe("Notion Templates");

    signInAs("staff", editor.token);
    const ctx = { params: Promise.resolve({ key: category.key! }) };
    expect((await call(categoryPatch, { method: "PATCH", json: { name: "Notion Workspaces" } }, ctx, "/x")).status).toBe(200);
    expect((await liveDigitalProduct(p.slug))!.categoryName).toBe("Notion Workspaces");
    expect((await call(categoryDelete, { method: "DELETE" }, ctx, "/x")).status).toBe(409);
    const fresh = ((await (await call(productGet, {}, idCtx(p.id))).json()) as { product: AdminProduct }).product;
    await call(productDelete, { method: "DELETE", json: { version: fresh.version } }, idCtx(p.id));
    expect((await call(categoryDelete, { method: "DELETE" }, ctx, "/x")).status).toBe(200);
    expect((await list()).some((c) => c.id === "notion-templates")).toBe(false);
  });
});
