import type { Metadata } from "next";
import { PublishingPage } from "@/components/social/loader";
import { StartHere } from "@/components/social/start-here";

export const metadata: Metadata = { title: "Start here" };

export default function StartHerePage() {
  return <PublishingPage render={(data) => <StartHere data={data} />} />;
}
