import { requireCustomer } from "@/server/auth";
import { brandContext } from "@/server/brand";
import { getDb } from "@/server/db/client";
import { privateJson, route } from "@/server/http";

/** A brand's voice, audience and guidelines as structured context for the AI tools. Owner only; nothing generates from it yet. */
export const GET = route<{ params: Promise<{ id: string }> }>(async (_request, { params }) => {
  const actor = await requireCustomer();
  return privateJson({ context: await brandContext(getDb(), actor.customerId, (await params).id) });
});
