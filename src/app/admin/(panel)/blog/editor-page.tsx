import { notFound } from "next/navigation";
import { BlogEditor } from "@/components/admin/blog/editor";
import { AccessDenied } from "@/components/auth/states";
import { getPost } from "@/server/blog/posts";
import { allows } from "@/server/auth/permissions";
import { staffPage } from "@/server/auth/pages";
import { getDb } from "@/server/db/client";
import { AppError } from "@/server/errors";
import { absoluteUrl } from "@/lib/seo/site";

/** Shared by New and Edit: writing needs Settings → Manage (the API enforces the same). */
export async function EditorPage({ id }: { id: string | null }) {
  const r = await staffPage();
  if (r.status !== "ok" || !allows(r.viewer.access, "settings:manage")) return <AccessDenied />;
  let post = null;
  if (id) {
    try {
      post = await getPost(getDb(), id);
    } catch (e) {
      if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
      throw e;
    }
  }
  return <BlogEditor key={post?.id ?? "new"} post={post} siteUrl={absoluteUrl("/blog/")} viewerName={r.viewer.name} />;
}
