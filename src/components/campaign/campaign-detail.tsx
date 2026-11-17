"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Menu } from "@base-ui/react/menu";
import {
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CalendarDays,
  Check,
  Copy,
  Download,
  ExternalLink,
  Flag,
  FileText,
  LayoutTemplate,
  Library,
  Link2,
  ListChecks,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  Unlink,
} from "lucide-react";
import { BrandChip } from "@/components/brand/brand-parts";
import { ConfirmDialog } from "@/components/dashboard/account-ui";
import { useHydrated } from "@/components/dashboard/shared";
import { eyebrow, page, primaryButton, quietButton } from "@/components/social/parts";
import { EmptyIllustration, PlatformStack, StateBadge } from "@/components/social/publishing-parts";
import { menuItem, menuItemDestructive, menuPopup } from "@/components/ui/menu";
import type { BrandSummary } from "@/lib/brand";
import {
  CAMPAIGN_NAME_MAX,
  CAMPAIGN_ROUTES,
  CAMPAIGN_STATUSES,
  campaignEditHref,
  daysBetween,
  dueState,
  formatBudget,
  formatDate,
  formatRange,
  LINK_MAX,
  localToday,
  MILESTONE_TITLE_MAX,
  MILESTONES_MAX,
  milestoneProgress,
  OBJECTIVE_LABEL,
  percent,
  PLAN_NAME,
  PRIORITY_LABEL,
  STATUS_LABEL,
  statusNote,
  TASK_NOTES_MAX,
  TASK_PRIORITIES,
  TASK_TITLE_MAX,
  TASKS_MAX,
  type CampaignStatus,
  type CampaignView,
  type MilestoneView,
  type TaskPriority,
  type TaskView,
} from "@/lib/campaign";
import { CONTENT_ROUTES } from "@/lib/social/content";
import { SOCIAL_PLATFORM, SOCIAL_PROVIDER_IDS, type SocialProviderId } from "@/lib/social/platforms";
import { postHref, PUBLISHING_ROUTES, POST_STATE_LABEL, type PostState, type PostView } from "@/lib/social/publishing";
import { cn } from "@/lib/utils";
import { compactField, DialogFrame, field, json, label, NoticeBar, Progress, StatusBadge, useAction } from "./campaign-parts";
import type { DetailData } from "./loader";

type Tab = "overview" | "tasks" | "content" | "report";
const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Plan" },
  { id: "tasks", label: "To-dos" },
  { id: "content", label: "Posts" },
  { id: "report", label: "Progress" },
];

const headline = (p: PostView) => p.title?.trim() || p.text.trim().split("\n")[0]?.slice(0, 80) || (p.hashtags.length ? `#${p.hashtags[0]}` : "Untitled post");
const PRIORITY_STYLE: Record<TaskPriority, string> = { high: "bg-destructive/10 text-destructive", medium: "bg-secondary text-secondary-foreground", low: "bg-muted text-muted-foreground" };

/** One campaign: its plan, tasks and milestones, linked content and a progress report. */
export function CampaignDetail({ data, initialTab }: { data: DetailData; initialTab?: string }) {
  const { campaign: c, brands } = data;
  const router = useRouter();
  const hydrated = useHydrated();
  const today = hydrated ? localToday() : null;
  const action = useAction();
  const { busy, notice, run } = action;
  const [tab, setTabState] = React.useState<Tab>(TABS.some((t) => t.id === initialTab) ? (initialTab as Tab) : "overview");
  const [deleting, setDeleting] = React.useState(false);
  const [templateOpen, setTemplateOpen] = React.useState(false);
  const [templateName, setTemplateName] = React.useState(c.name);

  const brand = c.brandId ? brands.find((b) => b.id === c.brandId) : undefined;
  const linked = data.posts.filter((p) => p.campaignId === c.id);
  const note = today ? statusNote(c, today) : null;

  function setTab(t: Tab) {
    setTabState(t);
    const url = new URL(window.location.href);
    if (t === "overview") url.searchParams.delete("tab");
    else url.searchParams.set("tab", t);
    window.history.replaceState(window.history.state, "", url);
  }

  const setStatus = (s: CampaignStatus) => void run("status", `/api/campaigns/${c.id}`, json("PATCH", { status: s }), `Status set to ${STATUS_LABEL[s]}.`);

  return (
    <div className={page}>
      <Link href={CAMPAIGN_ROUTES.home} className="inline-flex items-center gap-1.5 rounded text-[0.84rem] font-semibold text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40">
        <ArrowLeft className="size-4" aria-hidden /> {PLAN_NAME}
      </Link>

      <header className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 basis-72">
          <p className={cn(eyebrow, "text-primary")}>{OBJECTIVE_LABEL[c.objective]}</p>
          <h1 className="mt-1.5 font-heading text-[1.5rem] leading-tight font-extrabold tracking-tight break-words sm:text-[1.85rem]">{c.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[0.82rem] text-muted-foreground">
            <StatusBadge status={c.status} />
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="size-3.5" aria-hidden /> {formatRange(c.startDate, c.endDate)}
            </span>
            {brand ? <BrandChip brand={brand} className="text-[0.8rem]" /> : <span>No brand</span>}
            {c.platforms.length ? <span>{c.platforms.map((p) => SOCIAL_PLATFORM[p].name).join(" · ")}</span> : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="c-status" className="sr-only">
            Status
          </label>
          <select id="c-status" value={c.status} disabled={busy !== null} onChange={(e) => setStatus(e.target.value as CampaignStatus)} className={compactField}>
            {CAMPAIGN_STATUSES.map((s) => (
              <option key={s} value={s} disabled={(s === "planned" || s === "active") && !c.startDate}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <Link href={campaignEditHref(c.id)} className={cn(quietButton, "h-10")}>
            <Pencil className="size-4" aria-hidden /> Edit
          </Link>
          <Menu.Root>
            <Menu.Trigger aria-label="More plan actions" disabled={busy !== null} className="grid size-10 place-items-center rounded-full border text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-primary/30 disabled:opacity-50">
              <MoreHorizontal className="size-4" aria-hidden />
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner sideOffset={6} align="end" className="z-50 outline-none">
                <Menu.Popup className={cn(menuPopup, "min-w-52")}>
                  <Menu.Item
                    className={menuItem}
                    onClick={() =>
                      void run<{ campaign: CampaignView }>("dup", `/api/campaigns/${c.id}/duplicate`, json("POST")).then((r) => {
                        if (r) router.push(`${CAMPAIGN_ROUTES.home}/${r.campaign.id}`);
                      })
                    }
                  >
                    <Copy className="size-4" aria-hidden /> Duplicate
                  </Menu.Item>
                  <Menu.Item
                    className={menuItem}
                    onClick={() => {
                      setTemplateName(c.name);
                      setTemplateOpen(true);
                    }}
                  >
                    <LayoutTemplate className="size-4" aria-hidden /> Save as template
                  </Menu.Item>
                  <Menu.Item render={<a href={`/api/campaigns/${c.id}/export`} download />} className={menuItem}>
                    <Download className="size-4" aria-hidden /> Export CSV
                  </Menu.Item>
                  {c.status === "archived" ? (
                    <Menu.Item className={menuItem} onClick={() => setStatus("draft")}>
                      <ArchiveRestore className="size-4" aria-hidden /> Restore as draft
                    </Menu.Item>
                  ) : (
                    <Menu.Item className={menuItem} onClick={() => setStatus("archived")}>
                      <Archive className="size-4" aria-hidden /> Archive
                    </Menu.Item>
                  )}
                  <Menu.Item className={cn(menuItem, menuItemDestructive)} onClick={() => setDeleting(true)}>
                    <Trash2 className="size-4" aria-hidden /> Delete
                  </Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </div>
      </header>

      {note ? <p className="mt-3 rounded-2xl bg-amber-500/10 px-4 py-2.5 text-[0.84rem] text-amber-800 dark:text-amber-200">{note}</p> : null}
      <NoticeBar notice={notice} className="mt-3" />

      <nav className="mt-4 flex gap-1 overflow-x-auto border-b" aria-label="Plan sections">
        {TABS.map((t) => (
          <button key={t.id} type="button" aria-current={tab === t.id ? "page" : undefined} onClick={() => setTab(t.id)} className={cn("-mb-px shrink-0 border-b-2 px-3.5 py-2.5 text-[0.88rem] font-semibold outline-none transition-colors focus-visible:ring-3 focus-visible:ring-primary/30", tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {t.label}
            {t.id === "tasks" ? ` (${c.tasks.length})` : t.id === "content" ? ` (${linked.length})` : ""}
          </button>
        ))}
      </nav>

      <div className="mt-5">
        {tab === "overview" ? <Overview c={c} linked={linked} today={today} onTab={setTab} /> : null}
        {tab === "tasks" ? <Tasks c={c} today={today} action={action} /> : null}
        {tab === "content" ? <Content c={c} linked={linked} all={data.posts} brands={brands} campaignNames={data.campaignNames} action={action} /> : null}
        {tab === "report" ? <Report c={c} linked={linked} today={today} /> : null}
      </div>

      <DialogFrame
        open={templateOpen}
        onClose={() => setTemplateOpen(false)}
        title="Save as template"
        description="Reuse this plan's goal, stages and to-dos next time. Posts, budget and notes aren't included."
        footer={
          <>
            <button type="button" className={quietButton} onClick={() => setTemplateOpen(false)}>
              Cancel
            </button>
            <button type="submit" form="save-template" className={primaryButton} disabled={!templateName.trim() || busy !== null}>
              Save template
            </button>
          </>
        }
      >
        <form
          id="save-template"
          onSubmit={(e) => {
            e.preventDefault();
            void run(`tpl`, `/api/campaigns/${c.id}/template`, json("POST", { name: templateName }), `Saved “${templateName.trim()}” as a template.`).then((r) => r && setTemplateOpen(false));
          }}
        >
          <label htmlFor="tpl-name" className={label}>
            Template name
          </label>
          <input id="tpl-name" value={templateName} onChange={(e) => setTemplateName(e.target.value)} maxLength={CAMPAIGN_NAME_MAX} autoFocus className={cn(field, "mt-1.5")} />
        </form>
      </DialogFrame>

      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete ${c.name}?`}
        description={`Its ${c.tasks.length} to-dos and ${c.milestones.length} stages are deleted. ${linked.length ? `Its ${linked.length} ${linked.length === 1 ? "post stays" : "posts stay"} in your Content Library.` : ""}`}
        confirmLabel="Delete plan"
        tone="danger"
        icon={Trash2}
        onConfirm={() => {
          setDeleting(false);
          void run("delete", `/api/campaigns/${c.id}`, json("DELETE")).then((r) => r && router.push(CAMPAIGN_ROUTES.home));
        }}
      />
    </div>
  );
}

type Action = ReturnType<typeof useAction>;

/* -------------------------------------------------------------------------- */
/*  Overview                                                                  */
/* -------------------------------------------------------------------------- */

function Timeline({ c, today }: { c: CampaignView; today: string | null }) {
  if (!c.startDate) return <p className="text-[0.84rem] text-muted-foreground">Add a start date to see the timeline.</p>;
  const total = c.endDate ? daysBetween(c.startDate, c.endDate) + 1 : null;
  const elapsed = today ? daysBetween(c.startDate, today) + 1 : null;
  let text = "";
  if (today && elapsed !== null) {
    if (elapsed <= 0) text = `Starts in ${1 - elapsed} ${1 - elapsed === 1 ? "day" : "days"}`;
    else if (total !== null && elapsed > total) text = `Ended ${elapsed - total} ${elapsed - total === 1 ? "day" : "days"} ago`;
    else text = total !== null ? `Day ${elapsed} of ${total}` : `Day ${elapsed}`;
  }
  const pct = total && elapsed !== null ? Math.min(100, Math.max(0, Math.round((elapsed / total) * 100))) : null;
  return (
    <div>
      <div className="flex flex-wrap justify-between gap-2 text-[0.8rem]">
        <span>{formatDate(c.startDate)}</span>
        <span className="font-semibold">{text}</span>
        <span>{c.endDate ? formatDate(c.endDate) : "No end date"}</span>
      </div>
      {pct !== null ? (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
          <div className="h-full rounded-full bg-lime" style={{ width: `${pct}%` }} />
        </div>
      ) : null}
    </div>
  );
}

const card = "rounded-3xl border bg-card p-4 shadow-soft sm:p-5";

function Overview({ c, linked, today, onTab }: { c: CampaignView; linked: PostView[]; today: string | null; onTab: (t: Tab) => void }) {
  const done = c.tasks.filter((t) => t.completedAt).length;
  const reached = c.milestones.filter((m) => milestoneProgress(m.id, c.tasks).reached).length;
  const open = c.tasks.filter((t) => !t.completedAt && t.dueDate);
  const overdue = today ? open.filter((t) => dueState(t.dueDate, today) === "overdue").length : 0;
  const upcoming = today ? open.filter((t) => ["today", "soon"].includes(dueState(t.dueDate, today))) : [];
  const guide = [
    { done: c.tasks.length > 0, title: "Add your to-dos", body: "List what needs to get done.", action: () => onTab("tasks"), cta: "Add to-dos" },
    { done: c.postIds.length > 0, title: "Add your posts", body: "Pick drafts from your Content Library.", action: () => onTab("content"), cta: "Add posts" },
    { done: !!c.startDate, title: "Set the dates", body: "Dates put the plan on your calendar.", href: campaignEditHref(c.id), cta: "Set dates" },
    { done: done > 0, title: "Tick off a to-do", body: "Your progress updates as you go.", action: () => onTab("tasks"), cta: "Open to-dos" },
  ];
  const left = guide.filter((g) => !g.done).length;
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {left ? (
        <section className={cn(card, "border-primary/30 bg-primary/[0.03] lg:col-span-3")} aria-labelledby="ov-next">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="ov-next" className="font-heading text-[1rem] font-bold">
              What&apos;s next
            </h2>
            <span className="text-[0.78rem] text-muted-foreground">
              {guide.length - left} of {guide.length} done
            </span>
          </div>
          <ol className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {guide.map((g, i) => (
              <li key={g.title} className={cn("flex flex-col gap-1 rounded-2xl border p-3", g.done ? "border-dashed bg-transparent" : "bg-card")}>
                <p className="flex items-center gap-2 text-[0.88rem] font-semibold">
                  <span className={cn("grid size-6 shrink-0 place-items-center rounded-full text-[0.72rem] font-bold", g.done ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-primary/10 text-primary dark:text-[#c4b5ff]")} aria-hidden>
                    {g.done ? <Check className="size-3.5" /> : i + 1}
                  </span>
                  <span className={cn(g.done && "line-through")}>{g.title}</span>
                  {g.done ? <span className="sr-only">(done)</span> : null}
                </p>
                <p className="text-[0.76rem] text-muted-foreground">{g.body}</p>
                {g.done ? null : g.href ? (
                  <Link href={g.href} className="mt-auto pt-1 text-[0.8rem] font-semibold text-primary hover:underline">
                    {g.cta} →
                  </Link>
                ) : (
                  <button type="button" onClick={g.action} className="mt-auto self-start rounded pt-1 text-[0.8rem] font-semibold text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary/40">
                    {g.cta} →
                  </button>
                )}
              </li>
            ))}
          </ol>
        </section>
      ) : null}
      <section className={cn(card, "lg:col-span-2")} aria-labelledby="ov-progress">
        <h2 id="ov-progress" className="font-heading text-[1rem] font-bold">
          Progress
        </h2>
        <Progress done={done} total={c.tasks.length} className="mt-3" />
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Stages done", c.milestones.length ? `${reached} of ${c.milestones.length}` : "None yet"],
            ["Late to-dos", today ? String(overdue) : "–"],
            ["Posts", String(linked.length)],
            ["On the calendar", String(linked.filter((p) => p.plannedAt || p.scheduledAt).length)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-2xl bg-muted/40 p-3">
              <dt className="text-[0.72rem] text-muted-foreground">{k}</dt>
              <dd className="mt-0.5 font-heading text-lg font-extrabold tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-4">
          <h3 className="text-[0.8rem] font-semibold">Timeline</h3>
          <div className="mt-2">
            <Timeline c={c} today={today} />
          </div>
        </div>
      </section>

      <section className={card} aria-labelledby="ov-due">
        <h2 id="ov-due" className="font-heading text-[1rem] font-bold">
          Coming up
        </h2>
        {upcoming.length ? (
          <ul className="mt-2 divide-y">
            {upcoming.slice(0, 6).map((t) => (
              <li key={t.id} className="flex items-center gap-2 py-2 text-[0.84rem]">
                <span className="min-w-0 flex-1 truncate">{t.title}</span>
                <span className="text-[0.74rem] text-muted-foreground">{formatDate(t.dueDate!, { month: "short", day: "numeric" })}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[0.84rem] text-muted-foreground">Nothing due in the next 7 days.</p>
        )}
        <button type="button" onClick={() => onTab("tasks")} className="mt-3 inline-flex items-center gap-1 text-[0.84rem] font-semibold text-primary hover:underline">
          <ListChecks className="size-4" aria-hidden /> All to-dos
        </button>
      </section>

      <section className={cn(card, "lg:col-span-2")} aria-labelledby="ov-about">
        <h2 id="ov-about" className="font-heading text-[1rem] font-bold">
          About this plan
        </h2>
        <p className="mt-2 text-[0.88rem] whitespace-pre-line text-muted-foreground">{c.description || "No description yet."}</p>
        {c.notes ? (
          <>
            <h3 className="mt-4 text-[0.8rem] font-semibold">Notes</h3>
            <p className="mt-1 text-[0.86rem] whitespace-pre-line">{c.notes}</p>
          </>
        ) : null}
      </section>

      <section className={card} aria-labelledby="ov-budget">
        <h2 id="ov-budget" className="font-heading text-[1rem] font-bold">
          Budget
        </h2>
        <p className="mt-2 font-heading text-xl font-extrabold">{c.budgetCents != null ? formatBudget(c.budgetCents, c.budgetCurrency) : "Not set"}</p>
        <p className="mt-1 text-[0.74rem] text-muted-foreground">Just for your planning. Nothing is spent or charged.</p>
      </section>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Tasks & milestones                                                        */
/* -------------------------------------------------------------------------- */

type TaskFilter = "all" | "open" | "due" | "done";

function Tasks({ c, today, action }: { c: CampaignView; today: string | null; action: Action }) {
  const { busy, run } = action;
  const [filter, setFilter] = React.useState<TaskFilter>("all");
  const [title, setTitle] = React.useState("");
  const [due, setDue] = React.useState("");
  const [milestone, setMilestone] = React.useState("");
  const [mTitle, setMTitle] = React.useState("");
  const [addingStage, setAddingStage] = React.useState(false);
  const [editing, setEditing] = React.useState<TaskView | null>(null);
  const [editingM, setEditingM] = React.useState<MilestoneView | null>(null);
  const [removing, setRemoving] = React.useState<{ kind: "task"; t: TaskView } | { kind: "milestone"; m: MilestoneView } | null>(null);
  const quick = React.useRef<HTMLInputElement>(null);

  const visible = (t: TaskView) =>
    filter === "all" || (filter === "open" && !t.completedAt) || (filter === "done" && !!t.completedAt) || (filter === "due" && !!today && ["overdue", "today", "soon"].includes(dueState(t.dueDate, today, !!t.completedAt)));
  const groups: { m: MilestoneView | null; tasks: TaskView[] }[] = [...c.milestones.map((m) => ({ m, tasks: c.tasks.filter((t) => t.milestoneId === m.id) })), { m: null, tasks: c.tasks.filter((t) => !t.milestoneId) }];

  /** Moves a to-do one place within its stage, sending the full order so the server can check nothing changed meanwhile. */
  function move(t: TaskView, dir: -1 | 1) {
    const group = c.tasks.filter((x) => x.milestoneId === t.milestoneId);
    const i = group.findIndex((x) => x.id === t.id);
    const other = group[i + dir];
    if (!other) return;
    const ids = c.tasks.map((x) => x.id);
    const a = ids.indexOf(t.id);
    const b = ids.indexOf(other.id);
    [ids[a], ids[b]] = [ids[b]!, ids[a]!];
    void run(`move-${t.id}`, `/api/campaigns/${c.id}/tasks/reorder`, json("POST", { ids }), `Moved “${t.title}” ${dir < 0 ? "up" : "down"}.`);
  }

  function addTodo(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    void run("add-task", `/api/campaigns/${c.id}/tasks`, json("POST", { title, dueDate: due || null, milestoneId: milestone || null }), "To-do added.").then((r) => {
      if (!r) return;
      setTitle("");
      setDue("");
      quick.current?.focus();
    });
  }

  const iconBtn = "grid size-8 place-items-center rounded-full text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-primary/30 disabled:opacity-30";

  return (
    <div className="grid gap-4">
      <form onSubmit={addTodo} className="rounded-3xl border bg-card p-3 shadow-soft sm:p-4" aria-label="Add a to-do">
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="t-title" className="sr-only">
            New to-do
          </label>
          <span className="relative min-w-0 flex-1 basis-60">
            <Plus className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-primary" aria-hidden />
            <input id="t-title" ref={quick} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={TASK_TITLE_MAX} className={cn(field, "ps-10")} placeholder="Add a to-do and press Enter, e.g. Write captions" autoComplete="off" />
          </span>
          <label htmlFor="t-due" className="sr-only">
            Due date
          </label>
          <input id="t-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} className={cn(field, "w-auto px-3")} title="Due date (optional)" />
          {c.milestones.length ? (
            <>
              <label htmlFor="t-milestone" className="sr-only">
                Stage
              </label>
              <select id="t-milestone" value={milestone} onChange={(e) => setMilestone(e.target.value)} className={cn(field, "w-auto max-w-44")}>
                <option value="">No stage</option>
                {c.milestones.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </select>
            </>
          ) : null}
          <button type="submit" className={primaryButton} disabled={!title.trim() || busy !== null || c.tasks.length >= TASKS_MAX}>
            {busy === "add-task" ? "Adding…" : "Add"}
          </button>
        </div>
      </form>

      {c.tasks.length ? (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Show to-dos">
          {(
            [
              ["all", "All"],
              ["open", "Still to do"],
              ["due", "Due soon or late"],
              ["done", "Done"],
            ] as const
          ).map(([k, v]) => (
            <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)} className={cn("rounded-full border px-3 py-1.5 text-[0.8rem] font-semibold outline-none focus-visible:ring-3 focus-visible:ring-primary/30", filter === k ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground")}>
              {v}
            </button>
          ))}
        </div>
      ) : null}

      {c.tasks.length === 0 && c.milestones.length === 0 ? (
        <div className="flex flex-col items-center rounded-3xl border border-dashed bg-card px-6 py-10 text-center">
          <EmptyIllustration icon={ListChecks} />
          <p className="mt-3 font-heading text-lg font-bold">What needs to get done?</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">Type your first to-do above and press Enter. Tick each one off as you go and your progress updates on its own.</p>
        </div>
      ) : (
        groups.map(({ m, tasks }) => {
          if (!m && !tasks.length) return null;
          const shown = tasks.filter(visible);
          const p = m ? milestoneProgress(m.id, c.tasks) : null;
          const late = m && today && m.dueDate && !p?.reached && m.dueDate < today;
          return (
            <section key={m?.id ?? "none"} className="rounded-3xl border bg-card shadow-soft" aria-label={m ? `Stage: ${m.title}` : "Other to-dos"}>
              <header className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
                {m ? <Flag className={cn("size-4", p?.reached ? "text-emerald-600 dark:text-emerald-400" : "text-primary")} aria-hidden /> : null}
                <h2 className="min-w-0 flex-1 truncate font-bold">{m ? m.title : c.milestones.length ? "Other to-dos" : "To-dos"}</h2>
                {m?.dueDate ? (
                  <span className={cn("text-[0.76rem]", late ? "font-semibold text-destructive" : "text-muted-foreground")}>
                    {late ? "Late · " : "By "}
                    {formatDate(m.dueDate, { month: "short", day: "numeric" })}
                  </span>
                ) : null}
                {p ? <span className={cn("rounded-full px-2 py-0.5 text-[0.7rem] font-bold", p.reached ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground")}>{p.reached ? "Done" : p.total ? `${p.done}/${p.total}` : "Empty"}</span> : null}
                {m ? (
                  <span className="flex gap-1">
                    <button type="button" aria-label={`Edit stage ${m.title}`} disabled={busy !== null} onClick={() => setEditingM(m)} className={iconBtn}>
                      <Pencil className="size-3.5" aria-hidden />
                    </button>
                    <button type="button" aria-label={`Delete stage ${m.title}`} disabled={busy !== null} onClick={() => setRemoving({ kind: "milestone", m })} className={cn(iconBtn, "hover:bg-destructive/10 hover:text-destructive")}>
                      <Trash2 className="size-3.5" aria-hidden />
                    </button>
                  </span>
                ) : null}
              </header>
              {shown.length ? (
                <ul className="divide-y">
                  {shown.map((t) => {
                    const idx = tasks.findIndex((x) => x.id === t.id);
                    const ds = today ? dueState(t.dueDate, today, !!t.completedAt) : "none";
                    return (
                      <li key={t.id} className={cn("flex items-start gap-3 px-4 py-2.5", busy?.endsWith(t.id) && "opacity-60")}>
                        <input
                          type="checkbox"
                          checked={!!t.completedAt}
                          disabled={busy !== null}
                          onChange={(e) => void run(`done-${t.id}`, `/api/campaigns/${c.id}/tasks/${t.id}`, json("PATCH", { completed: e.target.checked }))}
                          aria-label={`${t.completedAt ? "Mark not done" : "Mark done"}: ${t.title}`}
                          className="mt-1 size-[1.05rem] shrink-0 cursor-pointer accent-[#7047eb]"
                        />
                        <div className="min-w-0 flex-1">
                          <p className={cn("text-[0.9rem] font-medium break-words", t.completedAt && "text-muted-foreground line-through")}>{t.title}</p>
                          {t.dueDate || t.priority === "high" || t.notes ? (
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.72rem]">
                              {t.priority === "high" ? <span className={cn("rounded-full px-2 py-0.5 font-semibold", PRIORITY_STYLE.high)}>Important</span> : null}
                              {t.dueDate ? (
                                <span className={cn(ds === "overdue" ? "font-semibold text-destructive" : ds === "today" ? "font-semibold text-primary" : "text-muted-foreground")}>
                                  {ds === "overdue" ? "Late · " : ds === "today" ? "Today · " : "Due "}
                                  {formatDate(t.dueDate, { month: "short", day: "numeric" })}
                                </span>
                              ) : null}
                              {t.notes ? <span className="max-w-full truncate text-muted-foreground">{t.notes}</span> : null}
                            </div>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 items-center">
                          <button type="button" aria-label={`Move ${t.title} up`} disabled={busy !== null || idx <= 0} onClick={() => move(t, -1)} className={cn(iconBtn, "max-sm:hidden")}>
                            <ArrowUp className="size-3.5" aria-hidden />
                          </button>
                          <button type="button" aria-label={`Move ${t.title} down`} disabled={busy !== null || idx >= tasks.length - 1} onClick={() => move(t, 1)} className={cn(iconBtn, "max-sm:hidden")}>
                            <ArrowDown className="size-3.5" aria-hidden />
                          </button>
                          <button type="button" aria-label={`Edit ${t.title}`} disabled={busy !== null} onClick={() => setEditing(t)} className={iconBtn}>
                            <Pencil className="size-3.5" aria-hidden />
                          </button>
                          <button type="button" aria-label={`Delete ${t.title}`} disabled={busy !== null} onClick={() => setRemoving({ kind: "task", t })} className={cn(iconBtn, "hover:bg-destructive/10 hover:text-destructive")}>
                            <Trash2 className="size-3.5" aria-hidden />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="px-4 py-3 text-[0.82rem] text-muted-foreground">{tasks.length ? "Nothing here for this filter." : "No to-dos in this stage yet. Pick it when adding a to-do above."}</p>
              )}
            </section>
          );
        })
      )}

      {addingStage ? (
        <form
          className="flex flex-wrap items-end gap-2 rounded-3xl border border-dashed bg-card p-3 sm:p-4"
          aria-label="Add a stage"
          onSubmit={(e) => {
            e.preventDefault();
            if (!mTitle.trim()) return;
            void run("add-ms", `/api/campaigns/${c.id}/milestones`, json("POST", { title: mTitle }), "Stage added.").then((r) => {
              if (!r) return;
              setMTitle("");
              setAddingStage(false);
            });
          }}
        >
          <div className="min-w-0 flex-1 basis-56">
            <label htmlFor="m-title" className={label}>
              Stage name
            </label>
            <input id="m-title" value={mTitle} onChange={(e) => setMTitle(e.target.value)} maxLength={MILESTONE_TITLE_MAX} autoFocus className={cn(field, "mt-1.5")} placeholder="e.g. Get ready, Launch day, Follow up" />
          </div>
          <button type="submit" className={primaryButton} disabled={!mTitle.trim() || busy !== null}>
            {busy === "add-ms" ? "Adding…" : "Add stage"}
          </button>
          <button type="button" className={quietButton} onClick={() => setAddingStage(false)}>
            Cancel
          </button>
        </form>
      ) : c.milestones.length < MILESTONES_MAX ? (
        <div>
          <button type="button" disabled={busy !== null} onClick={() => setAddingStage(true)} className="inline-flex items-center gap-1.5 rounded-full px-1 text-[0.86rem] font-semibold text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-primary/30">
            <Flag className="size-4" aria-hidden /> Add a stage
          </button>
          <p className="mt-0.5 text-[0.76rem] text-muted-foreground">Stages group your to-dos into steps, like “Get ready” and “Launch day”. A stage is done when all its to-dos are.</p>
        </div>
      ) : null}

      {editing ? <TaskDialog key={editing.id} c={c} t={editing} onClose={() => setEditing(null)} action={action} /> : null}
      {editingM ? <MilestoneDialog key={editingM.id} c={c} m={editingM} onClose={() => setEditingM(null)} action={action} /> : null}
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={removing?.kind === "milestone" ? `Delete the stage ${removing.m.title}?` : removing ? `Delete the to-do ${removing.t.title}?` : "Delete?"}
        description={removing?.kind === "milestone" ? "Its to-dos are kept and move to “Other to-dos”." : "This can't be undone."}
        confirmLabel="Delete"
        tone="danger"
        icon={Trash2}
        onConfirm={() => {
          const r = removing;
          setRemoving(null);
          if (r?.kind === "milestone") void run(`del-${r.m.id}`, `/api/campaigns/${c.id}/milestones/${r.m.id}`, json("DELETE"), "Stage deleted. Its to-dos were kept.");
          else if (r) void run(`del-${r.t.id}`, `/api/campaigns/${c.id}/tasks/${r.t.id}`, json("DELETE"), "To-do deleted.");
        }}
      />
    </div>
  );
}

function TaskDialog({ c, t, onClose, action }: { c: CampaignView; t: TaskView; onClose: () => void; action: Action }) {
  const [title, setTitle] = React.useState(t.title);
  const [notes, setNotes] = React.useState(t.notes);
  const [due, setDue] = React.useState(t.dueDate ?? "");
  const [priority, setPriority] = React.useState<TaskPriority>(t.priority);
  const [milestone, setMilestone] = React.useState(t.milestoneId ?? "");
  return (
    <DialogFrame
      open
      onClose={onClose}
      title="Edit to-do"
      footer={
        <>
          <button type="button" className={quietButton} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="edit-task" className={primaryButton} disabled={!title.trim() || action.busy !== null}>
            Save to-do
          </button>
        </>
      }
    >
      <form
        id="edit-task"
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void action.run(`edit-${t.id}`, `/api/campaigns/${c.id}/tasks/${t.id}`, json("PATCH", { title, notes, dueDate: due || null, priority, milestoneId: milestone || null, expectedVersion: t.version }), "To-do saved.").then((r) => r && onClose());
        }}
      >
        <div>
          <label htmlFor="et-title" className={label}>
            To-do
          </label>
          <input id="et-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={TASK_TITLE_MAX} className={cn(field, "mt-1.5")} />
        </div>
        <div>
          <label htmlFor="et-notes" className={label}>
            Notes
          </label>
          <textarea id="et-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={TASK_NOTES_MAX} rows={3} className={cn(field, "mt-1.5 resize-y")} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="et-due" className={label}>
              Due date
            </label>
            <input id="et-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} className={cn(field, "mt-1.5 px-2.5")} />
          </div>
          <div>
            <label htmlFor="et-priority" className={label}>
              Priority
            </label>
            <select id="et-priority" value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)} className={cn(field, "mt-1.5")}>
              {TASK_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABEL[p]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="et-milestone" className={label}>
            Stage
          </label>
          <select id="et-milestone" value={milestone} onChange={(e) => setMilestone(e.target.value)} className={cn(field, "mt-1.5")}>
            <option value="">No stage</option>
            {c.milestones.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </select>
        </div>
        <NoticeBar notice={action.notice?.ok === false ? action.notice : null} />
      </form>
    </DialogFrame>
  );
}

function MilestoneDialog({ c, m, onClose, action }: { c: CampaignView; m: MilestoneView; onClose: () => void; action: Action }) {
  const [title, setTitle] = React.useState(m.title);
  const [due, setDue] = React.useState(m.dueDate ?? "");
  return (
    <DialogFrame
      open
      onClose={onClose}
      title="Edit stage"
      footer={
        <>
          <button type="button" className={quietButton} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="edit-ms" className={primaryButton} disabled={!title.trim() || action.busy !== null}>
            Save stage
          </button>
        </>
      }
    >
      <form
        id="edit-ms"
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void action.run(`editm-${m.id}`, `/api/campaigns/${c.id}/milestones/${m.id}`, json("PATCH", { title, dueDate: due || null, expectedVersion: m.version }), "Stage saved.").then((r) => r && onClose());
        }}
      >
        <div>
          <label htmlFor="em-title" className={label}>
            Stage name
          </label>
          <input id="em-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={MILESTONE_TITLE_MAX} className={cn(field, "mt-1.5")} />
        </div>
        <div>
          <label htmlFor="em-due" className={label}>
            Finish by <span className="font-normal text-muted-foreground">(shows on your calendar)</span>
          </label>
          <input id="em-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} className={cn(field, "mt-1.5")} />
        </div>
        <NoticeBar notice={action.notice?.ok === false ? action.notice : null} />
      </form>
    </DialogFrame>
  );
}

/* -------------------------------------------------------------------------- */
/*  Content                                                                   */
/* -------------------------------------------------------------------------- */

function plannedLabel(p: PostView) {
  const when = p.scheduledAt ?? p.plannedAt;
  if (!when) return "Not on the calendar";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: p.timezone }).format(Date.parse(when));
}

function Content({ c, linked, all, brands, campaignNames, action }: { c: CampaignView; linked: PostView[]; all: PostView[]; brands: BrandSummary[]; campaignNames: Record<string, string>; action: Action }) {
  const { busy, run } = action;
  const [brand, setBrand] = React.useState("");
  const [platform, setPlatform] = React.useState<SocialProviderId | "">("");
  const [picking, setPicking] = React.useState(false);
  const [unlinking, setUnlinking] = React.useState<PostView | null>(null);
  const byId = new Map(brands.map((b) => [b.id, b]));
  const shown = linked.filter((p) => (brand === "" || (brand === "none" ? !p.brandId : p.brandId === brand)) && (!platform || p.providers.includes(platform)));

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Filter by brand" value={brand} onChange={(e) => setBrand(e.target.value)} className={cn(compactField, "max-w-44")}>
          <option value="">All brands</option>
          <option value="none">No brand</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <select aria-label="Filter by platform" value={platform} onChange={(e) => setPlatform(e.target.value as SocialProviderId | "")} className={compactField}>
          <option value="">All platforms</option>
          {SOCIAL_PROVIDER_IDS.map((p) => (
            <option key={p} value={p}>
              {SOCIAL_PLATFORM[p].name}
            </option>
          ))}
        </select>
        <div className="ms-auto flex flex-wrap gap-2">
          <Link href={PUBLISHING_ROUTES.calendar} className={cn(quietButton, "h-10")}>
            <CalendarDays className="size-4" aria-hidden /> Calendar
          </Link>
          <Link href={CONTENT_ROUTES.library} className={cn(quietButton, "h-10")}>
            <Library className="size-4" aria-hidden /> Content Library
          </Link>
          <button type="button" className={cn(primaryButton, "h-10")} disabled={busy !== null} onClick={() => setPicking(true)}>
            <Link2 className="size-4" aria-hidden /> Add posts
          </button>
        </div>
      </div>
      {c.brandId ? <p className="mt-2 text-[0.78rem] text-muted-foreground">This plan is for {byId.get(c.brandId)?.name ?? "a brand"}, so only its posts (or posts without a brand) can be added.</p> : null}

      {linked.length === 0 ? (
        <div className="mt-4 flex flex-col items-center rounded-3xl border border-dashed bg-card px-6 py-12 text-center">
          <EmptyIllustration icon={FileText} />
          <p className="mt-3 font-heading text-lg font-bold">No posts in this plan yet</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">Add drafts you&apos;ve written in your Content Library. They stay there too, with their own dates; nothing is copied.</p>
        </div>
      ) : shown.length === 0 ? (
        <p className="mt-4 rounded-2xl border bg-card px-4 py-6 text-center text-sm text-muted-foreground">No posts match these filters.</p>
      ) : (
        <ul className="mt-4 divide-y overflow-hidden rounded-2xl border bg-card shadow-soft" aria-label="Posts in this plan">
          {shown.map((p) => {
            const b = p.brandId ? byId.get(p.brandId) : undefined;
            return (
              <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                <div className="min-w-0 flex-1 basis-60">
                  <p className="truncate font-semibold">{headline(p)}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[0.74rem] text-muted-foreground">
                    <StateBadge state={p.state} />
                    <span>{plannedLabel(p)}</span>
                    {b ? <BrandChip brand={b} /> : null}
                    {p.archivedAt ? <span className="rounded-full border border-dashed px-2 py-0.5">Archived</span> : null}
                  </div>
                </div>
                <PlatformStack providers={p.providers} />
                <div className="flex gap-1.5">
                  <Link href={postHref(p.id)} className={cn(quietButton, "h-9 px-3 text-[0.8rem]")}>
                    <ExternalLink className="size-3.5" aria-hidden /> Open
                  </Link>
                  <button type="button" disabled={busy !== null} onClick={() => setUnlinking(p)} className={cn(quietButton, "h-9 px-3 text-[0.8rem]")} aria-label={`Remove ${headline(p)} from this plan`}>
                    <Unlink className="size-3.5" aria-hidden /> Remove
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {picking ? <LinkDialog c={c} all={all} brands={brands} campaignNames={campaignNames} action={action} onClose={() => setPicking(false)} /> : null}
      <ConfirmDialog
        open={unlinking !== null}
        onOpenChange={(o) => !o && setUnlinking(null)}
        title="Remove this post from the plan?"
        description="It stays in your Content Library with all its text, images, brand and planned date."
        confirmLabel="Remove"
        icon={Unlink}
        onConfirm={() => {
          const p = unlinking;
          setUnlinking(null);
          if (p) void run(`unlink-${p.id}`, `/api/campaigns/${c.id}/content`, json("DELETE", { postId: p.id }), "Removed from the plan. The post is still in your Content Library.");
        }}
      />
    </div>
  );
}

function LinkDialog({ c, all, brands, campaignNames, action, onClose }: { c: CampaignView; all: PostView[]; brands: BrandSummary[]; campaignNames: Record<string, string>; action: Action; onClose: () => void }) {
  const [q, setQ] = React.useState("");
  const [brand, setBrand] = React.useState(c.brandId ?? "");
  const [platform, setPlatform] = React.useState<SocialProviderId | "">("");
  const [picked, setPicked] = React.useState<string[]>([]);
  const [result, setResult] = React.useState<string | null>(null);
  const term = q.trim().toLowerCase();
  const candidates = all.filter((p) => p.campaignId !== c.id && !p.archivedAt);
  const shown = candidates.filter((p) => (!term || `${p.title ?? ""} ${p.text} ${p.hashtags.join(" ")}`.toLowerCase().includes(term)) && (brand === "" || (brand === "none" ? !p.brandId : p.brandId === brand)) && (!platform || p.providers.includes(platform)));
  const blocked = (p: PostView) => (p.campaignId ? `In “${campaignNames[p.campaignId] ?? "another plan"}”` : c.brandId && p.brandId && p.brandId !== c.brandId ? "For another brand" : null);

  return (
    <DialogFrame
      open
      wide
      onClose={onClose}
      title="Add posts to this plan"
      description="Choose drafts from your Content Library. Nothing is copied: they keep their own text, images and dates."
      footer={
        <>
          <button type="button" className={quietButton} onClick={onClose}>
            {result ? "Done" : "Cancel"}
          </button>
          <button
            type="button"
            className={primaryButton}
            disabled={!picked.length || action.busy !== null}
            onClick={() =>
              void action
                .run<{ linked: number; skipped: { id: string; reason: string }[] }>("link", `/api/campaigns/${c.id}/content`, json("POST", { postIds: picked }), (d) => `Added ${d.linked} ${d.linked === 1 ? "post" : "posts"}.${d.skipped.length ? ` ${d.skipped.length} skipped: ${d.skipped[0]!.reason}` : ""}`)
                .then((r) => {
                  if (!r) return;
                  setPicked([]);
                  if (r.skipped.length) setResult(`${r.skipped.length} couldn't be added: ${r.skipped.map((s) => s.reason).join(" ")}`);
                  else onClose();
                })
            }
          >
            <Check className="size-4" aria-hidden /> {action.busy === "link" ? "Adding…" : picked.length ? `Add ${picked.length} ${picked.length === 1 ? "post" : "posts"}` : "Add posts"}
          </button>
        </>
      }
    >
      <div className="flex flex-wrap gap-2">
        <label className="relative min-w-0 flex-1 basis-48">
          <span className="sr-only">Search your content</span>
          <Search className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your content" className={cn(compactField, "w-full ps-10")} autoFocus />
        </label>
        <select aria-label="Brand" value={brand} onChange={(e) => setBrand(e.target.value)} className={cn(compactField, "max-w-40")}>
          <option value="">All brands</option>
          <option value="none">No brand</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
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
      </div>
      {result ? (
        <p role="alert" className="mt-3 rounded-2xl bg-amber-500/10 px-3 py-2 text-[0.8rem] text-amber-800 dark:text-amber-200">
          {result}
        </p>
      ) : null}
      {shown.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">{candidates.length ? "No content matches these filters." : "There are no other drafts yet. Write one in the Content Library first."}</p>
      ) : (
        <fieldset className="mt-3">
          <legend className="sr-only">Posts to add</legend>
          <ul className="divide-y rounded-2xl border">
            {shown.map((p) => {
              const why = blocked(p);
              const on = picked.includes(p.id);
              return (
                <li key={p.id}>
                  <label className={cn("flex items-start gap-3 px-3.5 py-2.5", why ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-muted/50")}>
                    <input type="checkbox" className="mt-1 size-4 accent-[#7047eb]" disabled={!!why || (!on && picked.length >= LINK_MAX)} checked={on} onChange={() => setPicked(on ? picked.filter((x) => x !== p.id) : [...picked, p.id])} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.88rem] font-medium">{headline(p)}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[0.72rem] text-muted-foreground">
                        <span>{POST_STATE_LABEL[p.state as PostState]}</span>
                        <span>{plannedLabel(p)}</span>
                        {why ? <span className="font-semibold text-destructive">{why}</span> : null}
                      </span>
                    </span>
                    <PlatformStack providers={p.providers} max={3} />
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>
      )}
    </DialogFrame>
  );
}

/* -------------------------------------------------------------------------- */
/*  Report                                                                    */
/* -------------------------------------------------------------------------- */

function Report({ c, linked, today }: { c: CampaignView; linked: PostView[]; today: string | null }) {
  const done = c.tasks.filter((t) => t.completedAt).length;
  const pct = percent(done, c.tasks.length);
  const byPriority = TASK_PRIORITIES.map((p) => ({ p, open: c.tasks.filter((t) => t.priority === p && !t.completedAt).length, total: c.tasks.filter((t) => t.priority === p).length }));
  const states = [...new Set(linked.map((p) => p.state))].map((s) => ({ s, n: linked.filter((p) => p.state === s).length }));
  const overdue = today ? c.tasks.filter((t) => dueState(t.dueDate, today, !!t.completedAt) === "overdue").length : null;
  const summary =
    c.tasks.length === 0
      ? "No to-dos yet, so there's no progress to show."
      : `${done} of ${c.tasks.length} to-dos are done (${pct}%)${c.milestones.length ? `, ${c.milestones.filter((m) => milestoneProgress(m.id, c.tasks).reached).length} of ${c.milestones.length} stages done` : ""}${overdue ? `, and ${overdue} ${overdue === 1 ? "to-do is" : "to-dos are"} late` : ""}. The plan has ${linked.length} ${linked.length === 1 ? "post" : "posts"}.`;

  return (
    <div className="grid gap-4">
      <section className={card} aria-labelledby="rp-summary">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="rp-summary" className="font-heading text-[1rem] font-bold">
              Summary
            </h2>
            <p className="mt-1 max-w-2xl text-[0.9rem]">{summary}</p>
          </div>
          <a href={`/api/campaigns/${c.id}/export`} download className={cn(quietButton, "h-10")}>
            <Download className="size-4" aria-hidden /> Export CSV
          </a>
        </div>
        <p className="mt-3 text-[0.74rem] text-muted-foreground">Counted from your own to-dos, stages and posts. Sociotix doesn&apos;t guess reach, engagement or sales.</p>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={card} aria-labelledby="rp-tasks">
          <h2 id="rp-tasks" className="font-heading text-[1rem] font-bold">
            To-dos
          </h2>
          <Progress done={done} total={c.tasks.length} className="mt-3" />
          <table className="mt-4 w-full text-[0.84rem]">
            <caption className="sr-only">To-dos by priority</caption>
            <thead>
              <tr className="text-start text-[0.74rem] text-muted-foreground">
                <th scope="col" className="pb-1.5 text-start font-semibold">
                  Priority
                </th>
                <th scope="col" className="pb-1.5 text-end font-semibold">
                  Still to do
                </th>
                <th scope="col" className="pb-1.5 text-end font-semibold">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {byPriority.map((r) => (
                <tr key={r.p}>
                  <th scope="row" className="py-1.5 text-start font-medium">
                    {PRIORITY_LABEL[r.p]}
                  </th>
                  <td className="py-1.5 text-end tabular-nums">{r.open}</td>
                  <td className="py-1.5 text-end tabular-nums">{r.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className={card} aria-labelledby="rp-content">
          <h2 id="rp-content" className="font-heading text-[1rem] font-bold">
            Posts
          </h2>
          <p className="mt-2 font-heading text-2xl font-extrabold tabular-nums">{linked.length}</p>
          <p className="text-[0.76rem] text-muted-foreground">in this plan</p>
          {states.length ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {states.map(({ s, n }) => (
                <li key={s} className="inline-flex items-center gap-1.5 text-[0.8rem]">
                  <StateBadge state={s} /> <span className="tabular-nums">{n}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>

      <section className={card} aria-labelledby="rp-ms">
        <h2 id="rp-ms" className="font-heading text-[1rem] font-bold">
          Stages and timeline
        </h2>
        <div className="mt-3">
          <Timeline c={c} today={today} />
        </div>
        {c.milestones.length ? (
          <ol className="mt-4 grid gap-3">
            {c.milestones.map((m) => {
              const p = milestoneProgress(m.id, c.tasks);
              return (
                <li key={m.id} className="grid gap-1.5 sm:grid-cols-[minmax(0,1fr)_14rem] sm:items-center sm:gap-4">
                  <div className="flex min-w-0 items-center gap-2">
                    <Flag className={cn("size-4 shrink-0", p.reached ? "text-emerald-600 dark:text-emerald-400" : "text-primary")} aria-hidden />
                    <span className="truncate font-medium">{m.title}</span>
                    <span className="shrink-0 text-[0.74rem] text-muted-foreground">{m.dueDate ? formatDate(m.dueDate, { month: "short", day: "numeric" }) : "No date"}</span>
                  </div>
                  <Progress done={p.done} total={p.total} />
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="mt-3 text-[0.84rem] text-muted-foreground">No stages yet.</p>
        )}
      </section>
    </div>
  );
}
