import { clientInfo, requireStaff } from "@/server/auth";
import { getDb } from "@/server/db/client";
import { deleteProduct, getAdminProduct, updateProduct } from "@/server/digital-products/products";
import { digitalProductsChanged } from "@/server/digital-products/public";
import { assertSameOrigin, privateJson, route } from "@/server/http";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (_request, { params }) => {
  await requireStaff("settings:view");
  return privateJson({ product: await getAdminProduct(getDb(), (await params).id) });
});

/** Saves the editor (rejected if someone else saved since it was loaded). */
export const PATCH = route<Ctx>(async (request, { params }) => {
  assertSameOrigin(request);
  const actor = await requireStaff("settings:manage");
  const product = await updateProduct(getDb(), actor, (await params).id, await request.json().catch(() => ({})), await clientInfo());
  digitalProductsChanged();
  return privateJson({ product });
});

/** Deletes a product and its files. */
export const DELETE = route<Ctx>(async (request, { params }) => {
  assertSameOrigin(request);
  const actor = await requireStaff("settings:manage");
  await deleteProduct(getDb(), actor, (await params).id, await request.json().catch(() => ({})), await clientInfo());
  digitalProductsChanged();
  return privateJson({ deleted: true });
});
