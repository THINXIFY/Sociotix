import { clientInfo, requireStaff } from "@/server/auth";
import { blogChanged } from "@/server/blog/public";
import { publishPost, unpublishPost } from "@/server/blog/posts";
import { getDb } from "@/server/db/client";
import { errors } from "@/server/errors";
import { assertSameOrigin, privateJson, route } from "@/server/http";

/** publish (now, or at a future publishAt) | unpublish. */
export const POST = route<{ params: Promise<{ id: string; action: string }> }>(async (request, { params }) => {
  assertSameOrigin(request);
  const actor = await requireStaff("settings:manage");
  const { id, action } = await params;
  const body = await request.json().catch(() => ({}));
  const db = getDb();
  let post;
  if (action === "publish") post = await publishPost(db, actor, id, body, await clientInfo());
  else if (action === "unpublish") post = await unpublishPost(db, actor, id, body, await clientInfo());
  else throw errors.notFound("That action");
  blogChanged();
  return privateJson({ post });
});
