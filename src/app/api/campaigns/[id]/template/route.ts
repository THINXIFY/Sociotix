import { requireCustomer } from "@/server/auth";
import { getDb } from "@/server/db/client";
import { assertSameOrigin, privateJson, route } from "@/server/http";
import { saveAsTemplate } from "@/server/campaign";

/** Saves the campaign's structure as a reusable template. */
export const POST = route<{ params: Promise<{ id: string }> }>(async (request, { params }) => {
  assertSameOrigin(request);
  const actor = await requireCustomer();
  return privateJson({ template: await saveAsTemplate(getDb(), actor.customerId, (await params).id, await request.json().catch(() => ({}))) }, { status: 201 });
});
