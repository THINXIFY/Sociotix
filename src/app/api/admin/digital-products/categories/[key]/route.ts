import { clientInfo, requireStaff } from "@/server/auth";
import { getDb } from "@/server/db/client";
import { deleteDigitalCategory, updateDigitalCategory } from "@/server/digital-products/categories";
import { digitalProductsChanged } from "@/server/digital-products/public";
import { assertSameOrigin, privateJson, route } from "@/server/http";

type Ctx = { params: Promise<{ key: string }> };

/** Renames a custom category; products keep it. */
export const PATCH = route<Ctx>(async (request, { params }) => {
  assertSameOrigin(request);
  const actor = await requireStaff("settings:manage");
  const category = await updateDigitalCategory(getDb(), actor, (await params).key, await request.json().catch(() => ({})), await clientInfo());
  digitalProductsChanged();
  return privateJson({ category });
});

/** Deletes a custom category that no product uses. */
export const DELETE = route<Ctx>(async (request, { params }) => {
  assertSameOrigin(request);
  const actor = await requireStaff("settings:manage");
  await deleteDigitalCategory(getDb(), actor, (await params).key, await clientInfo());
  digitalProductsChanged();
  return privateJson({ deleted: true });
});
