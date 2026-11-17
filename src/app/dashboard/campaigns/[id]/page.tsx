import type { Metadata } from "next";
import { CampaignDetail } from "@/components/campaign/campaign-detail";
import { CampaignDetailPage } from "@/components/campaign/loader";

export const metadata: Metadata = { title: "Marketing plan" };

export default function CampaignRoute({ params, searchParams }: PageProps<"/dashboard/campaigns/[id]">) {
  return <CampaignDetailPage params={params} searchParams={searchParams} render={(data, q) => <CampaignDetail data={data} initialTab={q.tab} />} />;
}
