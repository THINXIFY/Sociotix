import { requireCustomer } from "@/server/auth";
import { deleteBrand, getBrand, updateBrand } from "@/server/brand";
import { getDb } from "@/server/db/client";
import { assertSameOrigin, privateJson, route } from "@/server/http";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (_request, { params }) => {
  const actor = await requireCustomer();
  return privateJson({ brand: await getBrand(getDb(), actor.customerId, (await params).id) });
});

/** Edits one of the caller's own brands (needs the version the editor loaded). */
export const PATCH = route<Ctx>(async (request, { params }) => {
  assertSameOrigin(request);
  const actor = await requireCustomer();
  return privateJson({ brand: await updateBrand(getDb(), actor.customerId, (await params).id, await request.json().catch(() => ({}))) });
});

/** Deletes a brand. Drafts keep their content and images stay in the media library. */
export const DELETE = route<Ctx>(async (request, { params }) => {
  assertSameOrigin(request);
  const actor = await requireCustomer();
  return privateJson({ deleted: true, ...(await deleteBrand(getDb(), actor.customerId, (await params).id)) });
});
