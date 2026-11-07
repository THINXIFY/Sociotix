import { requireCustomer } from "@/server/auth";
import { getOnboarding, saveOnboarding } from "@/server/customers/customers";
import { getDb } from "@/server/db/client";
import { assertSameOrigin, privateJson, route } from "@/server/http";

/** The signed-in customer's own onboarding goals and platforms. Customers only — staff sessions are refused. */
export const GET = route(async () => {
  const actor = await requireCustomer();
  return privateJson(await getOnboarding(getDb(), actor.customerId));
});

/** Finishes or skips the welcome flow for the signed-in customer; the body can't name another account. */
export const PUT = route(async (request) => {
  assertSameOrigin(request);
  const actor = await requireCustomer();
  return privateJson(await saveOnboarding(getDb(), actor.customerId, await request.json().catch(() => ({}))));
});
