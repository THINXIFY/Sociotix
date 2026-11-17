import { requireCustomer } from "@/server/auth";
import { setPostMedia } from "@/server/content";
import { getDb } from "@/server/db/client";
import { assertSameOrigin, privateJson, route } from "@/server/http";

type Ctx = { params: Promise<{ id: string }> };

/** Changes the images (and their order) on one of the caller's own drafts. Never schedules or publishes. */
export const PATCH = route<Ctx>(async (request, { params }) => {
  assertSameOrigin(request);
  const actor = await requireCustomer();
  return privateJson(await setPostMedia(getDb(), actor.customerId, (await params).id, await request.json().catch(() => ({}))));
});
