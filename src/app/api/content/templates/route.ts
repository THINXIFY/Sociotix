import { requireCustomer } from "@/server/auth";
import { getDb } from "@/server/db/client";
import { assertSameOrigin, privateJson, route } from "@/server/http";
import { createTemplate } from "@/server/content";

/** Creates a template from fields or from one of the caller's own posts ({ fromPostId }). */
export const POST = route(async (request) => {
  assertSameOrigin(request);
  const actor = await requireCustomer();
  return privateJson({ template: await createTemplate(getDb(), actor.customerId, await request.json().catch(() => ({}))) }, { status: 201 });
});
