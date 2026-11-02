import type { Metadata } from "next";
import { Suspense } from "react";
import { DigitalProducts } from "@/components/admin/digital-products/products";
import { SectionGate } from "@/components/admin/section-gate";
import { allows } from "@/server/auth/permissions";
import { staffPage } from "@/server/auth/pages";

export const metadata: Metadata = { title: "Digital Products" };

async function Products() {
  const r = await staffPage();
  return <DigitalProducts canManage={r.status === "ok" && allows(r.viewer.access, "settings:manage")} />;
}

export default function Page() {
  // Real records in both modes: there are no demo products. Every API call re-checks the role.
  const view = (
    <Suspense fallback={<div className="mx-auto h-96 max-w-[96rem] px-4 py-8" aria-busy="true" />}>
      <Products />
    </Suspense>
  );
  return (
    <SectionGate section="digital-products" live={view}>
      {view}
    </SectionGate>
  );
}
