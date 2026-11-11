import { requireCustomer } from "@/server/auth";
import { getDb } from "@/server/db/client";
import { assertSameOrigin, privateJson, route } from "@/server/http";
import { deleteFolder, renameFolder } from "@/server/content";

type Ctx = { params: Promise<{ id: string }> };

/** Renames one of the caller's own folders. */
export const PATCH = route<Ctx>(async (request, { params }) => {
  assertSameOrigin(request);
  const actor = await requireCustomer();
  return privateJson({ folder: await renameFolder(getDb(), actor.customerId, (await params).id, await request.json().catch(() => ({}))) });
});

/** Deletes a folder; its posts are kept and become unfiled. */
export const DELETE = route<Ctx>(async (request, { params }) => {
  assertSameOrigin(request);
  const actor = await requireCustomer();
  await deleteFolder(getDb(), actor.customerId, (await params).id);
  return privateJson({ deleted: true });
});
