import type { Metadata } from "next";
import { Resolve } from "@/components/dashboard/resolve";
import { notFound } from "next/navigation";
import { AutomationDetail } from "@/components/social/automation-detail";
import { AutomationPage } from "@/components/social/loader";

export const metadata: Metadata = { title: "Automation" };

/** Only the signed-in customer's own automations are loaded; anything else is a 404. */
export default function AutomationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Resolve value={params}>
      {({ id }) => (
        <AutomationPage
          render={(data) => {
            const a = data.automations.find((x) => x.id === id);
            if (!a) notFound();
            return <AutomationDetail data={data} a={a} />;
          }}
        />
      )}
    </Resolve>
  );
}
