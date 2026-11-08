import { eq } from "drizzle-orm";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, inject, it, vi } from "vitest";
import { changePassword } from "@/server/auth/accounts";
import { validateSession } from "@/server/auth/sessions";
import { createDb, type Db } from "@/server/db/client";
import { notifications } from "@/server/db/schema";
import { resetEnvCache } from "@/server/env";
import { listNotifications, markRead, notifyUser } from "@/server/support/notifications";
import { runMigrations } from "../../scripts/db/migrate";
import { seedReferenceData } from "../../scripts/db/seed";
import { makeCustomer, makeStaff, PASSWORD, setRequestHeaders, signInAs } from "./auth-helpers";

vi.mock("next/headers", async () => (await import("./auth-helpers")).jarMock());

/* NT-01 Notification Center: listing, filters, paging, read state, isolation, de-duplication and the route, against a scratch database. */
const scratch = `socivanta_notifications_test_${Date.now()}`;
let db: Db;
let admin: Client;

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
}, 120_000);
afterAll(async () => {
  await db.$client.end();
  process.env.DATABASE_URL = inject("databaseUrl");
  resetEnvCache();
  await admin.query(`drop database if exists ${scratch} with (force)`);
  await admin.end();
});

/** Real rows through the same helper the event hooks use, spaced a second apart so ordering is clear. */
async function seed(userId: string, n: number, kind: "order" | "support" | "security" = "order", from = Date.now()) {
  for (let i = 0; i < n; i++) {
    await notifyUser(db, { userId, kind, title: `${kind} update ${i}`, body: i % 2 ? "Profile link checked" : "Queued", link: "/dashboard/orders", dedupeKey: `test:${kind}:${from}:${i}` });
    await db.update(notifications).set({ createdAt: new Date(from - (n - i) * 1000) }).where(eq(notifications.dedupeKey, `test:${kind}:${from}:${i}`));
  }
}

describe("listing", () => {
  it("pages newest first without gaps or repeats, filters by category, status and search, and counts unread across everything", async () => {
    const c = await makeCustomer(db);
    await seed(c.user.id, 25, "order");
    await seed(c.user.id, 3, "support");
    const first = await listNotifications(db, c.user.id);
    expect(first.items).toHaveLength(20);
    expect(first.unread).toBe(28);
    const second = await listNotifications(db, c.user.id, { before: first.next! });
    expect(second.items).toHaveLength(8);
    expect(second.next).toBeNull();
    const all = [...first.items, ...second.items];
    expect(new Set(all.map((n) => n.id)).size).toBe(28);
    expect(all.map((n) => n.at)).toEqual([...all.map((n) => n.at)].sort().reverse());
    expect((await listNotifications(db, c.user.id, { kind: "support" })).items).toHaveLength(3);
    expect((await listNotifications(db, c.user.id, { q: "profile LINK" })).items.every((n) => n.body === "Profile link checked")).toBe(true);
    expect((await listNotifications(db, c.user.id, { q: "100%_" })).items).toHaveLength(0);
    await markRead(db, c.user.id, { ids: first.items.slice(0, 5).map((n) => n.id) });
    const unread = await listNotifications(db, c.user.id, { status: "unread", limit: 50 });
    expect(unread.items).toHaveLength(23);
    expect(unread.unread).toBe(23);
  });

  it("rejects bad filters and cursors", async () => {
    const c = await makeCustomer(db);
    await expect(listNotifications(db, c.user.id, { kind: "payments" as never })).rejects.toThrow();
    await expect(listNotifications(db, c.user.id, { before: "yesterday" })).rejects.toThrow();
    await expect(listNotifications(db, c.user.id, { limit: 500 })).rejects.toThrow();
  });
});

describe("read state and isolation", () => {
  it("read, unread again and mark all — only ever the caller's own", async () => {
    const a = await makeCustomer(db);
    const b = await makeCustomer(db);
    await seed(a.user.id, 2, "support");
    await seed(b.user.id, 2, "support");
    const [x, y] = (await listNotifications(db, a.user.id)).items;
    const bIds = (await listNotifications(db, b.user.id)).items.map((n) => n.id);
    await markRead(db, a.user.id, { ids: [x.id, ...bIds] });
    expect((await listNotifications(db, a.user.id)).unread).toBe(1);
    expect((await listNotifications(db, b.user.id)).unread).toBe(2);
    await markRead(db, a.user.id, { ids: [x.id], read: false });
    expect((await listNotifications(db, a.user.id)).items.find((n) => n.id === x.id)?.read).toBe(false);
    await markRead(db, b.user.id, { ids: [x.id, y.id], read: true });
    expect((await listNotifications(db, a.user.id)).unread).toBe(2);
    await markRead(db, a.user.id, { all: true });
    expect((await listNotifications(db, a.user.id)).unread).toBe(0);
    expect((await listNotifications(db, b.user.id)).unread).toBe(2);
    await expect(markRead(db, a.user.id, { ids: ["not-a-uuid"] })).rejects.toThrow();
  });

  it("one event notifies once; unknown categories and outside links are refused by the database", async () => {
    const c = await makeCustomer(db);
    const n = { userId: c.user.id, kind: "order" as const, title: "Order accepted", link: "/dashboard/orders", dedupeKey: "order-event:same" };
    await notifyUser(db, n);
    await notifyUser(db, n);
    expect((await listNotifications(db, c.user.id)).items).toHaveLength(1);
    await expect(db.insert(notifications).values({ recipientUserId: c.user.id, kind: "promo", title: "Buy now" })).rejects.toThrow();
    await expect(db.insert(notifications).values({ recipientUserId: c.user.id, kind: "order", title: "x", link: "https://evil.example" })).rejects.toThrow();
    // The helper also drops links that would leave the site, which the database rule alone allows.
    for (const [i, bad] of ["//evil.example/x", "/\\evil.example", "/ path"].entries()) await notifyUser(db, { userId: c.user.id, kind: "order", title: "t", link: bad, dedupeKey: `bad-link:${i}` });
    expect((await listNotifications(db, c.user.id, { limit: 50 })).items.filter((i) => i.title === "t").every((i) => i.link === null)).toBe(true);
  });
});

describe("security events", () => {
  it("a customer's password change notifies them; a staff member's doesn't", async () => {
    const c = await makeCustomer(db);
    await changePassword(db, (await validateSession(db, c.token, "customer"))!, PASSWORD, "a-different-strong-pass");
    expect((await listNotifications(db, c.user.id)).items).toMatchObject([{ kind: "security", title: "Your password was changed", link: "/dashboard/security" }]);
    const s = await makeStaff(db, "support");
    await changePassword(db, (await validateSession(db, s.token, "staff"))!, PASSWORD, "a-different-strong-pass");
    expect((await listNotifications(db, s.user.id)).items).toHaveLength(0);
  });
});

describe("route", () => {
  const post = (body: unknown, origin = "http://localhost:3000") => new Request("http://localhost:3000/api/account/notifications", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) });

  it("customers only, same origin, filters from the query string, and never another account's rows", async () => {
    const { GET, POST } = await import("@/app/api/account/notifications/route");
    const a = await makeCustomer(db);
    const b = await makeCustomer(db);
    await seed(a.user.id, 3, "order");
    await seed(a.user.id, 1, "security");
    await seed(b.user.id, 2, "order");
    setRequestHeaders({});
    signInAs("customer", "not-a-session");
    expect((await GET(new Request("http://localhost:3000/api/account/notifications"), {} as never)).status).toBe(401);
    signInAs("customer", a.token);
    const r = await GET(new Request("http://localhost:3000/api/account/notifications?kind=security&status=unread"), {} as never);
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toMatch(/private|no-store/);
    const body = (await r.json()) as { unread: number; items: { kind: string }[] };
    expect(body.items).toHaveLength(1);
    expect(body.unread).toBe(4);
    expect((await GET(new Request("http://localhost:3000/api/account/notifications?kind=payments"), {} as never)).status).toBe(400);
    expect((await POST(post({ all: true }, "https://evil.example"), {} as never)).status).toBe(403);
    expect(((await (await POST(post({ all: true }), {} as never)).json()) as { unread: number }).unread).toBe(0);
    expect((await listNotifications(db, b.user.id)).unread).toBe(2);
    const staff = await makeStaff(db, "admin");
    signInAs("staff", staff.token);
    expect((await GET(new Request("http://localhost:3000/api/account/notifications"), {} as never)).status).toBe(401);
  });
});
