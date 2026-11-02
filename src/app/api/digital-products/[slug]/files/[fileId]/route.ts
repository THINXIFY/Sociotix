import { audit } from "@/server/audit";
import { clientInfo } from "@/server/auth";
import { getDb } from "@/server/db/client";
import { authorizeDownload, downloadHeaders, downloadThrottle, refusal } from "@/server/digital-products/downloads";
import { getProductFileBytes } from "@/server/digital-products/files";

type Ctx = { params: Promise<{ slug: string; fileId: string }> };

/** Sends a product file as an attachment, only after the permission check in downloads.ts. */
export async function GET(request: Request, { params }: Ctx) {
  const { slug, fileId } = await params;
  let db;
  try {
    db = getDb();
  } catch {
    return new Response("Unavailable", { status: 503, headers: downloadHeaders });
  }
  const d = await authorizeDownload(db, slug);
  if (!d.ok) return refusal(request, d);
  if (d.who === "customer") {
    const slow = await downloadThrottle(db, d.userId);
    if (slow) return slow;
  }
  const file = await getProductFileBytes(db, d.product.id, fileId);
  if (!file) return new Response("Not found", { status: 404, headers: downloadHeaders });
  if (d.who === "customer") await audit(db, { actorUserId: d.userId, actorType: "customer", action: "digital_product.download", targetType: "digital_product", targetId: d.product.id, after: { fileId, filename: file.filename, version: file.version, title: d.product.title }, ...(await clientInfo()) });
  const ascii = file.filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return new Response(new Uint8Array(file.bytes), {
    headers: {
      ...downloadHeaders,
      "content-type": file.mime,
      "content-length": String(file.bytes.length),
      "content-disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
      "content-security-policy": "default-src 'none'; sandbox",
    },
  });
}
