import type { Metadata } from "next";
import { CampaignsHome } from "@/components/campaign/campaigns-home";
import { CampaignsPage } from "@/components/campaign/loader";

export const metadata: Metadata = { title: "Marketing Plans" };

export default function CampaignsRoute() {
  return <CampaignsPage render={(data) => <CampaignsHome data={data} />} />;
}
