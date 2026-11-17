import type { Metadata } from "next";
import { Resolve } from "@/components/dashboard/resolve";
import { AutomationBuilder } from "@/components/social/builder";
import { AutomationPage } from "@/components/social/loader";
import { TEMPLATES } from "@/lib/social/automations";

export const metadata: Metadata = { title: "Create automation" };

export default function NewAutomationPage({ searchParams }: { searchParams: Promise<{ template?: string }> }) {
  return (
    <Resolve value={searchParams}>
      {({ template }) => {
        const t = TEMPLATES.find((x) => x.id === template) ?? null;
        return <AutomationPage render={() => <AutomationBuilder key={t?.id ?? "blank"} existing={null} template={t} />} />;
      }}
    </Resolve>
  );
}
