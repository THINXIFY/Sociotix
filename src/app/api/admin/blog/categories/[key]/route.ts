import { clientInfo, requireStaff } from "@/server/auth";
import { deleteCategory, updateCategory } from "@/server/blog/categories";
import { blogChanged } from "@/server/blog/public";
import { getDb } from "@/server/db/client";
import { assertSameOrigin, privateJson, route } from "@/server/http";

type Ctx = { params: Promise<{ key: string }> };

/** Renames a custom category; posts keep it. */
export const PATCH = route<Ctx>(async (request, { params }) => {
  assertSameOrigin(request);
  const actor = await requireStaff("settings:manage");
  const category = await updateCategory(getDb(), actor, (await params).key, await request.json().catch(() => ({})), await clientInfo());
  blogChanged();
  return privateJson({ category });
});

/** Deletes a custom category that no post uses. */
export const DELETE = route<Ctx>(async (request, { params }) => {
  assertSameOrigin(request);
  const actor = await requireStaff("settings:manage");
  await deleteCategory(getDb(), actor, (await params).key, await clientInfo());
  blogChanged();
  return privateJson({ deleted: true });
});
