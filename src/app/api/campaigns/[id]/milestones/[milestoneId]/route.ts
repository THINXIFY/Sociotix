import { requireCustomer } from "@/server/auth";
import { getDb } from "@/server/db/client";
import { assertSameOrigin, privateJson, route } from "@/server/http";
import { deleteMilestone, updateMilestone } from "@/server/campaign";

type Ctx = { params: Promise<{ id: string; milestoneId: string }> };

export const PATCH = route<Ctx>(async (request, { params }) => {
  assertSameOrigin(request);
  const actor = await requireCustomer();
  const { id, milestoneId } = await params;
  return privateJson({ milestone: await updateMilestone(getDb(), actor.customerId, id, milestoneId, await request.json().catch(() => ({}))) });
});

/** Deletes a milestone; its tasks are kept. */
export const DELETE = route<Ctx>(async (request, { params }) => {
  assertSameOrigin(request);
  const actor = await requireCustomer();
  const { id, milestoneId } = await params;
  await deleteMilestone(getDb(), actor.customerId, id, milestoneId);
  return privateJson({ deleted: true });
});
