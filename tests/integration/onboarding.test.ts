import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, inject, it, vi } from "vitest";
import { createDb, type Db } from "@/server/db/client";
import { customerPreferences } from "@/server/db/schema";
import { resetEnvCache } from "@/server/env";
import { accountSnapshot, getOnboarding, saveOnboarding, updatePreferences } from "@/server/customers/customers";
import { runMigrations } from "../../scripts/db/migrate";
import { seedReferenceData } from "../../scripts/db/seed";
import { makeCustomer, makeStaff, setRequestHeaders, signInAs } from "./auth-helpers";

vi.mock("next/headers", async () => (await import("./auth-helpers")).jarMock());

/* ON-01 customer onboarding: stored choices, isolation, the migration backfill and the route, against a scratch database. */
const scratch = `socivanta_onboarding_test_${Date.now()}`;
let db: Db;
let url: string;
let admin: Client;

beforeAll(async () => {
  admin = new Client({ connectionString: inject("adminUrl") });
  await admin.connect();
  await admin.query(`create database ${scratch} encoding 'UTF8' template template0`);
  const u = new URL(inject("adminUrl"));
  u.pathname = `/${scratch}`;
  url = u.toString();
  await runMigrations(url);
  process.env.DATABASE_URL = url;
  resetEnvCache();
  db = createDb(url);
  await seedReferenceData(db);
}, 120_000);
afterAll(async () => {
  await db.$client.end();
  process.env.DATABASE_URL = inject("databaseUrl");
  resetEnvCache();
  await admin.query(`drop database if exists ${scratch} with (force)`);
  await admin.end();
});

describe("stored choices", () => {
  it("a new customer hasn't seen it; finishing saves clean choices; skipping later keeps them", async () => {
    const { customer } = await makeCustomer(db);
    expect(await getOnboarding(db, customer.id)).toEqual({ state: null, interests: [], platforms: [] });
    const done = await saveOnboarding(db, customer.id, { action: "complete", interests: ["ai", "grow", "grow", "nope"], platforms: ["tiktok", "instagram", "myspace", "tiktok"] });
    expect(done).toEqual({ state: "completed", interests: ["grow", "ai"], platforms: ["tiktok", "instagram"] });
    expect(await saveOnboarding(db, customer.id, { action: "skip" })).toEqual(done);
    // The snapshot the dashboard loads carries the same choices (they follow the customer to any device).
    expect((await accountSnapshot(db, customer.id)).onboarding).toEqual(done);
  });

  it("skipping first records it without inventing choices, and other preferences are untouched", async () => {
    const m = await makeCustomer(db);
    await updatePreferences(db, { userId: m.user.id, customerId: m.customer.id }, { displayCurrency: "EUR", timezone: "UTC", dateFormat: "dmy", reduceMotion: true });
    expect(await getOnboarding(db, m.customer.id)).toMatchObject({ state: null });
    expect(await saveOnboarding(db, m.customer.id, { action: "skip" })).toEqual({ state: "skipped", interests: [], platforms: [] });
    const [row] = await db.select().from(customerPreferences).where(eq(customerPreferences.customerId, m.customer.id));
    expect(row).toMatchObject({ displayCurrency: "EUR", dateFormat: "dmy", reduceMotion: true, onboarding: "skipped" });
    expect(row.onboardedAt).toBeInstanceOf(Date);
  });

  it("rejects unknown actions and extra fields; the database enforces the limits too", async () => {
    const { customer } = await makeCustomer(db);
    await expect(saveOnboarding(db, customer.id, { action: "reset" })).rejects.toThrow();
    await expect(saveOnboarding(db, customer.id, { action: "complete", interests: ["grow"], customerId: "someone-else" })).rejects.toThrow();
    await expect(db.update(customerPreferences).set({ onboarding: "maybe" }).where(eq(customerPreferences.customerId, customer.id))).resolves.toBeDefined();
    await saveOnboarding(db, customer.id, { action: "skip" });
    await expect(db.update(customerPreferences).set({ onboarding: "maybe" }).where(eq(customerPreferences.customerId, customer.id))).rejects.toThrow();
    await expect(db.update(customerPreferences).set({ interests: ["a", "b", "c", "d", "e", "f"] }).where(eq(customerPreferences.customerId, customer.id))).rejects.toThrow();
  });
});

describe("existing customers", () => {
  it("the migration marks customers who signed up before it as existing, so the flow never interrupts them", async () => {
    const scratch2 = `${scratch}_backfill`;
    await admin.query(`create database ${scratch2} encoding 'UTF8' template template0`);
    const u = new URL(url);
    u.pathname = `/${scratch2}`;
    const db2 = createDb(u.toString());
    try {
      await runMigrations(u.toString());
      const run = async (file: string) => {
        const c = new Client({ connectionString: u.toString() });
        await c.connect();
        try {
          await c.query(readFileSync(file, "utf8"));
        } finally {
          await c.end();
        }
      };
      // Back to the schema before onboarding, add customers (one with saved preferences), then migrate forward.
      await run("drizzle/rollback/0021_notification_center.down.sql");
      await run("drizzle/rollback/0020_customer_onboarding.down.sql");
      const older = await makeCustomer(db2);
      const withPrefs = await makeCustomer(db2);
      const c = new Client({ connectionString: u.toString() });
      await c.connect();
      await c.query(`insert into customer_preferences (customer_id, display_currency) values ($1, 'GBP')`, [withPrefs.customer.id]);
      await c.end();
      await runMigrations(u.toString());
      expect((await getOnboarding(db2, older.customer.id)).state).toBe("existing");
      expect((await getOnboarding(db2, withPrefs.customer.id)).state).toBe("existing");
      const [kept] = await db2.select().from(customerPreferences).where(eq(customerPreferences.customerId, withPrefs.customer.id));
      expect(kept.displayCurrency).toBe("GBP");
      // A customer created after the migration is new.
      const fresh = await makeCustomer(db2);
      expect((await getOnboarding(db2, fresh.customer.id)).state).toBeNull();
    } finally {
      await db2.$client.end();
      await admin.query(`drop database if exists ${scratch2} with (force)`);
    }
  }, 120_000);
});

describe("route", () => {
  const req = (body: unknown, origin = "http://localhost:3000") => new Request("http://localhost:3000/api/account/onboarding", { method: "PUT", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) });

  it("needs a signed-in customer and the same origin, and only ever reads or writes the caller's own choices", async () => {
    const a = await makeCustomer(db);
    const b = await makeCustomer(db);
    const { PUT, GET } = await import("@/app/api/account/onboarding/route");
    setRequestHeaders({});
    signInAs("customer", "not-a-session");
    expect((await PUT(req({ action: "skip" }), {} as never)).status).toBe(401);
    signInAs("customer", a.token);
    expect((await PUT(req({ action: "skip" }, "https://evil.example"), {} as never)).status).toBe(403);
    expect((await PUT(req({ action: "later" }), {} as never)).status).toBe(400);
    const ok = await PUT(req({ action: "complete", interests: ["content"], platforms: ["youtube"] }), {} as never);
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ state: "completed", interests: ["content"], platforms: ["youtube"] });
    expect(ok.headers.get("cache-control")).toMatch(/private|no-store/);
    expect(await getOnboarding(db, b.customer.id)).toEqual({ state: null, interests: [], platforms: [] });
    signInAs("customer", b.token);
    expect(await (await GET(new Request("http://localhost:3000/api/account/onboarding"), {} as never)).json()).toEqual({ state: null, interests: [], platforms: [] });
  });

  it("staff sessions can't use it", async () => {
    const staff = await makeStaff(db, "admin");
    const { PUT, GET } = await import("@/app/api/account/onboarding/route");
    setRequestHeaders({});
    signInAs("staff", staff.token);
    expect((await GET(new Request("http://localhost:3000/api/account/onboarding"), {} as never)).status).toBe(401);
    expect((await PUT(req({ action: "skip" }), {} as never)).status).toBe(401);
  });
});
