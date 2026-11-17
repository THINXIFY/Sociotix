import { requireCustomer } from "@/server/auth";
import { duplicateBrand } from "@/server/brand";
import { getDb } from "@/server/db/client";
import { assertSameOrigin, privateJson, route } from "@/server/http";

export const POST = route<{ params: Promise<{ id: string }> }>(async (request, { params }) => {
  assertSameOrigin(request);
  const actor = await requireCustomer();
  return privateJson({ brand: await duplicateBrand(getDb(), actor.customerId, (await params).id) }, { status: 201 });
});
