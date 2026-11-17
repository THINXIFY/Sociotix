import { requireCustomer } from "@/server/auth";
import { importAiContent } from "@/server/content";
import { getDb } from "@/server/db/client";
import { assertSameOrigin, privateJson, route } from "@/server/http";

/**
 * Saves AI tool results the customer is looking at into their own Content Library: drafts for captions, ideas and
 * calendar slots, a template for a hashtag set. Never plans, schedules or publishes anything.
 */
export const POST = route(async (request) => {
  assertSameOrigin(request);
  const actor = await requireCustomer();
  return privateJson(await importAiContent(getDb(), actor.customerId, await request.json().catch(() => ({}))), { status: 201 });
});
