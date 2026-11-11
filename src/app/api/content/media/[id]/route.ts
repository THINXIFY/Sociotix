import { requireCustomer } from "@/server/auth";
import { getDb } from "@/server/db/client";
import { assertSameOrigin, privateJson, route } from "@/server/http";
import { deleteMedia, renameMedia } from "@/server/content";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route<Ctx>(async (request, { params }) => {
  assertSameOrigin(request);
  const actor = await requireCustomer();
  await renameMedia(getDb(), actor.customerId, (await params).id, await request.json().catch(() => ({})));
  return privateJson({ ok: true });
});

export const DELETE = route<Ctx>(async (request, { params }) => {
  assertSameOrigin(request);
  const actor = await requireCustomer();
  await deleteMedia(getDb(), actor.customerId, (await params).id);
  return privateJson({ deleted: true });
});
