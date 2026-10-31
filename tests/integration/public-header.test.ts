import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, inject, it, vi } from "vitest";
import { viewerFromSession } from "@/components/site/public-header";
import { revokeSession } from "@/server/auth/sessions";
import { createDb, type Db } from "@/server/db/client";
import { resetEnvCache } from "@/server/env";
import { runMigrations } from "../../scripts/db/migrate";
import { seedReferenceData } from "../../scripts/db/seed";
import { jar, makeCustomer, makeStaff, signInAs } from "./auth-helpers";

vi.mock("next/headers", async () => (await import("./auth-helpers")).jarMock());

/* The public header shows who's signed in from the real session cookies, never a client-side guess. */
const scratch = `socivanta_public_header_test_${Date.now()}`;
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

describe("public header viewer", () => {
  it("no session cookie: guest", async () => {
    jar.clear();
    expect(await viewerFromSession()).toEqual({ kind: "guest" });
  });

  it("customer session: customer controls with name and initials, no admin link", async () => {
    const c = await makeCustomer(db);
    signInAs("customer", c.token);
    expect(await viewerFromSession()).toMatchObject({ kind: "customer", name: "Test Customer", initials: "TC", email: c.email, staff: false });
  });

  it("a revoked or unknown session reads as signed out", async () => {
    const c = await makeCustomer(db);
    signInAs("customer", c.token);
    await revokeSession(db, c.sessionId, c.user.id);
    expect(await viewerFromSession()).toEqual({ kind: "guest" });
    signInAs("customer", "not-a-real-token");
    expect(await viewerFromSession()).toEqual({ kind: "guest" });
  });

  it("staff with MFA complete: staff controls (admin destination) with their role", async () => {
    const s = await makeStaff(db, "support");
    signInAs("staff", s.token);
    expect(await viewerFromSession()).toMatchObject({ kind: "staff", roleName: "Support Agent", initials: "TS" });
  });

  it("a staff session that hasn't passed MFA isn't treated as signed in", async () => {
    const s = await makeStaff(db, "admin", { mfa: false });
    signInAs("staff", s.token);
    expect(await viewerFromSession()).toEqual({ kind: "guest" });
  });

  it("customer plus verified staff in one browser: customer controls, admin link offered", async () => {
    const c = await makeCustomer(db);
    const s = await makeStaff(db, "owner");
    jar.clear();
    jar.set("sv_session", c.token);
    jar.set("sv_staff", s.token);
    expect(await viewerFromSession()).toMatchObject({ kind: "customer", staff: true });
  });
});
