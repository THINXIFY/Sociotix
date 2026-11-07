"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Popover } from "@base-ui/react/popover";
import { Bell, BellOff, Check, CheckCheck, LifeBuoy, type LucideIcon, Package, ShieldCheck } from "lucide-react";
import { api } from "@/lib/live-account";
import { type NotificationItem, type NotificationKind, type NotificationPage, relativeTime } from "@/lib/notifications";
import { cn } from "@/lib/utils";
import { popupSurface } from "@/components/ui/menu";

/* Live in-app notifications (5G-A, NT-01): the customer's own persisted notifications. Nothing here is sample data. */

export const NOTIFICATIONS_ROUTE = "/dashboard/notifications";
/** Fired after any read/unread change so the bell and the full page stay in step. */
export const NOTIFICATIONS_CHANGED = "sv-notifications-changed";

export const KIND_ICON: Record<NotificationKind, { Icon: LucideIcon; className: string }> = {
  order: { Icon: Package, className: "bg-primary/10 text-primary dark:bg-primary/20 dark:text-[#c9bcff]" },
  support: { Icon: LifeBuoy, className: "bg-lime/45 text-graphite dark:bg-lime/15 dark:text-lime" },
  security: { Icon: ShieldCheck, className: "bg-soon-soft text-soon" },
};

/** Marks notifications read or unread for the signed-in customer, then tells every open view. */
export async function setRead(body: { ids?: string[]; all?: boolean; read?: boolean }) {
  const page = await api<NotificationPage>("/api/account/notifications", { method: "POST", body: JSON.stringify(body) });
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));
  return page;
}

const iconButton =
  "relative grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none data-popup-open:bg-muted data-popup-open:text-foreground";

export function KindIcon({ kind, className }: { kind: NotificationKind; className?: string }) {
  const k = KIND_ICON[kind] ?? KIND_ICON.support;
  return (
    <span className={cn("grid size-8 shrink-0 place-items-center rounded-full", k.className, className)} aria-hidden>
      <k.Icon className="size-4" />
    </span>
  );
}

/** One notification: open it (marks it read and goes to its page) or mark it read without leaving. */
export function NotificationRow({ n, onOpen, onToggle, compact = false }: { n: NotificationItem; onOpen: () => void; onToggle: () => void; compact?: boolean }) {
  return (
    <div className={cn("group relative flex items-start gap-3 rounded-xl transition-colors hover:bg-muted/70", compact ? "px-2.5 py-2.5" : "px-3 py-3 sm:px-4")}>
      <KindIcon kind={n.kind} />
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-start outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-3 focus-visible:after:ring-primary/30">
        <span className={cn("block text-sm", n.read ? "font-medium text-foreground/70" : "font-semibold")}>{n.title}</span>
        {n.body ? <span className={cn("block text-xs leading-relaxed text-muted-foreground", compact && "line-clamp-2")}>{n.body}</span> : null}
        <span className="mt-1 block text-[0.7rem] text-muted-foreground/80">
          <time dateTime={n.at} title={new Date(n.at).toLocaleString()}>
            {relativeTime(n.at)}
          </time>
          {n.link ? <span className="sr-only">. Opens the details.</span> : null}
        </span>
      </button>
      <button
        type="button"
        onClick={onToggle}
        aria-label={n.read ? `Mark as unread: ${n.title}` : `Mark as read: ${n.title}`}
        title={n.read ? "Mark as unread" : "Mark as read"}
        className="relative z-10 -my-1 -me-1.5 grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-background hover:text-primary focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none sm:size-9"
      >
        {n.read ? <span className="size-2 rounded-full border border-muted-foreground/50" aria-hidden /> : <span className="grid size-5 place-items-center rounded-full bg-primary/10"><span className="size-2 rounded-full bg-primary group-hover:hidden" aria-hidden /><Check className="hidden size-3 text-primary group-hover:block" strokeWidth={3} aria-hidden /></span>}
      </button>
    </div>
  );
}

export function LiveNotifications() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [tab, setTab] = React.useState<"all" | "unread">("all");
  const [data, setData] = React.useState<NotificationPage | null>(null);
  const [failed, setFailed] = React.useState(false);

  const load = React.useCallback(() => {
    api<NotificationPage>(`/api/account/notifications?limit=8${tab === "unread" ? "&status=unread" : ""}`).then(
      (d) => {
        setData(d);
        setFailed(false);
      },
      () => setFailed(true),
    );
  }, [tab]);

  React.useEffect(() => {
    load();
    // A light refresh while the tab is visible, so a new reply or order update shows without a reload.
    const tick = () => document.visibilityState === "visible" && load();
    const id = window.setInterval(tick, 60_000);
    window.addEventListener(NOTIFICATIONS_CHANGED, load);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      window.removeEventListener(NOTIFICATIONS_CHANGED, load);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [load]);

  const unread = data?.unread ?? 0;
  const toggle = (n: NotificationItem) => void setRead({ ids: [n.id], read: !n.read }).catch(() => setFailed(true));
  const openOne = (n: NotificationItem) => {
    if (!n.read) void setRead({ ids: [n.id] }).catch(() => {});
    setOpen(false);
    router.push(n.link ?? NOTIFICATIONS_ROUTE);
  };

  return (
    <Popover.Root open={open} onOpenChange={(o) => (setOpen(o), o && load())}>
      <Popover.Trigger className={iconButton} aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}>
        <Bell className="size-[1.1rem]" aria-hidden />
        {unread ? <span className="absolute top-1 end-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[0.6rem] font-bold text-primary-foreground ring-2 ring-background tabular-nums">{unread > 9 ? "9+" : unread}</span> : null}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={8} collisionPadding={12} className="z-50">
          <Popover.Popup className={cn(popupSurface, "w-[min(24rem,calc(100vw-1.5rem))] overflow-hidden p-0 transition-[opacity,transform] duration-150 data-[ending-style]:scale-[0.98] data-[ending-style]:opacity-0 data-[starting-style]:scale-[0.98] data-[starting-style]:opacity-0 motion-reduce:transition-none")}>
            <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2">
              <Popover.Title className="font-heading text-[0.95rem] font-bold">Notifications</Popover.Title>
              <button type="button" disabled={!unread} onClick={() => void setRead({ all: true }).catch(() => setFailed(true))} className="inline-flex h-9 items-center gap-1 rounded-full px-2.5 text-xs font-semibold text-primary transition-colors hover:bg-secondary focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none disabled:pointer-events-none disabled:text-muted-foreground">
                <CheckCheck className="size-3.5" aria-hidden /> Mark all as read
              </button>
            </div>
            <div className="flex gap-1 border-b px-3 pb-2" role="group" aria-label="Show">
              {(["all", "unread"] as const).map((t) => (
                <button key={t} type="button" aria-pressed={tab === t} onClick={() => setTab(t)} className={cn("inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none", tab === t ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
                  {t === "all" ? "All" : "Unread"}
                  {t === "unread" && unread ? <span className={cn("rounded-full px-1.5 text-[0.65rem] tabular-nums", tab === t ? "bg-background/20" : "bg-primary/10 text-primary")}>{unread}</span> : null}
                </button>
              ))}
            </div>
            <div className="max-h-[min(24rem,60vh)] overflow-y-auto p-1.5" aria-live="polite">
              {failed && !data ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Notifications didn&apos;t load.{" "}
                  <button type="button" onClick={load} className="font-semibold text-primary hover:underline">
                    Try again
                  </button>
                </p>
              ) : !data ? (
                <div className="space-y-1.5 p-1.5" aria-busy="true">
                  <span className="sr-only">Loading notifications…</span>
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="flex gap-3 rounded-xl p-2">
                      <span className="size-8 animate-pulse rounded-full bg-muted motion-reduce:animate-none" />
                      <span className="flex-1 space-y-1.5 pt-1">
                        <span className="block h-2.5 w-3/4 animate-pulse rounded-full bg-muted motion-reduce:animate-none" />
                        <span className="block h-2 w-1/2 animate-pulse rounded-full bg-muted motion-reduce:animate-none" />
                      </span>
                    </div>
                  ))}
                </div>
              ) : data.items.length === 0 ? (
                <div className="flex flex-col items-center px-6 py-8 text-center">
                  <span className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground" aria-hidden>
                    <BellOff className="size-4.5" />
                  </span>
                  <p className="mt-3 text-sm font-semibold">{tab === "unread" ? "You're all caught up" : "No notifications yet"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Order updates, support replies and security alerts will appear here.</p>
                </div>
              ) : (
                <ul>
                  {data.items.map((n) => (
                    <li key={n.id}>
                      <NotificationRow n={n} compact onOpen={() => openOne(n)} onToggle={() => toggle(n)} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="border-t p-1.5">
              <Link href={NOTIFICATIONS_ROUTE} onClick={() => setOpen(false)} className="flex h-10 items-center justify-center rounded-xl text-sm font-semibold text-primary transition-colors hover:bg-secondary focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none">
                View all notifications
              </Link>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
