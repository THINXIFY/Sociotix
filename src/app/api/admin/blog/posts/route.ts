import { clientInfo, requireStaff } from "@/server/auth";
import { blogChanged } from "@/server/blog/public";
import { createPost, listPosts } from "@/server/blog/posts";
import { getDb } from "@/server/db/client";
import { assertSameOrigin, privateJson, route } from "@/server/http";

/** Blog Management lives under Settings: View lists and previews posts, Manage writes them. */
export const GET = route(async (request) => {
  await requireStaff("settings:view");
  const p = new URL(request.url).searchParams;
  return privateJson(await listPosts(getDb(), Object.fromEntries(p)));
});

/** Creates a draft (nothing is public until it's published). */
export const POST = route(async (request) => {
  assertSameOrigin(request);
  const actor = await requireStaff("settings:manage");
  const post = await createPost(getDb(), actor, await request.json().catch(() => ({})), await clientInfo());
  blogChanged();
  return privateJson({ post }, { status: 201 });
});
