import "server-only";
import { isIP } from "node:net";

/*
 * Client IP resolution (SEC-02). Proxy headers are client-controlled unless a proxy we trust wrote them, so:
 *  - nothing is read unless TRUST_PROXY_HEADERS is on;
 *  - a configured edge header (CLIENT_IP_HEADER, e.g. cf-connecting-ip) must hold exactly one valid IP;
 *  - otherwise X-Forwarded-For is read from the RIGHT, skipping the TRUSTED_PROXY_HOPS entries our own proxies
 *    appended. The first entry is never trusted, because a visitor can put anything there.
 * Anything missing, malformed or too short yields no IP. With trust on, such requests share one strict
 * "unverified" rate-limit bucket (fail closed); traffic through the proxy never lands there.
 */

export interface IpTrust {
  trust: boolean;
  /** A header set by the edge with the single client IP. When set, X-Forwarded-For is ignored. */
  header?: string | null;
  /** How many proxies we run that append to X-Forwarded-For (1 = only the platform's proxy). */
  hops: number;
}

export interface ResolvedIp {
  /** The verified client IP, or null when none could be established. */
  ip: string | null;
  /** The rate-limit identity: the IP (IPv6 grouped by /64), "unverified" when trust is on but no IP is valid, or null when trust is off. */
  key: string | null;
}

export const UNVERIFIED = "unverified";

/** "1.2.3.4", "1.2.3.4:5678", "[2001:db8::1]:443", "::ffff:1.2.3.4" → a canonical IP; null when it isn't one. */
export function normalizeIp(raw: string | null | undefined): string | null {
  let s = (raw ?? "").trim();
  if (!s || s.length > 64) return null;
  const bracketed = /^\[([^\]]+)\](?::\d{1,5})?$/.exec(s);
  if (bracketed) s = bracketed[1]!;
  else if (/^\d{1,3}(\.\d{1,3}){3}:\d{1,5}$/.test(s)) s = s.slice(0, s.lastIndexOf(":"));
  s = s.toLowerCase();
  if (s.includes("%")) return null; // zone ids never come from the internet
  const mapped = /^::ffff:(\d{1,3}(\.\d{1,3}){3})$/.exec(s);
  if (mapped) s = mapped[1]!;
  const v = isIP(s);
  if (v === 4) return s.split(".").map((p) => String(Number(p))).join(".") === s ? s : null; // no leading zeros
  return v === 6 ? s : null;
}

/** The rate-limit identity for an IP: IPv4 as is, IPv6 by its /64 (one subscriber usually controls a whole /64). */
export function ipRateKey(ip: string): string {
  if (isIP(ip) !== 6) return ip;
  const [head = "", tail = ""] = ip.split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const groups = ip.includes("::") ? [...left, ...Array(8 - left.length - right.length).fill("0"), ...right] : left;
  return `${groups
    .slice(0, 4)
    .map((g) => parseInt(g || "0", 16).toString(16))
    .join(":")}::/64`;
}

export function resolveClientIp(get: (name: string) => string | null, t: IpTrust): ResolvedIp {
  if (!t.trust) return { ip: null, key: null };
  const ip = t.header ? fromEdgeHeader(get(t.header)) : fromForwardedFor(get("x-forwarded-for"), t.hops);
  return ip ? { ip, key: ipRateKey(ip) } : { ip: null, key: UNVERIFIED };
}

function fromEdgeHeader(value: string | null): string | null {
  // Exactly one address: a list (or repeated header, which arrives comma-joined) means it wasn't set by our edge alone.
  if (!value || value.includes(",")) return null;
  return normalizeIp(value);
}

function fromForwardedFor(value: string | null, hops: number): string | null {
  if (!value || !Number.isInteger(hops) || hops < 1) return null;
  const chain = value.split(",").map((s) => s.trim());
  // The client is the entry just left of the ones our proxies appended. A shorter chain means the request didn't
  // pass through all of them (for example it hit the origin directly), so nothing can be trusted.
  if (chain.length < hops) return null;
  return normalizeIp(chain[chain.length - hops]);
}
