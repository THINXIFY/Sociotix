import { clientInfo, requireStaff } from "@/server/auth";
import { getDb } from "@/server/db/client";
import { createProduct, listProducts } from "@/server/digital-products/products";
import { digitalProductsChanged } from "@/server/digital-products/public";
import { assertSameOrigin, privateJson, route } from "@/server/http";

/** Digital Products live under Settings: View lists and previews products, Manage writes them. */
export const GET = route(async (request) => {
  await requireStaff("settings:view");
  const p = new URL(request.url).searchParams;
  return privateJson(await listProducts(getDb(), Object.fromEntries(p)));
});

/** Creates a draft (nothing is public until it's published). */
export const POST = route(async (request) => {
  assertSameOrigin(request);
  const actor = await requireStaff("settings:manage");
  const product = await createProduct(getDb(), actor, await request.json().catch(() => ({})), await clientInfo());
  digitalProductsChanged();
  return privateJson({ product }, { status: 201 });
});
