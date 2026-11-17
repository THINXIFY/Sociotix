"use client";

import * as React from "react";
import Link from "next/link";
import { Menu } from "@base-ui/react/menu";
import { Archive, ArchiveRestore, CalendarClock, CircleAlert, Copy, Flag, LayoutGrid, LayoutTemplate, List, ListChecks, MoreHorizontal, Pencil, Plus, Rocket, Search, Trash2 } from "lucide-react";
import { BrandChip } from "@/components/brand/brand-parts";
import { ConfirmDialog } from "@/components/dashboard/account-ui";
import { useHydrated } from "@/components/dashboard/shared";
import { EmptyIllustration } from "@/components/social/publishing-parts";
import { eyebrow, page, primaryButton, quietButton } from "@/components/social/parts";
import { menuItem, menuItemDestructive, menuPopup } from "@/components/ui/menu";
import type { BrandSummary } from "@/lib/brand";
import {
  CAMPAIGN_NAME_MAX,
  CAMPAIGN_ROUTES,
  CAMPAIGN_STATUSES,
  CAMPAIGNS_MAX,
  campaignEditHref,
  campaignHref,
  dueState,
  formatDate,
  formatRange,
  localToday,
  daysBetween,
  OBJECTIVE_LABEL,
  PLAN_NAME,
  STATUS_LABEL,
  statusNote,
  stepCount,
  type CampaignStatus,
  type CampaignSummary,
  type CampaignTemplateView,
} from "@/lib/campaign";
import { SOCIAL_PLATFORM, SOCIAL_PROVIDER_IDS, type SocialProviderId } from "@/lib/social/platforms";
import { cn } from "@/lib/utils";
import { PageGuide } from "@/components/dashboard/page-guide";
import { compactField, DialogFrame, field, json, label, NoticeBar, Progress, StatusBadge, useAction } from "./campaign-parts";
import type { HomeData } from "./loader";

type DateFilter = "any" | "now" | "upcoming" | "past" | "undated";
const DATE_FILTERS: Record<DateFilter, string> = { any: "Any dates", now: "Running now", upcoming: "Starting later", past: "Ended", undated: "No dates" };

function matchesDate(c: CampaignSummary, f: DateFilter, today: string | null) {
  if (f === "any") return true;
  if (f === "undated") return !c.startDate && !c.endDate;
  if (!today) return true;
  if (f === "now") return !!c.startDate && c.startDate <= today && (!c.endDate || c.endDate >= today);
  if (f === "upcoming") return !!c.startDate && c.startDate > today;
  return !!c.endDate && c.endDate < today;
}

/** The Campaign Planner home: an overview of the customer's own campaigns, filters, and their saved templates. */
export function CampaignsHome({ data }: { data: HomeData }) {
  const hydrated = useHydrated();
  const today = hydrated ? localToday() : null;
  const { busy, notice, run } = useAction();
  const [tab, setTab] = React.useState<"campaigns" | "templates">("campaigns");
  const [q, setQ] = React.useState("");
  const [brand, setBrand] = React.useState("");
  const [status, setStatus] = React.useState<CampaignStatus | "" | "current">("current");
  const [platform, setPlatform] = React.useState<SocialProviderId | "">("");
  const [dates, setDates] = React.useState<DateFilter>("any");
  const [view, setView] = React.useState<"cards" | "list">("cards");
  const [deleting, setDeleting] = React.useState<CampaignSummary | null>(null);

  const brands = new Map(data.brands.map((b) => [b.id, b]));
  const full = data.campaigns.length >= CAMPAIGNS_MAX;
  const term = q.trim().toLowerCase();
  const list = data.campaigns.filter(
    (c) =>
      (!term || c.name.toLowerCase().includes(term) || OBJECTIVE_LABEL[c.objective].toLowerCase().includes(term)) &&
      (brand === "" || (brand === "none" ? !c.brandId : c.brandId === brand)) &&
      (status === "" || (status === "current" ? c.status !== "archived" : c.status === status)) &&
      (!platform || c.platforms.includes(platform)) &&
      matchesDate(c, dates, today),
  );
  const filtered = term || brand || (status !== "current" && status !== "") || platform || dates !== "any";

  // Overview: counted from the customer's own campaigns and tasks (archived campaigns left out).
  const live = data.campaigns.filter((c) => c.status !== "archived");
  const open = live.flatMap((c) => c.openTasks.map((t) => ({ ...t, campaign: c })));
  const overdue = today ? open.filter((t) => dueState(t.dueDate, today) === "overdue") : [];
  const soon = today ? open.filter((t) => ["today", "soon"].includes(dueState(t.dueDate, today))) : [];
  const stats = [
    { label: "In progress", value: live.filter((c) => c.status === "active").length, icon: Rocket },
    { label: "Planned", value: live.filter((c) => c.status === "planned").length, icon: CalendarClock },
    { label: "To-dos left", value: live.reduce((a, c) => a + c.taskCount - c.tasksDone, 0), icon: ListChecks },
    { label: "Late to-dos", value: today ? overdue.length : null, icon: CircleAlert, alert: overdue.length > 0 },
  ];

  const act = (c: CampaignSummary, path: string, init: RequestInit, ok: string) => void run(c.id, path, init, ok);
  const archive = (c: CampaignSummary, to: CampaignStatus) => act(c, `/api/campaigns/${c.id}`, json("PATCH", { status: to }), to === "archived" ? `${c.name} was archived.` : `${c.name} was restored.`);

  return (
    <div className={page}>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className={cn(eyebrow, "text-primary")}>Sociotix · Plan your marketing</p>
          <h1 className="mt-1.5 font-heading text-[1.6rem] leading-tight font-extrabold tracking-tight sm:text-[1.9rem]">{PLAN_NAME}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground sm:text-[0.95rem]">Keep each launch, sale or event in one place: the goal, a simple to-do list and the posts that go with it. Nothing is posted or advertised for you.</p>
        </div>
        {full ? (
          <p className="text-[0.8rem] text-muted-foreground">You&apos;ve reached the limit of {CAMPAIGNS_MAX} plans.</p>
        ) : (
          <Link href={CAMPAIGN_ROUTES.create} className={primaryButton}>
            <Plus className="size-4" aria-hidden /> New plan
          </Link>
        )}
      </header>

      {data.campaigns.length ? (
        <PageGuide
          id="plans"
          className="mt-4"
          steps={[
            { title: "Make a plan", body: "Name it, pick a goal, or start from a ready-made plan." },
            { title: "Tick off to-dos", body: "Open a plan and work through its to-dos. Progress updates on its own." },
            { title: "Add your posts", body: "Attach drafts from Posts. Plan dates show on your calendar." },
          ]}
        />
      ) : null}
      <NoticeBar notice={notice} className="mt-3" />

      <div className="mt-4 inline-flex rounded-full border bg-card p-1" role="group" aria-label="Plans and templates">
        {(["campaigns", "templates"] as const).map((t) => (
          <button key={t} type="button" aria-pressed={tab === t} onClick={() => setTab(t)} className={cn("rounded-full px-4 py-1.5 text-[0.85rem] font-semibold outline-none transition-colors focus-visible:ring-3 focus-visible:ring-primary/30", tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
            {t === "campaigns" ? `Plans (${data.campaigns.length})` : `Templates (${data.templates.length})`}
          </button>
        ))}
      </div>

      {tab === "templates" ? (
        <Templates templates={data.templates} canCreate={!full} />
      ) : data.campaigns.length === 0 ? (
        <section className="mt-4 flex flex-col items-center rounded-3xl border border-dashed bg-card px-6 py-14 text-center" aria-labelledby="campaign-empty">
          <EmptyIllustration icon={Flag} />
          <h2 id="campaign-empty" className="mt-4 font-heading text-lg font-extrabold">
            Make your first marketing plan
          </h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">Planning a launch, a sale or an event? Give it a name, pick a ready-made starter plan if you like, then tick off the to-dos as you go.</p>
          <ol className="mt-5 grid max-w-2xl gap-3 text-start sm:grid-cols-3">
            {[
              ["Name it", "Say what it's for and when."],
              ["List the to-dos", "Or start from a ready-made plan."],
              ["Add your posts", "Drafts from your Content Library."],
            ].map(([t, d], i) => (
              <li key={t} className="flex gap-2.5 rounded-2xl border bg-background p-3 dark:bg-white/[0.02]">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-[0.74rem] font-bold text-primary dark:text-[#c4b5ff]" aria-hidden>
                  {i + 1}
                </span>
                <span>
                  <span className="block text-[0.86rem] font-semibold">{t}</span>
                  <span className="block text-[0.76rem] text-muted-foreground">{d}</span>
                </span>
              </li>
            ))}
          </ol>
          <Link href={CAMPAIGN_ROUTES.create} className={cn(primaryButton, "mt-5")}>
            <Plus className="size-4" aria-hidden /> Make a plan
          </Link>
        </section>
      ) : (
        <>
          <section aria-label="Overview" className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="rounded-2xl border bg-card p-3.5 shadow-soft">
                <p className="flex items-center gap-1.5 text-[0.76rem] font-semibold text-muted-foreground">
                  <s.icon className={cn("size-4", s.alert ? "text-destructive" : "text-primary")} aria-hidden /> {s.label}
                </p>
                <p className={cn("mt-1 font-heading text-2xl font-extrabold tabular-nums", s.alert && "text-destructive")}>{s.value ?? "–"}</p>
              </div>
            ))}
          </section>

          {overdue.length || soon.length ? (
            <section aria-labelledby="due-work" className="mt-4 rounded-2xl border bg-card p-4 shadow-soft">
              <h2 id="due-work" className="font-heading text-[1rem] font-bold">
                Coming up
              </h2>
              <ul className="mt-2 divide-y">
                {[...overdue, ...soon].slice(0, 8).map((t) => {
                  const late = today ? dueState(t.dueDate, today) === "overdue" : false;
                  return (
                    <li key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-[0.85rem]">
                      <span className={cn("rounded-full px-2 py-0.5 text-[0.68rem] font-bold", late ? "bg-destructive/10 text-destructive" : "bg-secondary text-secondary-foreground")}>{late ? "Late" : dueState(t.dueDate, today!) === "today" ? "Today" : "This week"}</span>
                      <span className="min-w-0 flex-1 truncate font-medium">{t.title}</span>
                      <span className="text-[0.76rem] text-muted-foreground">{formatDate(t.dueDate, { month: "short", day: "numeric" })}</span>
                      <Link href={campaignHref(t.campaign.id, "tasks")} className="max-w-48 truncate text-[0.78rem] font-semibold text-primary hover:underline">
                        {t.campaign.name}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-2" role="search" aria-label="Filter plans">
            <label className="relative min-w-0 flex-1 basis-56">
              <span className="sr-only">Search plans</span>
              <Search className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search plans" className={cn(compactField, "w-full ps-10")} />
            </label>
            <select aria-label="Brand" value={brand} onChange={(e) => setBrand(e.target.value)} className={cn(compactField, "max-w-44")}>
              <option value="">All brands</option>
              <option value="none">No brand</option>
              {data.brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={compactField}>
              <option value="current">Not archived</option>
              <option value="">All statuses</option>
              {CAMPAIGN_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
            <select aria-label="Platform" value={platform} onChange={(e) => setPlatform(e.target.value as SocialProviderId | "")} className={compactField}>
              <option value="">All platforms</option>
              {SOCIAL_PROVIDER_IDS.map((p) => (
                <option key={p} value={p}>
                  {SOCIAL_PLATFORM[p].name}
                </option>
              ))}
            </select>
            <select aria-label="Dates" value={dates} onChange={(e) => setDates(e.target.value as DateFilter)} className={compactField}>
              {Object.entries(DATE_FILTERS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <div className="ms-auto inline-flex rounded-full border bg-card p-0.5" role="group" aria-label="Layout">
              {(["cards", "list"] as const).map((v) => (
                <button key={v} type="button" aria-pressed={view === v} aria-label={v === "cards" ? "Cards" : "List"} onClick={() => setView(v)} className={cn("grid size-9 place-items-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-primary/30", view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                  {v === "cards" ? <LayoutGrid className="size-4" aria-hidden /> : <List className="size-4" aria-hidden />}
                </button>
              ))}
            </div>
          </div>
          <p className="mt-2 text-[0.8rem] text-muted-foreground" aria-live="polite">
            {list.length} of {data.campaigns.length} {data.campaigns.length === 1 ? "plan" : "plans"}
          </p>

          {list.length === 0 ? (
            <section className="mt-3 rounded-3xl border bg-card px-6 py-10 text-center">
              <EmptyIllustration icon={Search} />
              <p className="mt-3 font-heading text-lg font-bold">No plans match</p>
              <p className="mt-1 text-sm text-muted-foreground">{filtered ? "Try different filters." : "Everything here is archived."}</p>
              <button
                type="button"
                className={cn(quietButton, "mt-4")}
                onClick={() => {
                  setQ("");
                  setBrand("");
                  setStatus("");
                  setPlatform("");
                  setDates("any");
                }}
              >
                Show all plans
              </button>
            </section>
          ) : view === "cards" ? (
            <ul className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Your plans">
              {list.map((c) => (
                <li key={c.id}>
                  <CampaignCard c={c} brand={c.brandId ? brands.get(c.brandId) : undefined} today={today} busy={busy === c.id} disabled={busy !== null} canDuplicate={!full} onDuplicate={() => act(c, `/api/campaigns/${c.id}/duplicate`, json("POST"), `${c.name} was copied as a new draft plan.`)} onArchive={(to) => archive(c, to)} onDelete={() => setDeleting(c)} />
                </li>
              ))}
            </ul>
          ) : (
            <ul className="mt-3 divide-y overflow-hidden rounded-2xl border bg-card shadow-soft" aria-label="Your plans">
              {list.map((c) => {
                const b = c.brandId ? brands.get(c.brandId) : undefined;
                return (
                  <li key={c.id} className={cn("grid gap-x-4 gap-y-1.5 px-4 py-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.2fr)_8rem_auto] md:items-center", busy === c.id && "opacity-70")}>
                    <div className="min-w-0">
                      <Link href={campaignHref(c.id)} className="block truncate rounded font-bold outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/40">
                        {c.name}
                      </Link>
                      <p className="truncate text-[0.76rem] text-muted-foreground">{OBJECTIVE_LABEL[c.objective]}</p>
                    </div>
                    <div className="flex min-w-0 items-center gap-2">
                      <StatusBadge status={c.status} />
                      {b ? <BrandChip brand={b} /> : null}
                    </div>
                    <p className="text-[0.78rem] text-muted-foreground">{formatRange(c.startDate, c.endDate)}</p>
                    <Progress done={c.tasksDone} total={c.taskCount} labelled={false} className="hidden md:block" />
                    <CardMenu c={c} disabled={busy !== null} canDuplicate={!full} onDuplicate={() => act(c, `/api/campaigns/${c.id}/duplicate`, json("POST"), `${c.name} was copied as a new draft plan.`)} onArchive={(to) => archive(c, to)} onDelete={() => setDeleting(c)} />
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={deleting ? `Delete ${deleting.name}?` : "Delete plan?"}
        description={deleting ? `Its ${deleting.taskCount} to-dos and ${deleting.milestones.length} stages are deleted. ${deleting.postCount ? `Its ${deleting.postCount} ${deleting.postCount === 1 ? "post stays" : "posts stay"} in your Content Library.` : ""} Archive it instead to keep it for reference.` : ""}
        confirmLabel="Delete plan"
        tone="danger"
        icon={Trash2}
        onConfirm={() => {
          const c = deleting;
          setDeleting(null);
          if (c) act(c, `/api/campaigns/${c.id}`, json("DELETE"), `${c.name} was deleted. Your posts were kept.`);
        }}
      />
    </div>
  );
}

function CardMenu({ c, disabled, canDuplicate, onDuplicate, onArchive, onDelete }: { c: CampaignSummary; disabled: boolean; canDuplicate: boolean; onDuplicate: () => void; onArchive: (to: CampaignStatus) => void; onDelete: () => void }) {
  return (
    <Menu.Root>
      <Menu.Trigger aria-label={`More actions for ${c.name}`} disabled={disabled} className="grid size-9 shrink-0 place-items-center justify-self-end rounded-full text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-primary/30 disabled:opacity-50">
        <MoreHorizontal className="size-4" aria-hidden />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={6} align="end" className="z-50 outline-none">
          <Menu.Popup className={cn(menuPopup, "min-w-48")}>
            <Menu.Item render={<Link href={campaignEditHref(c.id)} />} className={menuItem}>
              <Pencil className="size-4" aria-hidden /> Edit
            </Menu.Item>
            <Menu.Item className={menuItem} onClick={onDuplicate} disabled={!canDuplicate}>
              <Copy className="size-4" aria-hidden /> Duplicate
            </Menu.Item>
            {c.status === "archived" ? (
              <Menu.Item className={menuItem} onClick={() => onArchive("draft")}>
                <ArchiveRestore className="size-4" aria-hidden /> Restore as draft
              </Menu.Item>
            ) : (
              <Menu.Item className={menuItem} onClick={() => onArchive("archived")}>
                <Archive className="size-4" aria-hidden /> Archive
              </Menu.Item>
            )}
            <Menu.Item className={cn(menuItem, menuItemDestructive)} onClick={onDelete}>
              <Trash2 className="size-4" aria-hidden /> Delete
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

/** One plain line: "3 of 5 to-dos done · 2 posts · ends in 6 days". */
function cardSummary(c: CampaignSummary, reached: number, today: string | null) {
  const parts = [c.taskCount ? `${c.tasksDone} of ${c.taskCount} to-dos done` : "No to-dos yet", `${c.postCount} ${c.postCount === 1 ? "post" : "posts"}`];
  if (c.milestones.length) parts.splice(1, 0, `${reached}/${c.milestones.length} stages`);
  if (today && c.status !== "completed" && c.status !== "archived") {
    if (c.startDate && c.startDate > today) {
      const d = daysBetween(today, c.startDate);
      parts.push(d === 1 ? "starts tomorrow" : `starts in ${d} days`);
    } else if (c.endDate && c.endDate >= today) {
      const d = daysBetween(today, c.endDate);
      parts.push(d === 0 ? "ends today" : d === 1 ? "ends tomorrow" : `ends in ${d} days`);
    }
  }
  return parts.join(" · ");
}

function CampaignCard({ c, brand, today, busy, ...menu }: { c: CampaignSummary; brand?: BrandSummary; today: string | null; busy: boolean; disabled: boolean; canDuplicate: boolean; onDuplicate: () => void; onArchive: (to: CampaignStatus) => void; onDelete: () => void }) {
  const note = today ? statusNote(c, today) : null;
  const reached = c.milestones.filter((m) => m.done).length;
  return (
    <article className={cn("flex h-full flex-col gap-3 rounded-3xl border bg-card p-4 shadow-soft transition-shadow hover:shadow-float", busy && "opacity-70")} aria-busy={busy || undefined}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <Link href={campaignHref(c.id)} className="block truncate rounded text-[1rem] font-bold outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/40">
            {c.name}
          </Link>
          <p className="truncate text-[0.78rem] text-muted-foreground">{OBJECTIVE_LABEL[c.objective]}</p>
        </div>
        <StatusBadge status={c.status} />
        <CardMenu c={c} {...menu} />
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.76rem] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <CalendarClock className="size-3.5" aria-hidden /> {formatRange(c.startDate, c.endDate)}
        </span>
        {brand ? <BrandChip brand={brand} /> : null}
      </div>
      {note ? <p className="rounded-xl bg-amber-500/10 px-2.5 py-1.5 text-[0.74rem] text-amber-800 dark:text-amber-200">{note}</p> : null}
      {c.taskCount ? (
        <Progress done={c.tasksDone} total={c.taskCount} labelled={false} className="mt-auto" />
      ) : (
        <Link href={campaignHref(c.id, "tasks")} className="mt-auto rounded-xl border border-dashed px-3 py-2 text-[0.78rem] font-medium text-primary hover:bg-primary/[0.04]">
          + Add the first to-do
        </Link>
      )}
      <p className="text-[0.76rem] text-muted-foreground">{cardSummary(c, reached, today)}</p>
    </article>
  );
}

function Templates({ templates, canCreate }: { templates: CampaignTemplateView[]; canCreate: boolean }) {
  const { busy, notice, run } = useAction();
  const [renaming, setRenaming] = React.useState<CampaignTemplateView | null>(null);
  const [name, setName] = React.useState("");
  const [deleting, setDeleting] = React.useState<CampaignTemplateView | null>(null);

  return (
    <section className="mt-4" aria-label="Templates">
      <NoticeBar notice={notice} className="mb-3" />
      {templates.length === 0 ? (
        <div className="flex flex-col items-center rounded-3xl border border-dashed bg-card px-6 py-12 text-center">
          <EmptyIllustration icon={LayoutTemplate} />
          <h2 className="mt-4 font-heading text-lg font-extrabold">No templates yet</h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">Open a plan and choose “Save as template” from its ⋯ menu to reuse its goal, stages and to-dos. Starter plans are always available when you make a new plan.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {templates.map((t) => (
            <li key={t.id} className={cn("flex flex-col gap-2 rounded-3xl border bg-card p-4 shadow-soft", busy === t.id && "opacity-70")}>
              <div className="flex items-start gap-2">
                <LayoutTemplate className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-bold">{t.name}</h3>
                  <p className="text-[0.76rem] text-muted-foreground">{OBJECTIVE_LABEL[t.objective]}</p>
                </div>
              </div>
              {t.description ? <p className="line-clamp-2 text-[0.82rem] text-muted-foreground">{t.description}</p> : null}
              <p className="text-[0.76rem] text-muted-foreground">
                {stepCount(t.structure)}
              </p>
              <div className="mt-auto flex flex-wrap gap-2 pt-1">
                {canCreate ? (
                  <Link href={`${CAMPAIGN_ROUTES.create}?template=${encodeURIComponent(t.id)}`} className={cn(primaryButton, "h-9 px-3.5 text-[0.82rem]")}>
                    Use template
                  </Link>
                ) : null}
                <button
                  type="button"
                  disabled={busy !== null}
                  className={cn(quietButton, "h-9 px-3.5 text-[0.82rem]")}
                  onClick={() => {
                    setRenaming(t);
                    setName(t.name);
                  }}
                >
                  Rename
                </button>
                <button type="button" disabled={busy !== null} className={cn(quietButton, "h-9 px-3.5 text-[0.82rem] text-destructive")} onClick={() => setDeleting(t)}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <DialogFrame
        open={renaming !== null}
        onClose={() => setRenaming(null)}
        title="Rename template"
        footer={
          <>
            <button type="button" className={quietButton} onClick={() => setRenaming(null)}>
              Cancel
            </button>
            <button
              type="submit"
              form="rename-template"
              className={primaryButton}
              disabled={!name.trim() || busy !== null}
            >
              Save name
            </button>
          </>
        }
      >
        <form
          id="rename-template"
          onSubmit={(e) => {
            e.preventDefault();
            const t = renaming;
            if (!t) return;
            void run(t.id, `/api/campaign-templates/${t.id}`, json("PATCH", { name }), "Template renamed.").then((r) => r && setRenaming(null));
          }}
        >
          <label htmlFor="template-name" className={label}>
            Template name
          </label>
          <input id="template-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={CAMPAIGN_NAME_MAX} autoFocus className={cn(field, "mt-1.5")} />
        </form>
      </DialogFrame>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={deleting ? `Delete the template ${deleting.name}?` : "Delete template?"}
        description="Plans made from it are not affected."
        confirmLabel="Delete template"
        tone="danger"
        icon={Trash2}
        onConfirm={() => {
          const t = deleting;
          setDeleting(null);
          if (t) void run(t.id, `/api/campaign-templates/${t.id}`, json("DELETE"), "Template deleted.");
        }}
      />
    </section>
  );
}
