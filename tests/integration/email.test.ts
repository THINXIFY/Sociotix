import { Client } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, inject, it, vi } from "vitest";
import { registerCustomer, verifyEmail } from "@/server/auth/accounts";
import { createDb, type Db } from "@/server/db/client";
import { notificationPreferences, users } from "@/server/db/schema";
import { capturedEmails, clearCapturedEmails, sendEmail } from "@/server/email";
import {
  existingAccountMessage,
  orderUpdateMessage,
  passwordChangedMessage,
  recoveryCodeUsedMessage,
  resetPasswordMessage,
  staffSetupMessage,
  ticketCreatedMessage,
  ticketReplyMessage,
  ticketStatusMessage,
  verifyEmailMessage,
  welcomeMessage,
} from "@/server/email/templates";
import { resetEnvCache } from "@/server/env";
import { listNotifications } from "@/server/support/notifications";
import { createTicket, setStatus, staffReply } from "@/server/support/tickets";
import { eq } from "drizzle-orm";
import { runMigrations } from "../../scripts/db/migrate";
import { seedReferenceData } from "../../scripts/db/seed";
import { makeCustomer, makeStaff, PASSWORD, tokenFrom, uniqueEmail } from "./auth-helpers";

/* EM-01 transactional email: templates, safety checks and event delivery, against a scratch database. Nothing leaves the machine (capture transport). */
const scratch = `socivanta_email_test_${Date.now()}`;
let db: Db;
let admin: Client;
const original = { EMAIL_NOTIFICATIONS: process.env.EMAIL_NOTIFICATIONS };

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
  if (original.EMAIL_NOTIFICATIONS === undefined) delete process.env.EMAIL_NOTIFICATIONS;
  else process.env.EMAIL_NOTIFICATIONS = original.EMAIL_NOTIFICATIONS;
  resetEnvCache();
  await admin.query(`drop database if exists ${scratch} with (force)`);
  await admin.end();
});
afterEach(() => {
  vi.restoreAllMocks();
  clearCapturedEmails();
});

const updates = (on: boolean) => {
  process.env.EMAIL_NOTIFICATIONS = on ? "true" : "false";
  resetEnvCache();
};
const key = () => `k${Date.now()}${Math.random().toString(36).slice(2, 12)}`;
const mail = (kind: string, to?: string) => capturedEmails().filter((m) => m.kind === kind && (!to || m.to === to));
const staffOf = (s: Awaited<ReturnType<typeof makeStaff>>) => ({ userId: s.user.id, staffId: s.staffId });
const actorOf = (c: Awaited<ReturnType<typeof makeCustomer>>) => ({ userId: c.user.id, customerId: c.customer.id });

describe("templates", () => {
  const ticket = { reference: "TCK-7K2M9Q4D", subject: "Order hasn't started yet" };
  const all = [
    verifyEmailMessage("a@example.com", "Maya", "https://sociotix.example/verify-email?token=abc"),
    welcomeMessage("a@example.com", "Maya"),
    existingAccountMessage("a@example.com", "https://sociotix.example/login", "https://sociotix.example/forgot-password"),
    resetPasswordMessage("a@example.com", "https://sociotix.example/reset-password?token=abc"),
    passwordChangedMessage("a@example.com"),
    staffSetupMessage("a@example.com", "Maya", "Support Agent", "https://sociotix.example/admin/setup?token=abc", 72),
    recoveryCodeUsedMessage("a@example.com", 7),
    ticketCreatedMessage("a@example.com", ticket),
    ticketReplyMessage("a@example.com", ticket, "We're on it.", false),
    ticketStatusMessage("a@example.com", ticket, "In progress", "Our team is working on it."),
    orderUpdateMessage("a@example.com", "order.completed", { reference: "ORD-5F1A9C27E0", service: "Instagram Followers" }),
  ];

  it("every template is a complete, branded, mobile-ready email with a plain-text twin and at most one button", () => {
    for (const m of all) {
      expect(m.html.startsWith("<!doctype html>")).toBe(true);
      expect(m.html).toContain('name="viewport"');
      expect(m.html).toContain('alt="Sociotix"');
      expect(m.html).toContain("/brand/Sociotix_Light_theme_logo.png");
      expect(m.html.match(/class="btn"/g)?.length ?? 0).toBeLessThanOrEqual(1);
      expect(m.text.length).toBeGreaterThan(40);
      expect(m.subject).not.toMatch(/[\r\n]/);
      expect(m.text).not.toMatch(/<[a-z]/i);
    }
    expect(new Set(all.map((m) => m.kind)).size).toBe(all.length);
  });

  it("links in the plain text match the button, so either works", () => {
    const m = resetPasswordMessage("a@example.com", "https://sociotix.example/reset-password?token=abc");
    expect(m.text).toContain("https://sociotix.example/reset-password?token=abc");
    expect(m.html).toContain('href="https://sociotix.example/reset-password?token=abc"');
    expect(tokenFrom(m.text)).toBe("abc");
  });

  it("escapes people's words, keeps subjects on one line and drops unsafe links", () => {
    const evil = { reference: "TCK-AAAA1111", subject: `<img src=x onerror=alert(1)>\r\nBcc: victim@example.com` };
    const m = ticketReplyMessage("a@example.com", evil, `<script>alert("x")</script> & "quotes"`, false);
    expect(m.html).not.toContain("<script>");
    expect(m.html).not.toContain("<img src=x");
    expect(m.html).toContain("&lt;script&gt;");
    expect(m.subject).not.toMatch(/[\r\n]/);
    const bad = verifyEmailMessage("a@example.com", "Maya", "javascript:alert(1)");
    expect(bad.html).not.toContain("javascript:");
    expect(bad.text).not.toContain("javascript:");
  });
});

describe("delivery safety", () => {
  it("refuses malformed or multiple recipients and multi-line subjects before any provider", async () => {
    const base = passwordChangedMessage("a@example.com");
    for (const to of ["not-an-email", "a@example.com, b@example.com", "a@example.com\r\nBcc: b@example.com", "<a@example.com>"]) await expect(sendEmail({ ...base, to })).rejects.toThrow();
    await expect(sendEmail({ ...base, subject: "Hi\r\nBcc: x@example.com" })).rejects.toThrow();
    expect(capturedEmails()).toHaveLength(0);
  });
});

describe("update emails", () => {
  it("stay off by default; in-app notifications and sign-in emails are unaffected", async () => {
    updates(false);
    const c = await makeCustomer(db);
    const s = await makeStaff(db, "support");
    const t = await createTicket(db, actorOf(c), { subject: "Where is my order?", category: "order", message: "It still shows awaiting review today.", key: key() });
    await staffReply(db, staffOf(s), t.reference, { body: "Checking now.", key: key() });
    expect(capturedEmails()).toHaveLength(0);
    expect((await listNotifications(db, c.user.id)).items).toHaveLength(1);
    const email = uniqueEmail("signup");
    await registerCustomer(db, { name: "Ada Lovelace", email, password: PASSWORD });
    expect(mail("verify_email", email)).toHaveLength(1);
  });

  it("when switched on: ticket created, reply and status each email once; a retried reply doesn't repeat", async () => {
    updates(true);
    const c = await makeCustomer(db);
    const s = await makeStaff(db, "support");
    const t = await createTicket(db, actorOf(c), { subject: "Where is my order?", category: "order", message: "It still shows awaiting review today.", key: key() });
    const k = key();
    await staffReply(db, staffOf(s), t.reference, { body: "Checking now.", key: k });
    await staffReply(db, staffOf(s), t.reference, { body: "Checking now.", key: k });
    await setStatus(db, staffOf(s), t.reference, { status: "in_progress" });
    expect(mail("ticket_created", c.email)).toHaveLength(1);
    expect(mail("ticket_reply", c.email)).toHaveLength(1);
    expect(mail("ticket_status", c.email)).toHaveLength(1);
    expect(mail("ticket_reply", c.email)[0].text).toContain(`/dashboard/support?ticket=${t.reference}`);
    // A different customer gets nothing.
    expect(capturedEmails().every((m) => m.to === c.email)).toBe(true);
  });

  it("respect a stored email opt-out and skip unverified addresses", async () => {
    updates(true);
    const s = await makeStaff(db, "support");
    const optedOut = await makeCustomer(db);
    await db.insert(notificationPreferences).values({ userId: optedOut.user.id, kind: "support", channel: "email", enabled: false });
    const unverified = await makeCustomer(db);
    for (const c of [optedOut, unverified]) {
      const t = await createTicket(db, actorOf(c), { subject: "Question about delivery", category: "order", message: "How long does delivery take usually?", key: key() });
      if (c === unverified) await db.update(users).set({ emailVerifiedAt: null }).where(eq(users.id, c.user.id));
      await staffReply(db, staffOf(s), t.reference, { body: "Usually within a day.", key: key() });
    }
    expect(mail("ticket_reply")).toHaveLength(0);
    expect((await listNotifications(db, optedOut.user.id)).items).toHaveLength(1);
  });

  it("a provider failure never undoes the action", async () => {
    updates(true);
    process.env.EMAIL_TRANSPORT = "resend";
    process.env.EMAIL_FROM = "Sociotix <hello@sociotix.example>";
    process.env.EMAIL_API_KEY = "re_test_key_never_used";
    resetEnvCache();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));
    try {
      const c = await makeCustomer(db);
      const s = await makeStaff(db, "support");
      const t = await createTicket(db, actorOf(c), { subject: "Where is my order?", category: "order", message: "It still shows awaiting review today.", key: key() });
      await expect(staffReply(db, staffOf(s), t.reference, { body: "Checking now.", key: key() })).resolves.toBeUndefined();
      expect((await listNotifications(db, c.user.id)).items).toHaveLength(1);
      expect(fetchSpy).toHaveBeenCalled();
    } finally {
      delete process.env.EMAIL_TRANSPORT;
      delete process.env.EMAIL_FROM;
      delete process.env.EMAIL_API_KEY;
      resetEnvCache();
    }
  });

  it("welcome is sent once, when a customer first confirms their email", async () => {
    updates(true);
    const email = uniqueEmail("welcome");
    await registerCustomer(db, { name: "Grace Hopper", email, password: PASSWORD });
    const token = tokenFrom(mail("verify_email", email)[0].text)!;
    expect(await verifyEmail(db, token)).toEqual({ status: "verified" });
    expect(await verifyEmail(db, token)).toEqual({ status: "invalid" });
    const welcome = mail("welcome", email);
    expect(welcome).toHaveLength(1);
    expect(welcome[0].subject).toBe("Welcome to Sociotix");
    expect(welcome[0].text).toContain("Grace");
  });
});
