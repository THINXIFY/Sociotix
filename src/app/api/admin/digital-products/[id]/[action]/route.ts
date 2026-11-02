import { clientInfo, requireStaff } from "@/server/auth";
import { getDb } from "@/server/db/client";
import { duplicateProduct, setProductStatus } from "@/server/digital-products/products";
import { digitalProductsChanged } from "@/server/digital-products/public";
import { errors } from "@/server/errors";
import { assertSameOrigin, privateJson, route } from "@/server/http";

/** publish | unpublish | archive | duplicate. Publishing makes a product visible; it never enables purchases. */
export const POST = route<{ params: Promise<{ id: string; action: string }> }>(async (request, { params }) => {
  assertSameOrigin(request);
  const actor = await requireStaff("settings:manage");
  const { id, action } = await params;
  const body = await request.json().catch(() => ({}));
  const db = getDb();
  const client = await clientInfo();
  let product;
  if (action === "publish" || action === "unpublish" || action === "archive") product = await setProductStatus(db, actor, id, action, body, client);
  else if (action === "duplicate") product = await duplicateProduct(db, actor, id, client);
  else throw errors.notFound("That action");
  digitalProductsChanged();
  return privateJson({ product }, { status: action === "duplicate" ? 201 : 200 });
});
