import { clientInfo, requireStaff } from "@/server/auth";
import { getDb } from "@/server/db/client";
import { createDigitalCategory, listDigitalCategories } from "@/server/digital-products/categories";
import { digitalProductsChanged } from "@/server/digital-products/public";
import { assertSameOrigin, privateJson, route } from "@/server/http";

export const GET = route(async () => {
  await requireStaff("settings:view");
  return privateJson({ categories: await listDigitalCategories(getDb()) });
});

export const POST = route(async (request) => {
  assertSameOrigin(request);
  const actor = await requireStaff("settings:manage");
  const category = await createDigitalCategory(getDb(), actor, await request.json().catch(() => ({})), await clientInfo());
  digitalProductsChanged();
  return privateJson({ category }, { status: 201 });
});
