import { requireCustomer } from "@/server/auth";
import { getDb } from "@/server/db/client";
import { assertSameOrigin, privateJson, route } from "@/server/http";
import { listNotifications, markRead } from "@/server/support/notifications";

/** The signed-in customer's own in-app notifications: `?status=unread&kind=order&q=…&before=<cursor>&limit=20`. */
export const GET = route(async (request) => {
  const actor = await requireCustomer();
  const p = new URL(request.url).searchParams;
  const pick = (k: string) => p.get(k) || undefined;
  return privateJson(await listNotifications(getDb(), actor.userId, { status: pick("status") as "all" | "unread" | undefined, kind: pick("kind") as never, q: pick("q"), before: pick("before"), limit: pick("limit") as never }));
});

/** Marks the customer's own notifications read or unread (`{ ids, read? }` or `{ all: true }`). */
export const POST = route(async (request) => {
  assertSameOrigin(request);
  const actor = await requireCustomer();
  await markRead(getDb(), actor.userId, await request.json().catch(() => ({})));
  return privateJson(await listNotifications(getDb(), actor.userId));
});
