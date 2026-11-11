import { requireCustomer } from "@/server/auth";
import { getDb } from "@/server/db/client";
import { assertSameOrigin, privateJson, route } from "@/server/http";
import { createFolder } from "@/server/content";

/** Creates a folder for the signed-in customer's content. */
export const POST = route(async (request) => {
  assertSameOrigin(request);
  const actor = await requireCustomer();
  return privateJson({ folder: await createFolder(getDb(), actor.customerId, await request.json().catch(() => ({}))) }, { status: 201 });
});
