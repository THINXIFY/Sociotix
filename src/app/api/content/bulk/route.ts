import { requireCustomer } from "@/server/auth";
import { getDb } from "@/server/db/client";
import { assertSameOrigin, privateJson, route } from "@/server/http";
import { bulkPosts } from "@/server/content";

/** One action on several of the caller's own posts; reports which ones were skipped and why. */
export const POST = route(async (request) => {
  assertSameOrigin(request);
  const actor = await requireCustomer();
  return privateJson(await bulkPosts(getDb(), actor.customerId, await request.json().catch(() => ({}))));
});
