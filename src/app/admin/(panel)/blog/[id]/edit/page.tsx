import type { Metadata } from "next";
import { Suspense } from "react";
import { SectionGate } from "@/components/admin/section-gate";
import { EditorPage } from "../../editor-page";

export const metadata: Metadata = { title: "Edit post · Blog Management" };

async function Editor({ params }: { params: Promise<{ id: string }> }) {
  return <EditorPage id={(await params).id} />;
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const view = (
    <Suspense fallback={<div className="mx-auto h-96 max-w-[96rem] px-4 py-8" aria-busy="true" />}>
      <Editor params={params} />
    </Suspense>
  );
  return (
    <SectionGate section="blog" live={view}>
      {view}
    </SectionGate>
  );
}
