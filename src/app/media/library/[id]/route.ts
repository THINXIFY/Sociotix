import { requireCustomer } from "@/server/auth";
import { getMediaBytes } from "@/server/content";
import { getDb } from "@/server/db/client";
import { route } from "@/server/http";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Serves a library image to the customer who owns it, and to no one else (another customer's image is
 * reported as not found). Bytes were validated as JPEG/PNG/WebP on upload; the stored type is sent with
 * nosniff and a sandboxing CSP, and the response is private so shared caches never keep it.
 */
export const GET = route<Ctx>(async (request, { params }) => {
  const actor = await requireCustomer();
  const row = await getMediaBytes(getDb(), actor.customerId, (await params).id);
  if (!row) return new Response("Not found", { status: 404, headers: { "cache-control": "private, no-store" } });
  const etag = `"${row.sha256}"`;
  const headers = { "content-type": row.mime, "cache-control": "private, max-age=3600", etag, "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'; sandbox", "cross-origin-resource-policy": "same-origin" };
  if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
  return new Response(new Uint8Array(row.bytes), { headers });
});
