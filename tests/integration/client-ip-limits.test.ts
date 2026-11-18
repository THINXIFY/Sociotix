import { randomInt } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { clientInfo } from "@/server/auth";
import { loginCustomer, registerCustomer } from "@/server/auth/accounts";
import { clear, LIMITS } from "@/server/auth/rate-limit";
import { UNVERIFIED } from "@/server/client-ip";
import type { Db } from "@/server/db/client";
import { resetEnvCache } from "@/server/env";
import { AppError } from "@/server/errors";
import { PASSWORD, setRequestHeaders, uniqueEmail } from "./auth-helpers";
import { ensureReferenceData, testDb } from "./helpers";

vi.mock("next/headers", async () => (await import("./auth-helpers")).jarMock());

/*
 * SEC-02 end to end: requests go through the real clientInfo() and the real per-IP limits. Forging, rotating or
 * dropping forwarding headers must not reset a limit, and the thresholds themselves are unchanged.
 */
let db: Db;
beforeAll(async () => {
  db = testDb();
  await ensureReferenceData(db);
});
afterAll(() => db.$client.end());
afterEach(() => {
  vi.unstubAllEnvs();
  resetEnvCache();
});

const trust = (extra: Record<string, string> = {}) => {
  vi.stubEnv("TRUST_PROXY_HEADERS", "true");
  for (const [k, v] of Object.entries(extra)) vi.stubEnv(k, v);
  resetEnvCache();
};
const realIp = () => `198.51.${randomInt(0, 255)}.${randomInt(1, 254)}`;
const code = (p: Promise<unknown>) => p.then(() => "resolved", (e) => (e instanceof AppError ? e.code : `other:${String(e)}`));

/** One failed sign-in for an unknown email (so only the per-IP limit accumulates), as the given request. */
async function attempt(headers: Record<string, string>) {
  setRequestHeaders(headers);
  return code(loginCustomer(db, { email: uniqueEmail("nobody"), password: "wrong-password-1" }, await clientInfo()));
}

describe("per-IP limits can't be bypassed with forged headers", () => {
  it("rotating forged X-Forwarded-For values still hits the same login limit", async () => {
    trust();
    const ip = realIp();
    const results: string[] = [];
    for (let i = 0; i <= LIMITS.loginIp.limit; i++) results.push(await attempt({ "x-forwarded-for": `10.${i}.0.1, 203.0.113.${i}, ${ip}` }));
    expect(results.slice(0, LIMITS.loginIp.limit).every((r) => r !== "RATE_LIMITED")).toBe(true);
    expect(results.at(-1)).toBe("RATE_LIMITED");
    // A different real client is unaffected.
    expect(await attempt({ "x-forwarded-for": `6.6.6.6, ${realIp()}` })).not.toBe("RATE_LIMITED");
  });

  it("requests that skip the proxy or send malformed headers share one strict bucket (fail closed)", async () => {
    trust({ TRUSTED_PROXY_HOPS: "2" });
    await clear(db, "login-ip", UNVERIFIED);
    setRequestHeaders({ "x-forwarded-for": "198.51.100.1" }); // one entry, but two proxies should have appended
    expect(await clientInfo()).toMatchObject({ ip: null, ipKey: UNVERIFIED });
    const forged = ["", "unknown", "<x>", "1.1.1.1", "300.1.1.1, 2.2.2.2"];
    let last = "";
    for (let i = 0; i <= LIMITS.loginIp.limit; i++) last = await attempt(forged[i % forged.length] ? { "x-forwarded-for": forged[i % forged.length]! } : {});
    expect(last).toBe("RATE_LIMITED");
    // Traffic through the proxy keeps working.
    expect(await attempt({ "x-forwarded-for": `${realIp()}, 172.70.0.1` })).not.toBe("RATE_LIMITED");
    await clear(db, "login-ip", UNVERIFIED);
  });

  it("registration: a forged edge header can't open new buckets", async () => {
    trust({ CLIENT_IP_HEADER: "cf-connecting-ip" });
    await clear(db, "register-ip", UNVERIFIED);
    const results: string[] = [];
    for (let i = 0; i <= LIMITS.registerIp.limit; i++) {
      // Duplicate/forged values arrive comma-joined, so none is trusted; X-Forwarded-For is ignored in this mode.
      setRequestHeaders({ "cf-connecting-ip": `9.9.9.${i}, ${realIp()}`, "x-forwarded-for": `${realIp()}` });
      results.push(await code(registerCustomer(db, { name: "Spoof Test", email: uniqueEmail("reg"), password: PASSWORD }, await clientInfo())));
    }
    expect(results.at(-1)).toBe("RATE_LIMITED");
    await clear(db, "register-ip", UNVERIFIED);
  });

  it("IPv6 clients are limited per /64, so rotating addresses in one allocation doesn't help", async () => {
    trust();
    const prefix = `2001:db8:${randomInt(1, 65535).toString(16)}:${randomInt(1, 65535).toString(16)}`;
    let last = "";
    for (let i = 0; i <= LIMITS.loginIp.limit; i++) last = await attempt({ "x-forwarded-for": `${prefix}::${(i + 1).toString(16)}` });
    expect(last).toBe("RATE_LIMITED");
  });

  it("with proxy trust off, headers are ignored entirely (local development)", async () => {
    setRequestHeaders({ "x-forwarded-for": "1.2.3.4", "cf-connecting-ip": "1.2.3.4", "x-real-ip": "1.2.3.4" });
    expect(await clientInfo()).toMatchObject({ ip: null, ipKey: null });
  });
});
