import { requireCustomer } from "@/server/auth";
import { getDb } from "@/server/db/client";
import { assertSameOrigin, privateJson, route } from "@/server/http";
import { deleteTemplate, updateTemplate } from "@/server/campaign";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route<Ctx>(async (request, { params }) => {
  assertSameOrigin(request);
  const actor = await requireCustomer();
  return privateJson({ template: await updateTemplate(getDb(), actor.customerId, (await params).id, await request.json().catch(() => ({}))) });
});

/** Deletes a template; campaigns made from it are unaffected. */
export const DELETE = route<Ctx>(async (request, { params }) => {
  assertSameOrigin(request);
  const actor = await requireCustomer();
  await deleteTemplate(getDb(), actor.customerId, (await params).id);
  return privateJson({ deleted: true });
});
