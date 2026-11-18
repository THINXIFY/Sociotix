import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseEnv } from "@/server/env";

/*
 * OPS-01B: deploy/staging.env.example must describe a configuration the app accepts once its placeholders are filled,
 * keep every postponed integration off, and the app must refuse unsafe variations of it.
 */

const parse = (text: string) =>
  Object.fromEntries(
    text
      .split(/\r?\n/)
      .filter((l) => l.trim() && !l.trimStart().startsWith("#"))
      .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
  ) as Record<string, string>;

const template = parse(readFileSync("deploy/staging.env.example", "utf8"));
const FILLED: Record<string, string> = {
  ...template,
  APP_URL: "https://staging.example.com",
  DATABASE_URL: "postgresql://app:pw@db.example.com:5432/sociotix_staging?sslmode=verify-full",
  AUTH_SECRET: "a".repeat(44),
  DATA_ENCRYPTION_KEY: "b".repeat(44),
  EMAIL_TRANSPORT: "postmark",
  EMAIL_FROM: "Sociotix Staging <no-reply@staging.example.com>",
  EMAIL_API_KEY: "pm-key-0123456789",
  SUPPORT_CONTACT_EMAIL: "support@example.com",
};

describe("staging environment template", () => {
  it("uses placeholders only, never real-looking secrets", () => {
    for (const k of ["AUTH_SECRET", "DATA_ENCRYPTION_KEY", "EMAIL_API_KEY"]) expect(template[k]).toMatch(/^<.+>$/);
    expect(template.DATABASE_URL).toContain("<password>");
  });

  it("is accepted once the placeholders are filled, as staging with proxy trust", () => {
    const env = parseEnv(FILLED);
    expect(env).toMatchObject({ APP_ENV: "preview", TRUST_PROXY_HEADERS: true, TRUSTED_PROXY_HOPS: 1, DEMO_MODE: false });
    expect(env.CLIENT_IP_HEADER).toBeUndefined();
  });

  it("keeps every postponed integration off", () => {
    const env = parseEnv(FILLED);
    expect(env).toMatchObject({ AI_PROVIDER: "none", AI_GENERATION_ENABLED: false, AI_ANONYMOUS_ENABLED: false, PAYMENTS_BANK_ENABLED: false, EMAIL_NOTIFICATIONS: false });
    expect(env.SOCIAL_PROVIDERS_ENABLED ?? "").toBe("");
    expect(env.SOCIAL_PUBLISHING_ENABLED ?? "").toBe("");
  });

  it("refuses unsafe or incomplete variations", () => {
    const bad: [string, Record<string, string>][] = [
      ["missing AUTH_SECRET", { AUTH_SECRET: "" }],
      ["missing encryption key", { DATA_ENCRYPTION_KEY: "" }],
      ["same secret twice", { DATA_ENCRYPTION_KEY: "a".repeat(44) }],
      ["plain http", { APP_URL: "http://staging.example.com" }],
      ["database without TLS", { DATABASE_URL: "postgresql://app:pw@db.example.com:5432/sociotix_staging" }],
      ["no proxy trust", { TRUST_PROXY_HEADERS: "false" }],
      ["X-Forwarded-For as an edge header", { CLIENT_IP_HEADER: "x-forwarded-for" }],
      ["impossible hop count", { TRUSTED_PROXY_HOPS: "0" }],
      ["unfilled placeholder secret", { AUTH_SECRET: template.AUTH_SECRET! }],
    ];
    for (const [why, change] of bad) expect(() => parseEnv({ ...FILLED, ...change }), why).toThrow();
  });
});
