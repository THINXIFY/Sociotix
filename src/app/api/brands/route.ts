import { requireCustomer } from "@/server/auth";
import { createBrand, listBrands } from "@/server/brand";
import { getDb } from "@/server/db/client";
import { assertSameOrigin, privateJson, route } from "@/server/http";

/** The signed-in customer's own brand profiles (default first). Never public. */
export const GET = route(async () => {
  const actor = await requireCustomer();
  return privateJson({ brands: await listBrands(getDb(), actor.customerId) });
});

/** Creates a brand profile for the signed-in customer. */
export const POST = route(async (request) => {
  assertSameOrigin(request);
  const actor = await requireCustomer();
  return privateJson({ brand: await createBrand(getDb(), actor.customerId, await request.json().catch(() => ({}))) }, { status: 201 });
});
