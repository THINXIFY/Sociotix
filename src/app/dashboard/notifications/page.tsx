import type { Metadata } from "next";
import { DemoGate } from "@/components/dashboard/demo-gate";
import { DemoNotificationsPage, LiveNotificationsPage } from "@/components/dashboard/notifications-page";

export const metadata: Metadata = { title: "Notifications" };

export default function NotificationsPage() {
  return (
    <DemoGate area="Notifications" live={<LiveNotificationsPage />}>
      <DemoNotificationsPage />
    </DemoGate>
  );
}
