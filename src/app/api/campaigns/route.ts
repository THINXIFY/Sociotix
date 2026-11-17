import { requireCustomer } from "@/server/auth";
import { getDb } from "@/server/db/client";
import { assertSameOrigin, privateJson, route } from "@/server/http";
import { createCampaign, listCampaigns, listTemplates, summaryOf } from "@/server/campaign";

/** The signed-in customer's own campaigns (summaries) and templates. Never public. */
export const GET = route(async () => {
  const actor = await requireCustomer();
  const db = getDb();
  const [campaigns, templates] = await Promise.all([listCampaigns(db, actor.customerId), listTemplates(db, actor.customerId)]);
  return privateJson({ campaigns: campaigns.map(summaryOf), templates });
});

/** Creates a campaign (optionally from one of the customer's templates). */
export const POST = route(async (request) => {
  assertSameOrigin(request);
  const actor = await requireCustomer();
  return privateJson({ campaign: await createCampaign(getDb(), actor.customerId, await request.json().catch(() => ({}))) }, { status: 201 });
});
