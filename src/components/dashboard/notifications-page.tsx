"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { BellOff, CheckCheck, CircleAlert, Search, X } from "lucide-react";
import { api } from "@/lib/live-account";
import { dayGroup, NOTIFICATION_KINDS, type NotificationItem, type NotificationKind, type NotificationPage } from "@/lib/notifications";
import { cn } from "@/lib/utils";
import { NOTIFICATIONS_CHANGED, NotificationRow, setRead } from "./live-notifications";
import { dashButton, Panel } from "./shared";

/* NT-01: every notification for the signed-in customer — searchable, filterable, grouped by day, loaded a page at a time. */

type Status = "all" | "unread";

const chip = (on: boolean) =>
  cn(
    "inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[0.82rem] font-semibold transition-colors focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none sm:h-9",
    on ? "border-foreground bg-foreground text-background" : "bg-card text-foreground/75 hover:border-primary/35 hover:text-foreground",
  );

export function LiveNotificationsPage() {
  const router = useRouter();
  const [status, setStatus] = React.useState<Status>("all");
  const [kind, setKind] = React.useState<NotificationKind | "">("");
  const [q, setQ] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [items, setItems] = React.useState<NotificationItem[] | null>(null);
  const [unread, setUnread] = React.useState(0);
  const [next, setNext] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loadingMore, setLoadingMore] = React.useState(false);

  // Search waits for a pause in typing.
  React.useEffect(() => {
    const id = window.setTimeout(() => setQuery(q.trim()), 300);
    return () => window.clearTimeout(id);
  }, [q]);

  const url = React.useCallback(
    (before?: string) => {
      const p = new URLSearchParams({ limit: "20" });
      if (status === "unread") p.set("status", "unread");
      if (kind) p.set("kind", kind);
      if (query) p.set("q", query);
      if (before) p.set("before", before);
      return `/api/account/notifications?${p}`;
    },
    [status, kind, query],
  );

  const load = React.useCallback(() => {
    api<NotificationPage>(url()).then(
      (d) => {
        setItems(d.items);
        setUnread(d.unread);
        setNext(d.next);
        setError(null);
      },
      (e: Error) => setError(e.message),
    );
  }, [url]);

  React.useEffect(() => {
    load();
    window.addEventListener(NOTIFICATIONS_CHANGED, load);
    return () => window.removeEventListener(NOTIFICATIONS_CHANGED, load);
  }, [load]);

  const more = async () => {
    if (!next) return;
    setLoadingMore(true);
    try {
      const d = await api<NotificationPage>(url(next));
      setItems((cur) => [...(cur ?? []), ...d.items.filter((n) => !cur?.some((c) => c.id === n.id))]);
      setNext(d.next);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingMore(false);
    }
  };

  const change = (body: { ids?: string[]; all?: boolean; read?: boolean }) => void setRead(body).catch((e: Error) => setError(e.message));
  const open = (n: NotificationItem) => {
    if (!n.read) change({ ids: [n.id] });
    if (n.link) router.push(n.link);
  };

  const filtered = status !== "all" || kind !== "" || query !== "";
  const groups = (["Today", "Yesterday", "Earlier"] as const).map((g) => ({ g, list: (items ?? []).filter((n) => dayGroup(n.at) === g) })).filter((x) => x.list.length);

  return (
    <div className="mx-auto max-w-4xl px-3 py-4 sm:px-6 sm:py-7 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-[1.6rem] leading-tight font-extrabold tracking-tight sm:text-[1.9rem]">Notifications</h1>
          <p className="mt-1 text-sm text-muted-foreground">{unread ? `${unread} unread.` : "You're all caught up."} Order updates, support replies and security alerts for your account.</p>
        </div>
        <button type="button" disabled={!unread} onClick={() => change({ all: true })} className={cn(dashButton.secondary, "h-11 disabled:pointer-events-none disabled:opacity-50 sm:h-10")}>
          <CheckCheck className="size-4" aria-hidden /> Mark all as read
        </button>
      </div>

      <div className="mt-5 flex flex-col gap-3">
        <label className="relative block">
          <span className="sr-only">Search notifications</span>
          <Search className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            maxLength={80}
            placeholder="Search notifications"
            className="h-11 w-full rounded-full border bg-card ps-10 pe-11 text-sm transition-[border-color,box-shadow] outline-none placeholder:text-muted-foreground/70 focus-visible:border-primary/60 focus-visible:ring-4 focus-visible:ring-primary/15 [&::-webkit-search-cancel-button]:hidden"
          />
          {q ? (
            <button type="button" onClick={() => setQ("")} aria-label="Clear search" className="absolute end-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
              <X className="size-4" aria-hidden />
            </button>
          ) : null}
        </label>
        <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
          <div className="flex gap-1.5" role="group" aria-label="Read status">
            {(["all", "unread"] as const).map((s) => (
              <button key={s} type="button" aria-pressed={status === s} onClick={() => setStatus(s)} className={chip(status === s)}>
                {s === "all" ? "All" : "Unread"}
              </button>
            ))}
          </div>
          <span className="my-1.5 w-px shrink-0 bg-border" aria-hidden />
          <div className="flex gap-1.5" role="group" aria-label="Category">
            <button type="button" aria-pressed={kind === ""} onClick={() => setKind("")} className={chip(kind === "")}>
              Every category
            </button>
            {NOTIFICATION_KINDS.map((k) => (
              <button key={k.id} type="button" aria-pressed={kind === k.id} onClick={() => setKind(k.id)} className={chip(kind === k.id)}>
                {k.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5" aria-live="polite">
        {error && !items ? (
          <Panel className="flex flex-col items-center px-6 py-12 text-center" role="alert">
            <CircleAlert className="size-6 text-destructive" aria-hidden />
            <p className="mt-3 font-semibold">Notifications didn&apos;t load</p>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
            <button type="button" onClick={load} className={cn(dashButton.secondary, "mt-4 h-11 sm:h-10")}>
              Try again
            </button>
          </Panel>
        ) : !items ? (
          <Panel className="space-y-1 p-2" aria-busy="true">
            <span className="sr-only">Loading notifications…</span>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3 p-3">
                <span className="size-8 animate-pulse rounded-full bg-muted motion-reduce:animate-none" />
                <span className="flex-1 space-y-2 pt-1">
                  <span className="block h-3 w-2/3 animate-pulse rounded-full bg-muted motion-reduce:animate-none" />
                  <span className="block h-2.5 w-1/3 animate-pulse rounded-full bg-muted motion-reduce:animate-none" />
                </span>
              </div>
            ))}
          </Panel>
        ) : items.length === 0 ? (
          <Panel className="flex flex-col items-center px-6 py-14 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground" aria-hidden>
              <BellOff className="size-5" />
            </span>
            <p className="mt-3 font-heading font-bold">{filtered ? "Nothing matches these filters" : "No notifications yet"}</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">{filtered ? "Try another category or search, or show every notification." : "When an order changes, our team replies to a ticket or your password changes, you'll see it here."}</p>
            {filtered ? (
              <button type="button" onClick={() => (setStatus("all"), setKind(""), setQ(""))} className={cn(dashButton.secondary, "mt-4 h-11 sm:h-10")}>
                Show all notifications
              </button>
            ) : null}
          </Panel>
        ) : (
          <div className="space-y-5">
            {groups.map(({ g, list }) => (
              <section key={g} aria-labelledby={`notif-${g}`}>
                <h2 id={`notif-${g}`} className="mb-2 px-1 text-[0.72rem] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                  {g}
                </h2>
                <Panel className="p-1.5">
                  <ul className="divide-y divide-border/60">
                    {list.map((n) => (
                      <li key={n.id} className={cn(!n.read && "[&>div]:bg-primary/[0.035] dark:[&>div]:bg-primary/[0.08]")}>
                        <NotificationRow n={n} onOpen={() => open(n)} onToggle={() => change({ ids: [n.id], read: !n.read })} />
                      </li>
                    ))}
                  </ul>
                </Panel>
              </section>
            ))}
            {error ? (
              <p role="alert" className="text-center text-sm text-destructive">
                {error}
              </p>
            ) : null}
            {next ? (
              <div className="flex justify-center">
                <button type="button" onClick={() => void more()} disabled={loadingMore} aria-busy={loadingMore} className={cn(dashButton.secondary, "h-11 sm:h-10")}>
                  {loadingMore ? "Loading…" : "Load more"}
                </button>
              </div>
            ) : (
              <p className="text-center text-xs text-muted-foreground">That&apos;s everything.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Demo mode: the bell shows illustrative activity; real notifications need a live account. */
export function DemoNotificationsPage() {
  return (
    <div className="mx-auto max-w-4xl px-3 py-4 sm:px-6 sm:py-7 lg:px-8">
      <h1 className="font-heading text-[1.6rem] leading-tight font-extrabold tracking-tight sm:text-[1.9rem]">Notifications</h1>
      <Panel className="mt-5 flex flex-col items-center px-6 py-14 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground" aria-hidden>
          <BellOff className="size-5" />
        </span>
        <p className="mt-3 font-heading font-bold">Notifications appear here for live accounts</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">This is the demo dashboard, so nothing real has happened yet. Sample activity is in the bell at the top of the page.</p>
      </Panel>
    </div>
  );
}
