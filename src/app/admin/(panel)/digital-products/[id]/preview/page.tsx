import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, Eye } from "lucide-react";
import { SectionGate } from "@/components/admin/section-gate";
import { ProductView } from "@/components/digital-products/product-view";
import { PRODUCT_STATUS_LABEL } from "@/lib/digital-products/admin";
import { allows } from "@/server/auth/permissions";
import { staffPage } from "@/server/auth/pages";
import { getDb } from "@/server/db/client";
import { getAdminProduct } from "@/server/digital-products/products";
import { toDigitalProduct } from "@/server/digital-products/public";
import { AppError } from "@/server/errors";

export const metadata: Metadata = { title: "Preview · Digital Products", robots: { index: false, follow: false } };

/** Staff-only preview of any product (drafts included), exactly as its public page renders it. */
async function Preview({ params }: { params: Promise<{ id: string }> }) {
  const r = await staffPage();
  if (r.status !== "ok") return null;
  let product;
  try {
    product = await getAdminProduct(getDb(), (await params).id);
  } catch (e) {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  const p = toDigitalProduct(product);
  const canEdit = allows(r.viewer.access, "settings:manage");
  return (
    <div className="pb-10">
      <div className="sticky top-16 z-30 border-b bg-soon-soft/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-sm sm:px-6">
          <p role="note" className="flex items-center gap-2 font-semibold text-soon">
            <Eye className="size-4" aria-hidden /> Preview · {PRODUCT_STATUS_LABEL[product.status]} — only staff can see this page.
          </p>
          <Link href={canEdit ? `/admin/digital-products/${product.id}/edit` : "/admin/digital-products"} className="inline-flex items-center gap-1.5 font-semibold text-foreground hover:underline">
            <ArrowLeft className="size-4" aria-hidden /> {canEdit ? "Back to editor" : "All products"}
          </Link>
        </div>
      </div>
      <div className="relative isolate">
        <ProductView product={p} products={[]} preview={false} staffPreview />
      </div>
    </div>
  );
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const view = (
    <Suspense fallback={<div className="mx-auto h-96 max-w-[96rem] px-4 py-8" aria-busy="true" />}>
      <Preview params={params} />
    </Suspense>
  );
  return (
    <SectionGate section="digital-products" live={view}>
      {view}
    </SectionGate>
  );
}
