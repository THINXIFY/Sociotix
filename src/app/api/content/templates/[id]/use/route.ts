import { requireCustomer } from "@/server/auth";
import { getDb } from "@/server/db/client";
import { assertSameOrigin, privateJson, route } from "@/server/http";
import { useTemplate } from "@/server/content";

type Ctx = { params: Promise<{ id: string }> };

/** Copies a template into a new draft. Nothing is scheduled or published. */
export const POST = route<Ctx>(async (request, { params }) => {
  assertSameOrigin(request);
  const actor = await requireCustomer();
  return privateJson({ post: await useTemplate(getDb(), actor.customerId, (await params).id, await request.json().catch(() => ({}))) }, { status: 201 });
});
