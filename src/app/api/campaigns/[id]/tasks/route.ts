import { requireCustomer } from "@/server/auth";
import { getDb } from "@/server/db/client";
import { assertSameOrigin, privateJson, route } from "@/server/http";
import { addTask } from "@/server/campaign";

export const POST = route<{ params: Promise<{ id: string }> }>(async (request, { params }) => {
  assertSameOrigin(request);
  const actor = await requireCustomer();
  return privateJson({ task: await addTask(getDb(), actor.customerId, (await params).id, await request.json().catch(() => ({}))) }, { status: 201 });
});
