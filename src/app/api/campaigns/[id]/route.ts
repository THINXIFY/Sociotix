import { requireCustomer } from "@/server/auth";
import { getDb } from "@/server/db/client";
import { assertSameOrigin, privateJson, route } from "@/server/http";
import { deleteCampaign, getCampaign, updateCampaign } from "@/server/campaign";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (_request, { params }) => {
  const actor = await requireCustomer();
  return privateJson({ campaign: await getCampaign(getDb(), actor.customerId, (await params).id) });
});

/** Edits one of the caller's own campaigns (content edits need the version the editor loaded). */
export const PATCH = route<Ctx>(async (request, { params }) => {
  assertSameOrigin(request);
  const actor = await requireCustomer();
  return privateJson({ campaign: await updateCampaign(getDb(), actor.customerId, (await params).id, await request.json().catch(() => ({}))) });
});

/** Deletes a campaign with its milestones and tasks. Linked drafts are kept. */
export const DELETE = route<Ctx>(async (request, { params }) => {
  assertSameOrigin(request);
  const actor = await requireCustomer();
  return privateJson({ deleted: true, ...(await deleteCampaign(getDb(), actor.customerId, (await params).id)) });
});
