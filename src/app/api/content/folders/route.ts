import { requireCustomer } from "@/server/auth";
import { getDb } from "@/server/db/client";
import { assertSameOrigin, privateJson, route } from "@/server/http";
import { createFolder, listFolders } from "@/server/content";

/** Creates a folder for the signed-in customer's content. */
export const POST = route(async (request) => {
  assertSameOrigin(request);
  const actor = await requireCustomer();
  return privateJson({ folder: await createFolder(getDb(), actor.customerId, await request.json().catch(() => ({}))) }, { status: 201 });
});

/** The signed-in customer own folders (for pickers outside the Content Library). */
export const GET = route(async () => {
  const actor = await requireCustomer();
  return privateJson({ folders: await listFolders(getDb(), actor.customerId) });
});
