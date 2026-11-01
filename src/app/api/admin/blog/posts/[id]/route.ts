import { clientInfo, requireStaff } from "@/server/auth";
import { blogChanged } from "@/server/blog/public";
import { deletePost, getPost, updatePost } from "@/server/blog/posts";
import { getDb } from "@/server/db/client";
import { assertSameOrigin, privateJson, route } from "@/server/http";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (_request, { params }) => {
  await requireStaff("settings:view");
  return privateJson({ post: await getPost(getDb(), (await params).id) });
});

/** Saves the editor's fields; refused if the post changed since the editor loaded it. */
export const PATCH = route<Ctx>(async (request, { params }) => {
  assertSameOrigin(request);
  const actor = await requireStaff("settings:manage");
  const post = await updatePost(getDb(), actor, (await params).id, await request.json().catch(() => ({})), await clientInfo());
  blogChanged();
  return privateJson({ post });
});

/** Permanently deletes a post (the admin screen confirms first). */
export const DELETE = route<Ctx>(async (request, { params }) => {
  assertSameOrigin(request);
  const actor = await requireStaff("settings:manage");
  await deletePost(getDb(), actor, (await params).id, await request.json().catch(() => ({})), await clientInfo());
  blogChanged();
  return privateJson({ deleted: true });
});
