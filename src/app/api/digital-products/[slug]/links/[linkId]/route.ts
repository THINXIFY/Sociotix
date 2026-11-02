import { audit } from "@/server/audit";
import { clientInfo } from "@/server/auth";
import { getDb } from "@/server/db/client";
import { authorizeDownload, downloadHeaders, downloadThrottle, refusal } from "@/server/digital-products/downloads";
import { checkDownloadUrl } from "@/server/digital-products/products";

type Ctx = { params: Promise<{ slug: string; linkId: string }> };

/** Redirects to a product's external download link, only after the permission check (the URL is never in a page). */
export async function GET(request: Request, { params }: Ctx) {
  const { slug, linkId } = await params;
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
  const link = d.product.downloadLinks.find((l) => l.id === linkId);
  const url = link ? checkDownloadUrl(link.url) : null;
  if (!url) return new Response("Not found", { status: 404, headers: downloadHeaders });
  if (d.who === "customer") await audit(db, { actorUserId: d.userId, actorType: "customer", action: "digital_product.download", targetType: "digital_product", targetId: d.product.id, after: { linkId, label: link!.label, title: d.product.title }, ...(await clientInfo()) });
  return new Response(null, { status: 302, headers: { ...downloadHeaders, location: url } });
}
