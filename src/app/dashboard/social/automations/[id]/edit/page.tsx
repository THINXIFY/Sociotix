import type { Metadata } from "next";
import { Resolve } from "@/components/dashboard/resolve";
import { notFound } from "next/navigation";
import { AutomationBuilder } from "@/components/social/builder";
import { AutomationPage } from "@/components/social/loader";

export const metadata: Metadata = { title: "Edit automation" };

export default function EditAutomationPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Resolve value={params}>
      {({ id }) => (
        <AutomationPage
          render={(data) => {
            const a = data.automations.find((x) => x.id === id);
            if (!a) notFound();
            return <AutomationBuilder key={a.id + a.updatedAt} existing={a} template={null} />;
          }}
        />
      )}
    </Resolve>
  );
}
