import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, inject, it, vi } from "vitest";
import { POST as actionPost } from "@/app/api/admin/digital-products/[id]/[action]/route";
import { POST as filePost } from "@/app/api/admin/digital-products/[id]/files/route";
import { DELETE as productDelete, GET as productGet } from "@/app/api/admin/digital-products/[id]/route";
import { POST as createPost } from "@/app/api/admin/digital-products/route";
import { GET as downloadFile } from "@/app/api/digital-products/[slug]/files/[fileId]/route";
import { GET as followLink } from "@/app/api/digital-products/[slug]/links/[linkId]/route";
import type { AdminProduct } from "@/lib/digital-products/admin";
import { createDb, type Db } from "@/server/db/client";
import { customerLibrary, customerLibraryItem } from "@/server/digital-products/library";
import { resetEnvCache } from "@/server/env";
import { runMigrations } from "../../scripts/db/migrate";
import { seedReferenceData } from "../../scripts/db/seed";
import { makeCustomer, makeStaff, signInAs } from "./auth-helpers";

vi.mock("next/headers", async () => (await import("./auth-helpers")).jarMock());

/* DP-04: the customer's Digital Library and download history, against a scratch database. */
const scratch = `socivanta_lib_test_${Date.now()}`;
let db: Db;
let admin: Client;
let editor: Awaited<ReturnType<typeof makeStaff>>;
let alice: Awaited<ReturnType<typeof makeCustomer>>;
let bob: Awaited<ReturnType<typeof makeCustomer>>;

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
  alice = await makeCustomer(db);
  bob = await makeCustomer(db);
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
const call = (fn: unknown, init: RequestInit & { json?: unknown } = {}, ctx: unknown = {}) =>
  (fn as Handler)(new Request(`${ORIGIN}/api/admin/digital-products`, { ...init, ...(init.json !== undefined ? { body: JSON.stringify(init.json) } : {}), headers: { ...(init.json !== undefined ? { "content-type": "application/json" } : {}), origin: ORIGIN } }), ctx);
const idCtx = (id: string) => ({ params: Promise.resolve({ id }) });
const ZIP = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from("library-zip"), Buffer.alloc(16)]);
let seq = 0;

async function product(over: Record<string, unknown> = {}, publish = true) {
  signInAs("staff", editor.token);
  const res = await call(createPost, { method: "POST", json: { title: `Library Pack ${++seq}`, slug: `library-pack-${Date.now().toString(36)}-${seq}`, shortDescription: "A free pack for the library.", category: "planners", productType: "Planner", includes: ["One planner"], pricing: "free", availability: "available", downloadLinks: [{ url: "https://drive.google.com/file/d/abc", label: "Open in Drive", title: "", instructions: "" }], ...over } });
  const body = (await res.json()) as { product: AdminProduct };
  if (!body.product) throw new Error(JSON.stringify(body));
  let p = body.product;
  const form = new FormData();
  form.set("file", new File([new Uint8Array(ZIP)], "planner.zip"));
  form.set("version", "1.0");
  await call(filePost, { method: "POST", body: form }, idCtx(p.id));
  p = await fresh(p.id);
  if (publish) p = ((await (await call(actionPost, { method: "POST", json: { version: p.version } }, { params: Promise.resolve({ id: p.id, action: "publish" }) })).json()) as { product: AdminProduct }).product;
  return p;
}
const fresh = async (id: string) => {
  signInAs("staff", editor.token);
  return ((await (await call(productGet, {}, idCtx(id))).json()) as { product: AdminProduct }).product;
};
const act = async (p: AdminProduct, action: string) => {
  signInAs("staff", editor.token);
  return ((await (await call(actionPost, { method: "POST", json: { version: p.version } }, { params: Promise.resolve({ id: p.id, action }) })).json()) as { product: AdminProduct }).product;
};
const download = (who: { token: string }, p: AdminProduct) => {
  signInAs("customer", who.token);
  return (downloadFile as Handler)(new Request(`${ORIGIN}/x`), { params: Promise.resolve({ slug: p.slug, fileId: p.files[0].id }) });
};

describe("library contents", () => {
  it("starts empty and never lists drafts, unreleased or paid products", async () => {
    expect((await customerLibrary(db, alice.user.id)).items).toEqual([]);
    await product({}, false);
    await product({ availability: "coming_soon" });
    await product({ pricing: "paid", priceCents: 900 });
    const lib = await customerLibrary(db, alice.user.id);
    expect(lib.items).toEqual([]);
    expect(lib.history).toEqual([]);
    expect(lib.summary).toEqual({ products: 0, files: 0, links: 0 });
  });

  it("lists published, released, free products with downloads metadata but no link URLs", async () => {
    const p = await product();
    const lib = await customerLibrary(db, alice.user.id);
    expect(lib.items.map((i) => i.product.id)).toEqual([p.slug]);
    expect(lib.summary).toEqual({ products: 1, files: 1, links: 1 });
    expect(lib.items[0].product.downloads!.files[0]).toMatchObject({ name: "planner.zip", type: "ZIP", version: "1.0" });
    expect(JSON.stringify(lib)).not.toContain("drive.google.com/file");
    expect(lib.items[0]).toMatchObject({ lastDownloadedAt: null, hasUpdate: false });
    expect(await customerLibraryItem(db, alice.user.id, p.slug)).not.toBeNull();
    expect(await customerLibraryItem(db, alice.user.id, "does-not-exist")).toBeNull();
  });
});

describe("downloads and history", () => {
  it("records each customer's own downloads with file details, and flags updates", async () => {
    const p = await product();
    expect((await download(alice, p)).status).toBe(200);
    signInAs("customer", alice.token);
    expect((await (followLink as Handler)(new Request(`${ORIGIN}/x`), { params: Promise.resolve({ slug: p.slug, linkId: p.downloadLinks[0].id }) })).status).toBe(302);
    const lib = await customerLibrary(db, alice.user.id);
    const mine = lib.history.filter((h) => h.productSlug === p.slug);
    expect(mine.map((h) => h.kind)).toEqual(["link", "file"]);
    expect(mine[1]).toMatchObject({ name: "planner.zip", version: "1.0", productTitle: p.title, href: `/api/digital-products/${p.slug}/files/${p.files[0].id}` });
    expect(mine[0]).toMatchObject({ name: "Open in Drive", href: `/api/digital-products/${p.slug}/links/${p.downloadLinks[0].id}` });
    expect(lib.items.find((i) => i.product.id === p.slug)).toMatchObject({ hasUpdate: false });
    expect((await customerLibrary(db, bob.user.id)).history).toEqual([]);

    // A new file afterwards is an update.
    await new Promise((r) => setTimeout(r, 20));
    signInAs("staff", editor.token);
    const form = new FormData();
    form.set("file", new File([new Uint8Array(ZIP)], "planner-v2.zip"));
    await call(filePost, { method: "POST", body: form }, idCtx(p.id));
    expect((await customerLibraryItem(db, alice.user.id, p.slug))!.hasUpdate).toBe(true);
  });

  it("refuses paid products and keeps history honest when products are unpublished or deleted", async () => {
    const p = await product();
    expect((await download(alice, p)).status).toBe(200);

    const draft = await act(await fresh(p.id), "unpublish");
    let rec = (await customerLibrary(db, alice.user.id)).history.find((h) => h.productTitle === p.title)!;
    expect(rec).toMatchObject({ href: null, unavailable: "no_access", productSlug: null });
    expect((await customerLibrary(db, alice.user.id)).items.some((i) => i.product.id === p.slug)).toBe(false);
    expect((await download(alice, draft)).status).toBe(404);

    signInAs("staff", editor.token);
    const latest = await fresh(p.id);
    await call(productDelete, { method: "DELETE", json: { version: latest.version } }, idCtx(p.id));
    rec = (await customerLibrary(db, alice.user.id)).history.find((h) => h.productTitle === p.title)!;
    expect(rec).toMatchObject({ name: "planner.zip", version: "1.0", href: null, unavailable: "removed" });

    const paid = await product({ pricing: "paid", priceCents: 1200 });
    expect((await download(alice, paid)).status).toBe(403);
    expect((await customerLibrary(db, alice.user.id)).items.some((i) => i.product.id === paid.slug)).toBe(false);
  });
});

describe("download rate limit", () => {
  it("lets a customer download generously but stops a flood (429)", async () => {
    const { downloadThrottle } = await import("@/server/digital-products/downloads");
    const carol = await makeCustomer(db);
    for (let i = 0; i < 120; i++) expect(await downloadThrottle(db, carol.user.id)).toBeNull();
    const refused = await downloadThrottle(db, carol.user.id);
    expect(refused?.status).toBe(429);
    expect(refused?.headers.get("retry-after")).toBeTruthy();
    expect(await downloadThrottle(db, alice.user.id)).toBeNull();
  });
});
