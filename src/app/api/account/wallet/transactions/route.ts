import { requireCustomer } from "@/server/auth";
import { getDb } from "@/server/db/client";
import { privateJson, route } from "@/server/http";
import { walletEntries } from "@/server/wallet/wallet";

/** The caller's own wallet history (read-only, paginated, optionally filtered). */
export const GET = route(async (request) => {
  const actor = await requireCustomer();
  const p = new URL(request.url).searchParams;
  const filters = Object.fromEntries(["kind", "direction", "from", "to", "q", "sort"].flatMap((k) => (p.get(k) ? [[k, p.get(k)!]] : [])));
  return privateJson(await walletEntries(getDb(), actor.customerId, Number(p.get("page") ?? 1) || 1, Number(p.get("pageSize") ?? 20) || 20, filters));
});
