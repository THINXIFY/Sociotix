import { notFound } from "next/navigation";
import { ProductEditor } from "@/components/admin/digital-products/editor";
import { AccessDenied } from "@/components/auth/states";
import { absoluteUrl } from "@/lib/seo/site";
import { allows } from "@/server/auth/permissions";
import { staffPage } from "@/server/auth/pages";
import { getDb } from "@/server/db/client";
import { getAdminProduct } from "@/server/digital-products/products";
import { AppError } from "@/server/errors";

/** Shared by New and Edit: writing needs Settings → Manage (the API enforces the same). */
export async function EditorPage({ id }: { id: string | null }) {
  const r = await staffPage();
  if (r.status !== "ok" || !allows(r.viewer.access, "settings:manage")) return <AccessDenied />;
  let product = null;
  if (id) {
    try {
      product = await getAdminProduct(getDb(), id);
    } catch (e) {
      if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
      throw e;
    }
  }
  return <ProductEditor key={product?.id ?? "new"} product={product} siteUrl={absoluteUrl("/digital-products/")} />;
}
