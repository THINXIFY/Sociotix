import { clientInfo, requireStaff } from "@/server/auth";
import { getDb } from "@/server/db/client";
import { deleteProductFile, updateProductFile } from "@/server/digital-products/files";
import { digitalProductsChanged } from "@/server/digital-products/public";
import { assertSameOrigin, privateJson, route } from "@/server/http";

type Ctx = { params: Promise<{ id: string; fileId: string }> };

/** Changes a file's version label. */
export const PATCH = route<Ctx>(async (request, { params }) => {
  assertSameOrigin(request);
  const actor = await requireStaff("settings:manage");
  const { id, fileId } = await params;
  const result = await updateProductFile(getDb(), actor, id, fileId, await request.json().catch(() => ({})), await clientInfo());
  digitalProductsChanged();
  return privateJson(result);
});

export const DELETE = route<Ctx>(async (request, { params }) => {
  assertSameOrigin(request);
  const actor = await requireStaff("settings:manage");
  const { id, fileId } = await params;
  const result = await deleteProductFile(getDb(), actor, id, fileId, await clientInfo());
  digitalProductsChanged();
  return privateJson(result);
});
