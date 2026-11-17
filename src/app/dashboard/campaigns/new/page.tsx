import type { Metadata } from "next";
import { CampaignForm } from "@/components/campaign/campaign-form";
import { CampaignFormPage } from "@/components/campaign/loader";

export const metadata: Metadata = { title: "New marketing plan" };

export default function NewCampaignRoute({ searchParams }: PageProps<"/dashboard/campaigns/new">) {
  return <CampaignFormPage searchParams={searchParams} render={(data, q) => <CampaignForm {...data} templateId={q.template} />} />;
}
