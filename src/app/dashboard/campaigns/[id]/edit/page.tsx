import type { Metadata } from "next";
import { CampaignForm } from "@/components/campaign/campaign-form";
import { CampaignFormPage } from "@/components/campaign/loader";

export const metadata: Metadata = { title: "Edit marketing plan" };

export default function EditCampaignRoute({ params }: PageProps<"/dashboard/campaigns/[id]/edit">) {
  return <CampaignFormPage params={params} render={(data) => <CampaignForm key={data.campaign?.version} {...data} />} />;
}
