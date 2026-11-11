import { requireCustomer } from "@/server/auth";
import { getDb } from "@/server/db/client";
import { assertSameOrigin, privateJson, route } from "@/server/http";
import { setPostFlags } from "@/server/content";

type Ctx = { params: Promise<{ id: string }> };

/** Favorite, archive, move to a folder or plan one of the caller's own posts. Never schedules or publishes. */
export const PATCH = route<Ctx>(async (request, { params }) => {
  assertSameOrigin(request);
  const actor = await requireCustomer();
  await setPostFlags(getDb(), actor.customerId, (await params).id, await request.json().catch(() => ({})));
  return privateJson({ ok: true });
});
