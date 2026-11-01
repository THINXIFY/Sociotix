import "server-only";
import { createHash } from "node:crypto";
import { lookup as dnsLookup } from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import { eq } from "drizzle-orm";
import { MEDIA_PREFIX } from "@/lib/blog/rich";
import { audit } from "../audit";
import type { ClientInfo } from "../auth/sessions";
import type { Executor } from "../db/client";
import { blogMedia } from "../db/schema";
import { AppError } from "../errors";

/*
 * Blog images. Bytes are accepted only when their signature is JPEG, PNG or WebP (never SVG or
 * anything the browser could execute) and their dimensions parse. "Import from URL" downloads the
 * image on the server — public internet addresses only — so pages never hotlink other sites.
 */

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_DIMENSION = 12_000;

export type ImageMime = "image/jpeg" | "image/png" | "image/webp";
export interface ImageInfo {
  mime: ImageMime;
  width: number;
  height: number;
}

const invalid = (message: string) => new AppError("VALIDATION_FAILED", message, { details: { field: "image" } });

function jpegSize(b: Buffer): { width: number; height: number } | null {
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    const len = b.readUInt16BE(i + 2);
    // Start-of-frame markers carry the dimensions (C4, C8 and CC are other tables).
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) return { height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
    i += 2 + len;
  }
  return null;
}

function webpSize(b: Buffer): { width: number; height: number } | null {
  const chunk = b.toString("latin1", 12, 16);
  if (chunk === "VP8 " && b.length >= 30) return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
  if (chunk === "VP8L" && b.length >= 25) {
    const [b0, b1, b2, b3] = [b[21], b[22], b[23], b[24]];
    return { width: 1 + (((b1 & 0x3f) << 8) | b0), height: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)) };
  }
  if (chunk === "VP8X" && b.length >= 30) return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
  return null;
}

/** Identifies an image by its bytes (the file name and declared type are ignored). */
export function inspectImage(b: Buffer): ImageInfo {
  if (!b.length) throw invalid("That file is empty.");
  if (b.length > MAX_IMAGE_BYTES) throw invalid("Images can be up to 5 MB.");
  let info: ImageInfo | null = null;
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47 && b.readUInt32BE(4) === 0x0d0a1a0a && b.toString("latin1", 12, 16) === "IHDR") info = { mime: "image/png", width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  else if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    const s = jpegSize(b);
    if (s) info = { mime: "image/jpeg", ...s };
  } else if (b.length > 16 && b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WEBP") {
    const s = webpSize(b);
    if (s) info = { mime: "image/webp", ...s };
  }
  if (!info) throw invalid("Use a JPEG, PNG or WebP image.");
  if (info.width < 1 || info.height < 1 || info.width > MAX_DIMENSION || info.height > MAX_DIMENSION) throw invalid("That image's dimensions aren't supported.");
  return info;
}

export interface StoredImage {
  id: string;
  src: string;
  mime: ImageMime;
  width: number;
  height: number;
}

export const mediaSrc = (id: string) => `${MEDIA_PREFIX}${id}`;

/** Stores validated bytes (identical files are stored once) and records who added them. */
export async function storeImage(db: Executor, actor: { userId: string }, bytes: Buffer, source: { kind: "upload" } | { kind: "url"; url: string }, client: ClientInfo = {}): Promise<StoredImage> {
  const info = inspectImage(bytes);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  await db
    .insert(blogMedia)
    .values({ mime: info.mime, bytes, sizeBytes: bytes.length, width: info.width, height: info.height, sha256, source: source.kind, sourceUrl: source.kind === "url" ? source.url.slice(0, 2000) : null, uploadedBy: actor.userId })
    .onConflictDoNothing({ target: blogMedia.sha256 });
  const [row] = await db.select({ id: blogMedia.id }).from(blogMedia).where(eq(blogMedia.sha256, sha256));
  await audit(db, { actorUserId: actor.userId, actorType: "staff", action: "blog_media.add", targetType: "blog_media", targetId: row.id, after: { mime: info.mime, sizeBytes: bytes.length, source: source.kind, ...(source.kind === "url" ? { host: new URL(source.url).host } : {}) }, ...client });
  return { id: row.id, src: mediaSrc(row.id), ...info };
}

export async function getImageMeta(db: Executor, id: string) {
  const [row] = await db.select({ id: blogMedia.id, mime: blogMedia.mime, width: blogMedia.width, height: blogMedia.height }).from(blogMedia).where(eq(blogMedia.id, id));
  return row ? { ...row, src: mediaSrc(row.id) } : null;
}

export async function getImageBytes(db: Executor, id: string) {
  const [row] = await db.select({ mime: blogMedia.mime, bytes: blogMedia.bytes, sha256: blogMedia.sha256 }).from(blogMedia).where(eq(blogMedia.id, id));
  return row ?? null;
}

/* ------------------------------------------------------------------ */
/*  Import from URL (SSRF-safe)                                        */
/* ------------------------------------------------------------------ */

/** Addresses a server-side fetch must never reach: loopback, private, link-local, metadata, CGNAT, multicast and reserved ranges. */
const BLOCKED = new net.BlockList();
for (const [a, p] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const)
  BLOCKED.addSubnet(a, p, "ipv4");
for (const [a, p] of [
  ["::", 128],
  ["::1", 128],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
  ["2001:db8::", 32],
  ["64:ff9b::", 96],
  ["100::", 64],
] as const)
  BLOCKED.addSubnet(a, p, "ipv6");

export function isBlockedAddress(ip: string): boolean {
  const family = net.isIP(ip);
  if (family === 4) return BLOCKED.check(ip, "ipv4");
  if (family === 6) {
    const mapped = ip.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return BLOCKED.check(mapped[1], "ipv4");
    return BLOCKED.check(ip, "ipv6");
  }
  return true;
}

const refuse = (message = "That address can't be used. Use a public https:// image link.") => new AppError("VALIDATION_FAILED", message, { details: { field: "imageUrl" } });

/** Only plain public web addresses on the standard ports, without credentials. */
export function checkImageUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    throw refuse("Enter a full image address starting with https://");
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") throw refuse();
  if (u.username || u.password) throw refuse();
  if (u.port && u.port !== "443" && u.port !== "80") throw refuse();
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) throw refuse();
  if (net.isIP(host) && isBlockedAddress(host)) throw refuse();
  return u;
}

/** Resolves the host and refuses if any address is private, so DNS can't point the fetch inward (checked at connect time). */
const safeLookup: net.LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, "", 4);
    const list = addresses as unknown as { address: string; family: number }[];
    if (!list.length || list.some((a) => isBlockedAddress(a.address))) return callback(Object.assign(new Error("blocked address"), { code: "EBLOCKED" }), "", 4);
    if ((options as { all?: boolean }).all) return (callback as unknown as (e: null, a: typeof list) => void)(null, list);
    callback(null, list[0].address, list[0].family);
  });
};

function getOnce(u: URL, timeoutMs: number): Promise<{ status: number; location?: string; body?: Buffer }> {
  return new Promise((resolve, reject) => {
    const req = (u.protocol === "https:" ? https : http).request(u, { method: "GET", lookup: safeLookup, timeout: timeoutMs, headers: { accept: "image/jpeg,image/png,image/webp", "user-agent": "SociotixBlogImageImport/1.0" } }, (res) => {
      const status = res.statusCode ?? 0;
      if (status >= 300 && status < 400) {
        res.resume();
        return resolve({ status, location: res.headers.location });
      }
      if (status !== 200) {
        res.resume();
        return resolve({ status });
      }
      if (Number(res.headers["content-length"] ?? 0) > MAX_IMAGE_BYTES) {
        res.destroy();
        return reject(invalid("Images can be up to 5 MB."));
      }
      const chunks: Buffer[] = [];
      let size = 0;
      res.on("data", (c: Buffer) => {
        size += c.length;
        if (size > MAX_IMAGE_BYTES) {
          res.destroy();
          reject(invalid("Images can be up to 5 MB."));
        } else chunks.push(c);
      });
      res.on("end", () => resolve({ status, body: Buffer.concat(chunks) }));
      res.on("error", reject);
    });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.end();
  });
}

/** Downloads an image from a public address (up to 3 redirects, each re-checked; 10 s; 5 MB). */
export async function fetchRemoteImage(raw: string, timeoutMs = 10_000): Promise<{ url: string; bytes: Buffer }> {
  let u = checkImageUrl(raw);
  for (let hop = 0; hop < 4; hop++) {
    let r;
    try {
      r = await getOnce(u, timeoutMs);
    } catch (e) {
      if (e instanceof AppError) throw e;
      throw refuse("That image couldn't be downloaded. Check the link, or download the image and upload it instead.");
    }
    if (r.location) {
      u = checkImageUrl(new URL(r.location, u).toString());
      continue;
    }
    if (!r.body) throw refuse(`That address returned an error (${r.status}).`);
    inspectImage(r.body);
    return { url: u.toString(), bytes: r.body };
  }
  throw refuse("That address redirects too many times.");
}
