import { requireCustomer } from "@/server/auth";
import { getDb } from "@/server/db/client";
import { assertSameOrigin, privateJson, route } from "@/server/http";
import { linkPosts, unlinkPost } from "@/server/campaign";

type Ctx = { params: Promise<{ id: string }> };

/** Links the customer's own drafts to the campaign (content is not copied). */
export const POST = route<Ctx>(async (request, { params }) => {
  assertSameOrigin(request);
  const actor = await requireCustomer();
  return privateJson(await linkPosts(getDb(), actor.customerId, (await params).id, await request.json().catch(() => ({}))));
});

/** Removes a draft from the campaign; the draft is kept. */
export const DELETE = route<Ctx>(async (request, { params }) => {
  assertSameOrigin(request);
  const actor = await requireCustomer();
  await unlinkPost(getDb(), actor.customerId, (await params).id, await request.json().catch(() => ({})));
  return privateJson({ unlinked: true });
});
