import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, Eye } from "lucide-react";
import { SectionGate } from "@/components/admin/section-gate";
import { ArticleView } from "@/components/blog/article-view";
import { POST_STATE_LABEL } from "@/lib/blog/admin";
import { absoluteUrl } from "@/lib/seo/site";
import { allows } from "@/server/auth/permissions";
import { staffPage } from "@/server/auth/pages";
import { getPost } from "@/server/blog/posts";
import { postToArticle } from "@/server/blog/public";
import { getDb } from "@/server/db/client";
import { AppError } from "@/server/errors";

export const metadata: Metadata = { title: "Preview · Blog Management", robots: { index: false, follow: false } };

/** Staff-only preview of any post (drafts included), exactly as the article page renders it. */
async function Preview({ params }: { params: Promise<{ id: string }> }) {
  const r = await staffPage();
  if (r.status !== "ok") return null;
  let post;
  try {
    post = await getPost(getDb(), (await params).id);
  } catch (e) {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  const a = postToArticle({ ...post, live: post.state === "published" });
  const canEdit = allows(r.viewer.access, "settings:manage");
  return (
    <div className="pb-10">
      <div className="sticky top-16 z-30 border-b bg-soon-soft/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-sm sm:px-6">
          <p role="note" className="flex items-center gap-2 font-semibold text-soon">
            <Eye className="size-4" aria-hidden /> Preview · {POST_STATE_LABEL[post.state]} — only staff can see this page.
          </p>
          <Link href={canEdit ? `/admin/blog/${post.id}/edit` : "/admin/blog"} className="inline-flex items-center gap-1.5 font-semibold text-foreground hover:underline">
            <ArrowLeft className="size-4" aria-hidden /> {canEdit ? "Back to editor" : "All posts"}
          </Link>
        </div>
      </div>
      <ArticleView a={a} url={absoluteUrl(`/blog/${post.slug}`)} pool={[]} preview={false} />
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
    <SectionGate section="blog" live={view}>
      {view}
    </SectionGate>
  );
}
