import { describe, expect, it } from "vitest";
import { ipRateKey, normalizeIp, resolveClientIp, UNVERIFIED, type IpTrust } from "@/server/client-ip";
import { parseEnv } from "@/server/env";

/* SEC-02: client IPs come only from proxy headers we explicitly trust, read so a visitor can't choose their own. */

const req = (h: Record<string, string>) => (name: string) => h[name.toLowerCase()] ?? null;
const XFF1: IpTrust = { trust: true, hops: 1 };
const XFF2: IpTrust = { trust: true, hops: 2 };
const EDGE: IpTrust = { trust: true, header: "cf-connecting-ip", hops: 1 };

describe("normalizeIp", () => {
  it("accepts real IPv4/IPv6 (with ports, brackets, mapped forms) and canonicalises them", () => {
    expect(normalizeIp(" 203.0.113.7 ")).toBe("203.0.113.7");
    expect(normalizeIp("203.0.113.7:51234")).toBe("203.0.113.7");
    expect(normalizeIp("[2001:DB8::1]:443")).toBe("2001:db8::1");
    expect(normalizeIp("2001:db8::1")).toBe("2001:db8::1");
    expect(normalizeIp("::ffff:198.51.100.9")).toBe("198.51.100.9");
  });
  it("rejects anything that isn't an address", () => {
    for (const bad of ["", "unknown", "localhost", "1.2.3", "1.2.3.4.5", "999.1.1.1", "01.2.3.4", "1.2.3.4 , 5.6.7.8", "fe80::1%eth0", "<script>", "a".repeat(80), null, undefined])
      expect(normalizeIp(bad as string), String(bad)).toBeNull();
  });
  it("groups IPv6 by /64 for rate limits, so rotating addresses inside one allocation doesn't help", () => {
    expect(ipRateKey("2001:db8:1:2:aaaa::1")).toBe("2001:db8:1:2::/64");
    expect(ipRateKey("2001:db8:1:2:ffff:ffff:ffff:ffff")).toBe("2001:db8:1:2::/64");
    expect(ipRateKey("2001:db8::7")).toBe("2001:db8:0:0::/64");
    expect(ipRateKey("203.0.113.7")).toBe("203.0.113.7");
  });
});

describe("resolveClientIp", () => {
  it("reads nothing when proxy trust is off, whatever the headers say", () => {
    expect(resolveClientIp(req({ "x-forwarded-for": "1.1.1.1", "cf-connecting-ip": "2.2.2.2", "x-real-ip": "3.3.3.3" }), { trust: false, hops: 1 })).toEqual({ ip: null, key: null });
  });

  it("never trusts the first X-Forwarded-For entry: a forged value is skipped (appending proxy)", () => {
    // The visitor sent "6.6.6.6"; the platform proxy appended the real address.
    expect(resolveClientIp(req({ "x-forwarded-for": "6.6.6.6, 198.51.100.20" }), XFF1)).toEqual({ ip: "198.51.100.20", key: "198.51.100.20" });
    // Rotating forged values doesn't change the identity.
    const keys = new Set(["1.1.1.1", "9.9.9.9, 8.8.8.8", "evil", "10.0.0.1, 10.0.0.2, 10.0.0.3"].map((f) => resolveClientIp(req({ "x-forwarded-for": `${f}, 198.51.100.20` }), XFF1).key));
    expect([...keys]).toEqual(["198.51.100.20"]);
  });

  it("works the same with an overwriting proxy (single entry)", () => {
    expect(resolveClientIp(req({ "x-forwarded-for": "198.51.100.20" }), XFF1).ip).toBe("198.51.100.20");
  });

  it("with two proxies (edge + platform), takes the address the edge saw", () => {
    // client → edge (appends client) → platform LB (appends edge) → app
    expect(resolveClientIp(req({ "x-forwarded-for": "6.6.6.6, 198.51.100.20, 172.70.1.1" }), XFF2).ip).toBe("198.51.100.20");
    expect(resolveClientIp(req({ "x-forwarded-for": "2001:db8:5::9, 172.70.1.1" }), XFF2)).toEqual({ ip: "2001:db8:5::9", key: "2001:db8:5:0::/64" });
  });

  it("fails closed when the chain is shorter than the trusted hops (request skipped a proxy)", () => {
    expect(resolveClientIp(req({ "x-forwarded-for": "198.51.100.20" }), XFF2)).toEqual({ ip: null, key: UNVERIFIED });
  });

  it("fails closed on missing, empty or malformed trusted values", () => {
    for (const h of [{}, { "x-forwarded-for": "" }, { "x-forwarded-for": "6.6.6.6, unknown" }, { "x-forwarded-for": "6.6.6.6, " }, { "x-forwarded-for": "6.6.6.6,,203.0.113.1, garbage" }] as Record<string, string>[])
      expect(resolveClientIp(req(h), XFF1), JSON.stringify(h)).toEqual({ ip: null, key: UNVERIFIED });
  });

  it("an edge header must hold exactly one address; X-Forwarded-For is then ignored", () => {
    expect(resolveClientIp(req({ "cf-connecting-ip": "198.51.100.20", "x-forwarded-for": "6.6.6.6" }), EDGE).ip).toBe("198.51.100.20");
    expect(resolveClientIp(req({ "cf-connecting-ip": "[2001:db8::5]" }), EDGE).ip).toBe("2001:db8::5");
    // Duplicate headers arrive comma-joined: not something the edge alone wrote.
    for (const v of ["6.6.6.6, 198.51.100.20", "", "not-an-ip"]) expect(resolveClientIp(req({ "cf-connecting-ip": v }), EDGE).key).toBe(UNVERIFIED);
    expect(resolveClientIp(req({ "x-forwarded-for": "198.51.100.20" }), EDGE)).toEqual({ ip: null, key: UNVERIFIED });
  });

  it("ignores X-Real-IP and other headers nobody configured", () => {
    expect(resolveClientIp(req({ "x-real-ip": "1.2.3.4", "true-client-ip": "1.2.3.4" }), XFF1)).toEqual({ ip: null, key: UNVERIFIED });
  });
});

describe("configuration", () => {
  const KEY_A = "a".repeat(44);
  const KEY_B = "b".repeat(44);
  const PROD = { NODE_ENV: "production", APP_ENV: "production", DATABASE_URL: "postgresql://a:b@db.example.com/prod?sslmode=verify-full", APP_URL: "https://app.example.com", AUTH_SECRET: KEY_A, DATA_ENCRYPTION_KEY: KEY_B, EMAIL_TRANSPORT: "postmark", EMAIL_FROM: "Sociotix <no-reply@example.com>", EMAIL_API_KEY: "pm-key-0123456789" };
  it("production requires explicit proxy trust", () => {
    expect(() => parseEnv(PROD)).toThrow(/TRUST_PROXY_HEADERS must be true in production/);
    expect(parseEnv({ ...PROD, TRUST_PROXY_HEADERS: "true" })).toMatchObject({ TRUST_PROXY_HEADERS: true, TRUSTED_PROXY_HOPS: 1 });
  });
  it("validates the trust settings and keeps development unchanged", () => {
    expect(parseEnv({ CLIENT_IP_HEADER: "CF-Connecting-IP" }).CLIENT_IP_HEADER).toBe("cf-connecting-ip");
    expect(parseEnv({ CLIENT_IP_HEADER: "" }).CLIENT_IP_HEADER).toBeUndefined();
    for (const bad of [{ CLIENT_IP_HEADER: "x-forwarded-for" }, { CLIENT_IP_HEADER: "bad header" }, { TRUSTED_PROXY_HOPS: "0" }, { TRUSTED_PROXY_HOPS: "9" }]) expect(() => parseEnv(bad), JSON.stringify(bad)).toThrow();
    expect(parseEnv({}).TRUST_PROXY_HEADERS).toBe(false);
  });
});
