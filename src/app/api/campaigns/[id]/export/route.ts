import { requireCustomer } from "@/server/auth";
import { exportCampaign } from "@/server/campaign";
import { getDb } from "@/server/db/client";
import { route } from "@/server/http";

/** CSV of the campaign's milestones, tasks and linked content. Owner only; nothing is cached. */
export const GET = route<{ params: Promise<{ id: string }> }>(async (_request, { params }) => {
  const actor = await requireCustomer();
  const { csv, filename } = await exportCampaign(getDb(), actor.customerId, (await params).id);
  return new Response(`\uFEFF${csv}`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
});
