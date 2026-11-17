import { requireCustomer } from "@/server/auth";
import { getDb } from "@/server/db/client";
import { assertSameOrigin, privateJson, route } from "@/server/http";
import { deleteTask, updateTask } from "@/server/campaign";

type Ctx = { params: Promise<{ id: string; taskId: string }> };

export const PATCH = route<Ctx>(async (request, { params }) => {
  assertSameOrigin(request);
  const actor = await requireCustomer();
  const { id, taskId } = await params;
  return privateJson({ task: await updateTask(getDb(), actor.customerId, id, taskId, await request.json().catch(() => ({}))) });
});

export const DELETE = route<Ctx>(async (request, { params }) => {
  assertSameOrigin(request);
  const actor = await requireCustomer();
  const { id, taskId } = await params;
  await deleteTask(getDb(), actor.customerId, id, taskId);
  return privateJson({ deleted: true });
});
