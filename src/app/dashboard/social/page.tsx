import type { Metadata } from "next";
import { PublishingPage } from "@/components/social/loader";
import { SocialOverview } from "@/components/social/overview";

export const metadata: Metadata = { title: "Social workspace" };

export default function SocialOverviewPage() {
  // The publishing loader adds the customer's own posts, so the overview can count drafts and show what's coming up.
  return <PublishingPage render={(data) => <SocialOverview data={data} />} />;
}
