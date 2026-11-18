import { connection } from "next/server";
import { checkWorker } from "@/server/health";
import { route } from "@/server/http";

/**
 * Worker liveness for uptime monitors (OPS-01A): 200 when a background worker has checked in within the last three
 * minutes, 503 otherwise. Kept separate from /api/health so a stopped worker never takes web instances out of a load
 * balancer. Returns only a one-word status.
 */
export const GET = route(async () => {
  await connection();
  const worker = await checkWorker();
  return Response.json({ worker }, { status: worker === "ok" ? 200 : 503, headers: { "cache-control": "no-store" } });
});
