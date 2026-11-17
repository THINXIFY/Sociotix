import { requireCustomer } from "@/server/auth";
import { getDb } from "@/server/db/client";
import { assertSameOrigin, privateJson, route } from "@/server/http";
import { reorderTasks } from "@/server/campaign";

export const POST = route<{ params: Promise<{ id: string }> }>(async (request, { params }) => {
  assertSameOrigin(request);
  const actor = await requireCustomer();
  await reorderTasks(getDb(), actor.customerId, (await params).id, await request.json().catch(() => ({})));
  return privateJson({ ok: true });
});
