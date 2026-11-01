import { z } from "zod";
import { getDb } from "@/server/db/client";
import { getImageBytes } from "@/server/blog/media";

/**
 * Serves blog images. Bytes were validated as JPEG/PNG/WebP on upload; the stored type is sent with
 * nosniff and a sandboxing CSP, and each id's content never changes, so it caches for a year.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return new Response("Not found", { status: 404 });
  let row;
  try {
    row = await getImageBytes(getDb(), id);
  } catch {
    return new Response("Unavailable", { status: 503, headers: { "cache-control": "no-store" } });
  }
  if (!row) return new Response("Not found", { status: 404 });
  const etag = `"${row.sha256}"`;
  const headers = { "content-type": row.mime, "cache-control": "public, max-age=31536000, immutable", etag, "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'; sandbox", "content-disposition": "inline" };
  if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
  return new Response(new Uint8Array(row.bytes), { headers });
}
