/**
 * In-app notification categories, shared by the browser and the server. The
 * id list mirrors NOTIFICATION_KIND in `src/server/db/schema/enums.ts` (a test
 * keeps them in step). Every notification comes from a real account event.
 */

export const NOTIFICATION_KINDS = [
  { id: "order", label: "Orders" },
  { id: "support", label: "Support" },
  { id: "security", label: "Security" },
] as const;

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number]["id"];

export interface NotificationItem {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  at: string;
}

export interface NotificationPage {
  /** All unread notifications for the customer, regardless of filters. */
  unread: number;
  items: NotificationItem[];
  /** Pass back as `before` to load the next page; null when there are no more. */
  next: string | null;
}

/** "Just now", "5 min ago", "3 h ago", "Yesterday", "4 days ago", then a date. */
export function relativeTime(iso: string, now = Date.now()) {
  const at = new Date(iso);
  const s = Math.max(0, Math.round((now - at.getTime()) / 1000));
  if (s < 60) return "Just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86_400 && sameDay(at, new Date(now))) return `${Math.floor(s / 3600)} h ago`;
  const days = dayDiff(at, new Date(now));
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return at.toLocaleDateString(undefined, { day: "numeric", month: "short", year: at.getFullYear() === new Date(now).getFullYear() ? undefined : "numeric" });
}

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const dayDiff = (a: Date, b: Date) => Math.round((new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime() - new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime()) / 86_400_000);

/** Today / Yesterday / Earlier, in the viewer's own time zone. */
export function dayGroup(iso: string, now = Date.now()): "Today" | "Yesterday" | "Earlier" {
  const d = dayDiff(new Date(iso), new Date(now));
  return d <= 0 ? "Today" : d === 1 ? "Yesterday" : "Earlier";
}
