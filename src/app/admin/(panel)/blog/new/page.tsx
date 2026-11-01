import type { Metadata } from "next";
import { Suspense } from "react";
import { SectionGate } from "@/components/admin/section-gate";
import { EditorPage } from "../editor-page";

export const metadata: Metadata = { title: "New post · Blog Management" };

export default function Page() {
  const view = (
    <Suspense fallback={<div className="mx-auto h-96 max-w-[96rem] px-4 py-8" aria-busy="true" />}>
      <EditorPage id={null} />
    </Suspense>
  );
  return (
    <SectionGate section="blog" live={view}>
      {view}
    </SectionGate>
  );
}
