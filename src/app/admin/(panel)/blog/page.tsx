import type { Metadata } from "next";
import { Suspense } from "react";
import { BlogPosts } from "@/components/admin/blog/posts";
import { SectionGate } from "@/components/admin/section-gate";
import { allows } from "@/server/auth/permissions";
import { staffPage } from "@/server/auth/pages";

export const metadata: Metadata = { title: "Blog Management" };

async function Posts() {
  const r = await staffPage();
  return <BlogPosts canManage={r.status === "ok" && allows(r.viewer.access, "settings:manage")} />;
}

export default function Page() {
  // Real records in both modes: there are no demo posts. Every API call re-checks the role.
  const view = (
    <Suspense fallback={<div className="mx-auto h-96 max-w-[96rem] px-4 py-8" aria-busy="true" />}>
      <Posts />
    </Suspense>
  );
  return (
    <SectionGate section="blog" live={view}>
      {view}
    </SectionGate>
  );
}
