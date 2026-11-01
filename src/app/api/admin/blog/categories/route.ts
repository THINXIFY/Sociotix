import { clientInfo, requireStaff } from "@/server/auth";
import { createCategory, listCategories } from "@/server/blog/categories";
import { blogChanged } from "@/server/blog/public";
import { getDb } from "@/server/db/client";
import { assertSameOrigin, privateJson, route } from "@/server/http";

/** Built-in and custom blog categories with post counts (Settings: View). */
export const GET = route(async () => {
  await requireStaff("settings:view");
  return privateJson({ categories: await listCategories(getDb()) });
});

/** Adds a custom category (Settings: Manage). */
export const POST = route(async (request) => {
  assertSameOrigin(request);
  const actor = await requireStaff("settings:manage");
  const category = await createCategory(getDb(), actor, await request.json().catch(() => ({})), await clientInfo());
  blogChanged();
  return privateJson({ category }, { status: 201 });
});
