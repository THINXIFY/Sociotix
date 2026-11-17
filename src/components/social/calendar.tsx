"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, Flag, Folder, ImageIcon, Library, PenLine, Trash2 } from "lucide-react";
import { BrandChip, BrandSelect } from "@/components/brand/brand-parts";
import { Panel, useHydrated } from "@/components/dashboard/shared";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { CONTENT_ROUTES, MEDIA_PER_POST_MAX, type MediaView } from "@/lib/social/content";
import { SOCIAL_PLATFORM, type SocialProviderId } from "@/lib/social/platforms";
import { postHref, PUBLISHING_ROUTES, type PostView, type PublishingData } from "@/lib/social/publishing";
import { browserTimeZone, dayKey, utcToZonedInput } from "@/lib/social/time";
import { cn } from "@/lib/utils";
import { PageGuide } from "@/components/dashboard/page-guide";
import { campaignHref, type CampaignSummary } from "@/lib/campaign";
import { MediaPicker, MediaThumb } from "./content-parts";
import { ContentPicker, plannable } from "./content-picker";
import { page, primaryButton, quietButton, SocialHeader, SocialTile } from "./parts";
import { EmptyIllustration, PlatformStack, postsApi, StateBadge, stateDot } from "./publishing-parts";

/* Content calendar (AI-07): planned and scheduled posts by day, in the customer's own time zone. */

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const pad = (n: number) => String(n).padStart(2, "0");
const keyOf = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
/** Monday-based weekday (0 = Monday) of a plain calendar date. */
const weekday = (y: number, m: number, d: number) => (new Date(Date.UTC(y, m, d)).getUTCDay() + 6) % 7;
const addDays = (key: string, n: number) => {
  const [y, m, d] = key.split("-").map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return keyOf(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate());
};
const monthLabel = (y: number, m: number) => new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(Date.UTC(y, m, 1));
const dayLabel = (key: string, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-US", { ...opts, timeZone: "UTC" }).format(Date.parse(`${key}T00:00:00Z`));
const timeIn = (iso: string, tz: string) => new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz }).format(Date.parse(iso));

type Item = { post: PostView; when: string; day: string };
const headline = (p: PostView) => p.title?.trim() || p.text.trim().split("\n")[0]?.slice(0, 60) || "Untitled post";

/* Campaign Planner (CP-01): campaign milestones and start/end dates, shown as flags that link to the campaign. They are plain dates (no time zone) and never posts. */
type CampaignEvent = { key: string; day: string; label: string; kind: "milestone" | "start" | "end"; campaign: CampaignSummary; done?: boolean };

function campaignEvents(campaigns: CampaignSummary[]): CampaignEvent[] {
  return campaigns
    .filter((c) => c.status !== "archived")
    .flatMap((c) => [
      ...(c.startDate ? [{ key: `${c.id}-start`, day: c.startDate, label: `${c.name} starts`, kind: "start" as const, campaign: c }] : []),
      ...(c.endDate ? [{ key: `${c.id}-end`, day: c.endDate, label: `${c.name} ends`, kind: "end" as const, campaign: c }] : []),
      ...c.milestones.filter((m) => m.dueDate).map((m) => ({ key: m.id, day: m.dueDate!, label: m.title, kind: "milestone" as const, campaign: c, done: m.done })),
    ]);
}

function EventChip({ e, large }: { e: CampaignEvent; large?: boolean }) {
  const what = e.kind === "milestone" ? `Stage${e.done ? " (done)" : ""} in ${e.campaign.name}` : "Marketing plan date";
  return (
    <Link
      href={campaignHref(e.campaign.id, e.kind === "milestone" ? "tasks" : undefined)}
      title={`${what}: ${e.label}`}
      className={cn(
        "flex w-full min-w-0 items-center gap-1.5 rounded-lg border border-dashed border-lime-600/50 bg-lime/25 text-start font-medium text-[#2c3a00] transition-colors hover:bg-lime/45 focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none dark:border-lime/40 dark:bg-lime/10 dark:text-lime",
        large ? "rounded-2xl px-3.5 py-3 text-[0.85rem]" : "px-1.5 py-1 text-[0.7rem]",
      )}
    >
      <Flag className={cn("shrink-0", large ? "size-4" : "size-3")} aria-hidden />
      <span className="sr-only">{what}: </span>
      <span className={cn("min-w-0 truncate", e.done && "line-through opacity-70")}>{e.label}</span>
      {large ? <span className="ms-auto shrink-0 truncate text-[0.72rem] font-normal opacity-80">{e.kind === "milestone" ? e.campaign.name : "Plan"}</span> : null}
    </Link>
  );
}

function Chip({ item, tz, onOpen }: { item: Item; tz: string; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="group flex w-full min-w-0 items-center gap-1.5 rounded-lg border bg-card px-1.5 py-1 text-start text-[0.7rem] transition-[border-color,background-color] hover:border-primary/40 hover:bg-primary/[0.04] focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none dark:bg-white/[0.03]">
      <span className={cn("size-1.5 shrink-0 rounded-full", stateDot(item.post.state))} aria-hidden />
      <span className="shrink-0 font-semibold tabular-nums text-muted-foreground">{timeIn(item.when, tz)}</span>
      <span className="min-w-0 truncate font-medium group-hover:text-primary">{headline(item.post)}</span>
    </button>
  );
}

export function PublishingCalendar({ data }: { data: PublishingData }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const tz = hydrated ? browserTimeZone() : "UTC";
  const today = hydrated ? dayKey(new Date().toISOString(), tz) : null;
  const [view, setView] = React.useState<"month" | "week" | "list">("month");
  const [cursor, setCursor] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<SocialProviderId | "all">("all");
  const [open, setOpen] = React.useState<PostView | null>(null);
  const [date, setDate] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // CM-02: the content picker, notices, and image editing for a planned draft.
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [mediaOpen, setMediaOpen] = React.useState(false);
  const [mediaDraft, setMediaDraft] = React.useState<string[]>([]);
  const [library, setLibrary] = React.useState<MediaView[]>(data.content.media);
  const canPlan = data.posts.some(plannable);
  const [showEvents, setShowEvents] = React.useState(true);
  const allEvents = campaignEvents(data.content.campaigns);
  const eventsByDay = new Map<string, CampaignEvent[]>();
  if (showEvents) for (const e of allEvents) eventsByDay.set(e.day, [...(eventsByDay.get(e.day) ?? []), e]);

  const anchor = cursor ?? today ?? "2026-01-01";
  const [ay, am] = anchor.split("-").map(Number) as [number, number];
  const items: Item[] = data.posts
    .map((p) => ({ post: p, when: p.scheduledAt ?? p.plannedAt }))
    .filter((x): x is { post: PostView; when: string } => !!x.when)
    .filter((x) => filter === "all" || x.post.providers.includes(filter))
    .map((x) => ({ ...x, day: dayKey(x.when, tz) }))
    .sort((a, b) => a.when.localeCompare(b.when));
  const byDay = new Map<string, Item[]>();
  for (const it of items) byDay.set(it.day, [...(byDay.get(it.day) ?? []), it]);

  // Visible days: a 6-week month grid or the 7 days of the anchor's week.
  const firstOfMonth = keyOf(ay, am - 1, 1);
  const gridStart = addDays(firstOfMonth, -weekday(ay, am - 1, 1));
  const weekStart = addDays(anchor, -weekday(ay, am - 1, Number(anchor.slice(8, 10))));
  const inMonth = (k: string) => k.slice(0, 7) === firstOfMonth.slice(0, 7);
  // List shows the whole month as an agenda, so it moves month by month like the grid.
  const days = view === "week" ? Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)) : Array.from({ length: 42 }, (_, i) => addDays(gridStart, i)).filter((d) => view === "month" || inMonth(d));
  const visibleItems = days.flatMap((d) => byDay.get(d) ?? []);
  const visibleEvents = days.flatMap((d) => eventsByDay.get(d) ?? []);
  const agendaDays = days.filter((d) => byDay.has(d) || eventsByDay.has(d));
  const providersUsed = [...new Set(data.posts.flatMap((p) => p.providers))];

  const move = (dir: -1 | 1) => {
    if (view === "week") return setCursor(addDays(anchor, dir * 7));
    const t = new Date(Date.UTC(ay, am - 1 + dir, 1));
    setCursor(keyOf(t.getUTCFullYear(), t.getUTCMonth(), 1));
  };
  const title = view !== "week" ? monthLabel(ay, am - 1) : `${dayLabel(days[0]!, { month: "short", day: "numeric" })} – ${dayLabel(days[6]!, { month: "short", day: "numeric", year: "numeric" })}`;

  function openPost(p: PostView) {
    setOpen(p);
    setError(null);
    setMediaDraft(p.mediaIds);
    setDate(p.plannedAt ? utcToZonedInput(p.plannedAt, tz) : "");
  }
  /** Plans (or re-plans, or clears) the existing post. Only its date changes: its text, images and version are untouched, and nothing is posted. */
  async function savePlanned(clear = false) {
    if (!open || busy) return;
    setBusy(true);
    setError(null);
    const local = clear ? null : date || null;
    const r = await postsApi(`/api/content/posts/${open.id}/flags`, { method: "PATCH", body: JSON.stringify({ plannedLocal: local, ...(local ? { timezone: tz } : {}) }) });
    setBusy(false);
    if (!r.ok) return setError(r.message);
    setNotice(local ? "Planned date saved. Nothing will be posted." : "Removed from your calendar. The draft is still in your Content Library.");
    setOpen(null);
    router.refresh();
  }

  /** Changes (or clears) the open post's brand. Its text, images, date and version are untouched. */
  async function saveBrand(brandId: string | null) {
    if (!open || busy) return;
    setBusy(true);
    setError(null);
    const r = await postsApi(`/api/content/posts/${open.id}/flags`, { method: "PATCH", body: JSON.stringify({ brandId }) });
    setBusy(false);
    if (!r.ok) return setError(r.message);
    setOpen({ ...open, brandId });
    setNotice(brandId ? "Brand updated." : "Brand removed from this post.");
    router.refresh();
  }

  /** Saves the chosen library images on the open draft (order kept). Needs the version last seen, so a stale tab can't overwrite newer work. */
  async function saveMedia() {
    if (!open) return;
    const same = mediaDraft.length === open.mediaIds.length && mediaDraft.every((id, i) => id === open.mediaIds[i]);
    if (same) return;
    setBusy(true);
    setError(null);
    const r = await postsApi<{ version: number; mediaIds: string[] }>(`/api/content/posts/${open.id}/media`, { method: "PATCH", body: JSON.stringify({ mediaIds: mediaDraft, expectedVersion: open.version }) });
    setBusy(false);
    if (!r.ok) {
      setMediaDraft(open.mediaIds);
      return setError(r.message);
    }
    setOpen({ ...open, mediaIds: r.data.mediaIds, version: r.data.version });
    setNotice("Images updated.");
    router.refresh();
  }

  return (
    <div className={page}>
      <SocialHeader
        title="Calendar"
        subtitle="See what's planned and when — by month, week or as a list."
        guide={
          <PageGuide
            id="calendar"
            open={!data.posts.some((p) => p.plannedAt || p.scheduledAt)}
            steps={[
              { title: "Add a post", body: "Click “Add from library” and pick a draft, or write a new post." },
              { title: "Pick a date", body: "Choose the day and time. It's just a plan: nothing is posted for you." },
              { title: "Move things around", body: "Click any post to change its date, brand or images. Flags show your marketing plan dates." },
            ]}
          />
        }
        action={
          <div className="flex flex-wrap gap-2">
            <button type="button" className={quietButton} onClick={() => setPickerOpen(true)}>
              <Library className="size-4" aria-hidden /> Add from library
            </button>
            <Link href={PUBLISHING_ROUTES.compose} className={primaryButton}>
              <PenLine className="size-4" aria-hidden /> New post
            </Link>
          </div>
        }
      />

      {notice ? (
        <p role="status" className="mt-5 flex items-start justify-between gap-3 rounded-2xl bg-ok-soft px-4 py-3 text-sm font-medium text-ok">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="shrink-0 rounded-full px-1 text-xs font-semibold underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-current">
            Dismiss
          </button>
        </p>
      ) : null}

      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-full border bg-card p-1">
            <button type="button" onClick={() => move(-1)} className="grid size-10 place-items-center rounded-full hover:bg-muted focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none sm:size-8" aria-label={view === "week" ? "Previous week" : "Previous month"}>
              <ChevronLeft className="size-4" aria-hidden />
            </button>
            <button type="button" onClick={() => setCursor(null)} className="h-10 rounded-full px-3 text-[0.78rem] font-semibold hover:bg-muted focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none sm:h-8">
              Today
            </button>
            <button type="button" onClick={() => move(1)} className="grid size-10 place-items-center rounded-full hover:bg-muted focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none sm:size-8" aria-label={view === "week" ? "Next week" : "Next month"}>
              <ChevronRight className="size-4" aria-hidden />
            </button>
          </div>
          <h2 className="font-heading text-lg font-bold" aria-live="polite">
            {hydrated ? title : " "}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {providersUsed.length > 1 ? (
            <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by platform">
              {(["all", ...providersUsed] as const).map((p) => (
                <button key={p} type="button" aria-pressed={filter === p} onClick={() => setFilter(p)} className={cn("inline-flex h-10 items-center gap-1.5 rounded-full border px-2.5 text-[0.75rem] font-semibold sm:h-8", filter === p ? "border-transparent bg-graphite text-white dark:bg-white dark:text-graphite" : "bg-card text-muted-foreground hover:text-foreground")}>
                  {p === "all" ? "All" : <SocialTile provider={p} size="xs" className="size-4 rounded [&_svg]:size-2.5" />}
                  {p === "all" ? null : SOCIAL_PLATFORM[p].name}
                </button>
              ))}
            </div>
          ) : null}
          {allEvents.length ? (
            <button type="button" aria-pressed={showEvents} onClick={() => setShowEvents(!showEvents)} className={cn("inline-flex h-10 items-center gap-1.5 rounded-full border px-3 text-[0.75rem] font-semibold transition-colors focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none sm:h-8", showEvents ? "border-lime-600/50 bg-lime/30 text-[#2c3a00] dark:bg-lime/15 dark:text-lime" : "bg-card text-muted-foreground hover:text-foreground")}>
              <Flag className="size-3.5" aria-hidden /> Plan dates
            </button>
          ) : null}
          <div className="flex rounded-full border bg-card p-1" role="group" aria-label="Calendar view">
            {(["month", "week", "list"] as const).map((v) => (
              <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={cn("h-10 rounded-full px-3.5 text-[0.78rem] font-semibold capitalize transition-colors focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none sm:h-8", view === v ? "bg-graphite text-white dark:bg-white dark:text-graphite" : "text-muted-foreground hover:text-foreground")}>
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>
      <p className="mt-2 text-[0.75rem] text-muted-foreground">Times shown in {hydrated ? tz : "your time zone"}.{allEvents.length && showEvents ? " Flags are dates from your marketing plans, not posts." : ""}</p>

      {!hydrated ? (
        <div className="mt-4 h-[36rem] animate-pulse rounded-3xl bg-muted motion-reduce:animate-none" aria-busy="true" />
      ) : (
        <>
          {/* Desktop/tablet grid */}
          <Panel className={cn("mt-4 hidden overflow-hidden", view !== "list" && "md:block")}>
            <div className="grid grid-cols-7 border-b bg-subtle/60 dark:bg-white/[0.02]">
              {WEEKDAYS.map((d) => (
                <p key={d} className="px-2.5 py-2 text-[0.7rem] font-bold tracking-[0.1em] text-muted-foreground uppercase">
                  {d}
                </p>
              ))}
            </div>
            <div className={cn("grid grid-cols-7", view === "month" ? "auto-rows-[minmax(6.5rem,1fr)]" : "auto-rows-[minmax(22rem,1fr)]")}>
              {days.map((d) => {
                const list = byDay.get(d) ?? [];
                const isToday = d === today;
                const max = view === "month" ? 3 : 12;
                return (
                  <div key={d} className={cn("min-w-0 border-e border-b p-1.5 [&:nth-child(7n)]:border-e-0", view === "month" && !inMonth(d) && "bg-subtle/40 dark:bg-white/[0.01]")}>
                    <p className={cn("mb-1 inline-grid size-6 place-items-center rounded-full text-[0.72rem] font-semibold tabular-nums", isToday ? "bg-primary text-primary-foreground" : view === "month" && !inMonth(d) ? "text-muted-foreground" : "text-foreground")}>
                      <span className="sr-only">{dayLabel(d, { weekday: "long", month: "long", day: "numeric" })}</span>
                      <span aria-hidden>{Number(d.slice(8, 10))}</span>
                    </p>
                    <ul className="space-y-1">
                      {(eventsByDay.get(d) ?? []).slice(0, view === "month" ? 2 : 8).map((e) => (
                        <li key={e.key}>
                          <EventChip e={e} />
                        </li>
                      ))}
                      {(eventsByDay.get(d)?.length ?? 0) > (view === "month" ? 2 : 8) ? <li className="px-1.5 text-[0.68rem] font-semibold text-muted-foreground">+{eventsByDay.get(d)!.length - (view === "month" ? 2 : 8)} plan dates</li> : null}
                      {list.slice(0, max).map((it) => (
                        <li key={it.post.id}>
                          <Chip item={it} tz={tz} onOpen={() => openPost(it.post)} />
                        </li>
                      ))}
                      {list.length > max ? <li className="px-1.5 text-[0.68rem] font-semibold text-muted-foreground">+{list.length - max} more</li> : null}
                    </ul>
                  </div>
                );
              })}
            </div>
          </Panel>

          {/* Agenda: phones always, and the List view at every size */}
          <div className={cn("mt-4", view !== "list" && "md:hidden")}>
            {visibleItems.length || visibleEvents.length ? (
              <ol className="space-y-4">
                {agendaDays.map((d) => (
                  <li key={d}>
                    <p className="mb-1.5 text-[0.72rem] font-bold tracking-[0.1em] text-muted-foreground uppercase">{d === today ? "Today" : dayLabel(d, { weekday: "short", month: "short", day: "numeric" })}</p>
                    <ul className="space-y-1.5">
                      {(eventsByDay.get(d) ?? []).map((e) => (
                        <li key={e.key}>
                          <EventChip e={e} large />
                        </li>
                      ))}
                      {(byDay.get(d) ?? []).map((it) => (
                        <li key={it.post.id}>
                          <button type="button" onClick={() => openPost(it.post)} className="flex w-full items-center gap-3 rounded-2xl border bg-card px-3.5 py-3 text-start transition-colors hover:border-primary/35 focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none">
                            <span className="w-14 shrink-0 text-[0.75rem] font-semibold tabular-nums text-muted-foreground">{timeIn(it.when, tz)}</span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[0.85rem] font-semibold">{headline(it.post)}</span>
                              <span className="mt-1 flex items-center gap-2">
                                <PlatformStack providers={it.post.providers} max={3} />
                              </span>
                            </span>
                            <StateBadge state={it.post.state} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
            ) : null}
          </div>

          {!items.length && !visibleEvents.length ? (
            <Panel className="mt-4 flex flex-col items-center px-6 py-10 text-center">
              <EmptyIllustration icon={CalendarDays} />
              <h2 className="mt-4 font-heading text-lg font-bold">Nothing planned yet</h2>
              <p className="mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground">Give a draft a planned date and it appears here. Planning never posts anything — it just keeps your month organised.</p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {canPlan ? (
                  <button type="button" className={primaryButton} onClick={() => setPickerOpen(true)}>
                    <CalendarPlus className="size-4" aria-hidden /> Plan a saved draft
                  </button>
                ) : null}
                <Link href={PUBLISHING_ROUTES.compose} className={quietButton}>
                  <PenLine className="size-4" aria-hidden /> Write a new post
                </Link>
              </div>
            </Panel>
          ) : !visibleItems.length && !visibleEvents.length ? (
            <p className={cn("mt-4 rounded-2xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground", view !== "list" && "md:hidden")}>Nothing planned in this {view === "week" ? "week" : "month"}.</p>
          ) : null}
        </>
      )}

      <ContentPicker
        key={`picker-${pickerOpen}`}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        posts={data.posts}
        folders={data.content.folders}
        tz={tz}
        onPlanned={(m) => {
          setNotice(m);
          router.refresh();
        }}
      />

      <MediaPicker
        open={mediaOpen}
        onOpenChange={(o) => {
          setMediaOpen(o);
          if (!o) void saveMedia();
        }}
        library={library}
        onLibraryChange={setLibrary}
        selected={mediaDraft}
        onChange={setMediaDraft}
        max={MEDIA_PER_POST_MAX}
      />

      <Dialog open={open !== null} onOpenChange={(o) => !o && !mediaOpen && setOpen(null)}>
        <DialogContent className="gap-0 p-0 sm:max-w-md">
          {open ? (
            <>
              <div className="space-y-4 p-6">
                <div className="flex items-start gap-3 pe-6">
                  <div className="min-w-0 flex-1">
                    <DialogTitle className="font-heading text-lg leading-snug font-bold">{headline(open)}</DialogTitle>
                    <DialogDescription className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                      <PlatformStack providers={open.providers} />
                    </DialogDescription>
                  </div>
                  <StateBadge state={open.state} />
                </div>
                {(() => {
                  const camp = open.campaignId ? data.content.campaigns.find((x) => x.id === open.campaignId) : undefined;
                  return camp ? (
                    <p className="flex items-center gap-1.5 text-[0.8rem]">
                      <Flag className="size-3.5 text-primary" aria-hidden /> Part of the plan{" "}
                      <Link href={campaignHref(camp.id, "content")} className="min-w-0 truncate font-semibold text-primary hover:underline">
                        {camp.name}
                      </Link>
                    </p>
                  ) : null;
                })()}
                <p className="line-clamp-4 rounded-2xl bg-muted/50 px-3.5 py-3 text-[0.85rem] whitespace-pre-wrap dark:bg-white/[0.03]">{open.text || "No text yet."}</p>
                {open.hashtags.length ? <p className="text-[0.78rem] break-words text-primary dark:text-[#c4b5ff]">{open.hashtags.map((t) => `#${t}`).join(" ")}</p> : null}
                {data.content.brands.length ? (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <label htmlFor="calendar-brand" className="text-[0.78rem] font-semibold">
                      Brand
                    </label>
                    {open.status === "draft" || open.status === "cancelled" ? (
                      <BrandSelect id="calendar-brand" brands={data.content.brands} value={open.brandId} onChange={(v) => void saveBrand(v)} disabled={busy} className="h-9 w-auto max-w-full min-w-0 flex-1 basis-44 rounded-full py-0 text-[0.82rem]" />
                    ) : (
                      <span id="calendar-brand">{(() => { const b = data.content.brands.find((x) => x.id === open.brandId); return b ? <BrandChip brand={b} className="max-w-60" /> : <span className="text-[0.78rem] text-muted-foreground">No brand</span>; })()}</span>
                    )}
                  </div>
                ) : null}
                {(() => {
                  const editable = open.status === "draft" || open.status === "cancelled";
                  const folder = data.content.folders.find((fo) => fo.id === open.folderId);
                  return (
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="flex items-center gap-1.5 text-[0.78rem] font-semibold">
                          <ImageIcon className="size-3.5 text-muted-foreground" aria-hidden /> Images
                          {folder ? (
                            <span className="ms-2 inline-flex items-center gap-1 font-normal text-muted-foreground">
                              <Folder className="size-3" aria-hidden /> {folder.name}
                            </span>
                          ) : null}
                        </p>
                        {editable ? (
                          <button type="button" className="text-[0.78rem] font-semibold text-primary outline-none hover:underline focus-visible:underline disabled:opacity-50" disabled={busy || mediaOpen} onClick={() => { setMediaDraft(open.mediaIds); setMediaOpen(true); }}>
                            {open.mediaIds.length ? "Change images" : "Add images"}
                          </button>
                        ) : null}
                      </div>
                      {open.mediaIds.length ? (
                        <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Attached images">
                          {open.mediaIds.map((id, i) => (
                            <li key={id} className="size-14 overflow-hidden rounded-xl border bg-muted">
                              <MediaThumb id={id} name={`Image ${i + 1}`} />
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-1.5 text-[0.75rem] text-muted-foreground">No images attached.</p>
                      )}
                    </div>
                  );
                })()}
                {open.status === "draft" || open.status === "cancelled" ? (
                  <label className="block">
                    <span className="text-[0.78rem] font-semibold">Planned date</span>
                    <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1.5 w-full rounded-2xl border bg-background px-3.5 py-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-primary/20" />
                    <span className="mt-1 block text-[0.72rem] text-muted-foreground">Time zone: {tz}. Changing the plan never posts anything.</span>
                  </label>
                ) : (
                  <ul className="space-y-1.5 text-[0.8rem]">
                    {open.targets.map((t) => (
                      <li key={t.id} className="flex items-center gap-2">
                        <SocialTile provider={t.provider} size="xs" /> {t.accountName}
                        <span className="ms-auto text-muted-foreground">{t.status.replace("_", " ")}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {error ? (
                  <p role="alert" className="rounded-xl bg-destructive/[0.07] px-3 py-2 text-sm text-destructive">
                    {error}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap justify-end gap-2 border-t bg-muted/40 px-6 py-4">
                <Link href={postHref(open.id)} className={quietButton}>
                  <PenLine className="size-4" aria-hidden /> Open in editor
                </Link>
                <Link href={CONTENT_ROUTES.library} className={quietButton}>
                  <Library className="size-4" aria-hidden /> Content Library
                </Link>
                {open.status === "draft" || open.status === "cancelled" ? (
                  <>
                    {open.plannedAt ? (
                      <button type="button" className={quietButton} onClick={() => void savePlanned(true)} disabled={busy}>
                        <Trash2 className="size-4" aria-hidden /> Remove from calendar
                      </button>
                    ) : null}
                    <button type="button" className={primaryButton} onClick={() => void savePlanned()} disabled={busy || !date}>
                      {busy ? "Saving…" : "Save date"}
                    </button>
                  </>
                ) : null}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
