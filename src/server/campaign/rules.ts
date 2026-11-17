import "server-only";
import { and, eq } from "drizzle-orm";
import type { Executor } from "../db/client";
import { brands, campaigns } from "../db/schema";
import { errors } from "../errors";

/**
 * Campaign Planner (CP-01): content linked to a campaign that is for a brand must be for that same brand (or for
 * no brand). Called wherever a post's brand changes, so a linked draft can't drift to another brand.
 */
export async function assertBrandFitsCampaign(tx: Executor, customerId: string, campaignId: string | null, brandId: string | null | undefined) {
  if (!campaignId || !brandId) return;
  const [c] = await tx
    .select({ brandId: campaigns.brandId, name: campaigns.name, brandName: brands.name })
    .from(campaigns)
    .leftJoin(brands, eq(brands.id, campaigns.brandId))
    .where(and(eq(campaigns.id, campaignId), eq(campaigns.customerId, customerId)));
  if (c?.brandId && c.brandId !== brandId) throw errors.conflict(`This post is part of the marketing plan “${c.name}”, which is for ${c.brandName ?? "another brand"}. Remove it from the plan before giving it a different brand.`);
}
