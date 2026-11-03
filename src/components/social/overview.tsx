"use client";

import Link from "next/link";
import { ArrowRight, CalendarClock, CalendarDays, CircleAlert, FileText, Lightbulb, Link2, ListChecks, PenLine, Send, ShieldCheck } from "lucide-react";
import { Panel } from "@/components/dashboard/shared";
import { SOCIAL_PLATFORM, SOCIAL_ROUTES, accountHref } from "@/lib/social/platforms";
import { postHref, type PostView, type PublishingData } from "@/lib/social/publishing";
import { cn } from "@/lib/utils";
import { ActivityList } from "./activity";
import { HealthPill, metricValue, page, primaryButton, quietButton, SocialHeader, SocialTile, When } from "./parts";
import { PlatformStack, StateBadge } from "./publishing-parts";

/*
 * Social workspace overview: a compact summary of the customer's own accounts
 * and posts, the next things on the calendar and recent activity. Every number
 * is counted from real records; with no accounts, nothing is invented.
 */

const UPCOMING = new Set(["planned", "scheduled"]);
const PUBLISHED = new Set(["published", "partly_published"]);
const when = (p: PostView) => p.scheduledAt ?? p.plannedAt;

const ACTIONS = [
  { href: "/dashboard/social/publishing/new", icon: PenLine, title: "Create post", body: "Draft once, adapt per platform." },
  { href: "/dashboard/social/calendar", icon: CalendarDays, title: "Calendar", body: "See your planned month." },
  { href: SOCIAL_ROUTES.accounts, icon: Link2, title: "Manage accounts", body: "Connections and their status." },
  { href: "/dashboard/social/campaigns", icon: Lightbulb, title: "Plan a campaign", body: "Themes and caption ideas." },
];

function QuickActions() {
  return (
    <ul className="mt-5 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4" aria-label="Quick actions">
      {ACTIONS.map((a) => (
        <li key={a.href}>
          <Link
            href={a.href}
            className="group flex h-full items-start gap-3 rounded-2xl border bg-card p-3 shadow-soft transition-[border-color,box-shadow,translate] duration-200 hover:-translate-y-px hover:border-primary/30 hover:shadow-[0_14px_30px_-22px_rgb(112_71_235/0.6)] focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:p-4"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/[0.08] text-primary dark:bg-primary/20 dark:text-[#c9bcff]" aria-hidden>
              <a.icon className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-1 text-sm font-semibold group-hover:text-primary">
                {a.title} <ArrowRight className="hidden size-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none sm:block rtl:-scale-x-100" aria-hidden />
              </span>
              <span className="mt-0.5 hidden text-[0.78rem] text-muted-foreground sm:block">{a.body}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Summary({ data }: { data: PublishingData }) {
  const { accounts } = data.workspace;
  const attention = accounts.filter((a) => a.health === "action_needed" || a.health === "sync_issue").length;
  const items = [
    { label: "Connected accounts", value: accounts.length, hint: attention ? `${attention} need attention` : accounts.length ? "All up to date" : "None connected yet", href: SOCIAL_ROUTES.accounts, Icon: Link2, alert: attention > 0 },
    { label: "Drafts", value: data.posts.filter((p) => p.state === "draft").length, hint: "Private until scheduled", href: "/dashboard/social/publishing", Icon: FileText },
    { label: "Upcoming", value: data.posts.filter((p) => UPCOMING.has(p.state)).length, hint: "Planned or scheduled", href: "/dashboard/social/calendar", Icon: CalendarClock },
    { label: "Published", value: data.posts.filter((p) => PUBLISHED.has(p.state)).length, hint: "Posted by Sociotix", href: SOCIAL_ROUTES.activity, Icon: Send },
  ];
  return (
    <ul className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-border shadow-soft lg:grid-cols-4" aria-label="Social summary">
      {items.map((it) => (
        <li key={it.label} className="bg-card">
          <Link href={it.href} className="group flex h-full items-center gap-3 px-3.5 py-3 transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none focus-visible:ring-inset sm:px-4">
            <span className={cn("hidden size-9 shrink-0 place-items-center rounded-xl sm:grid", it.alert ? "bg-soon-soft text-soon" : "bg-muted text-foreground/70")} aria-hidden>
              <it.Icon className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="flex items-baseline gap-2">
                <span className={cn("font-heading text-xl leading-none font-extrabold tabular-nums sm:text-2xl", it.alert && "text-soon")}>{it.value}</span>
                <span className="truncate text-[0.8rem] font-semibold">{it.label}</span>
              </span>
              <span className="mt-1 block truncate text-[0.7rem] text-muted-foreground">{it.hint}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Upcoming({ posts }: { posts: PostView[] }) {
  const next = posts
    .filter((p) => UPCOMING.has(p.state) && when(p))
    .sort((a, b) => when(a)!.localeCompare(when(b)!))
    .slice(0, 5);
  return (
    <Panel className="flex flex-col p-4 sm:p-5" aria-labelledby="upcoming-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="upcoming-title" className="flex items-center gap-2 font-heading text-base font-bold">
          <CalendarClock className="size-4 text-muted-foreground" aria-hidden /> Upcoming
        </h2>
        <Link href="/dashboard/social/calendar" className="inline-flex h-9 items-center rounded-full px-3 text-sm font-semibold text-primary hover:bg-secondary focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none">
          Calendar
        </Link>
      </div>
      {next.length ? (
        <ul className="mt-2 divide-y">
          {next.map((p) => (
            <li key={p.id}>
              <Link href={postHref(p.id)} className="group -mx-2 flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none">
                <PlatformStack providers={p.providers} max={3} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{p.title || p.text || "Untitled post"}</span>
                  <span className="block truncate text-[0.75rem] text-muted-foreground">
                    <When iso={when(p)!} />
                  </span>
                </span>
                <StateBadge state={p.state} />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-3 flex flex-1 flex-col items-start justify-center gap-2 rounded-xl border border-dashed p-4">
          <p className="text-sm font-semibold">Nothing planned yet</p>
          <p className="text-[0.8rem] text-muted-foreground">Give a draft a planned date and it shows up here and on your calendar. Planning never posts anything.</p>
          <Link href="/dashboard/social/publishing/new" className={cn(quietButton, "mt-1")}>
            <PenLine className="size-4" aria-hidden /> Plan a post
          </Link>
        </div>
      )}
    </Panel>
  );
}

function RecentActivity({ data }: { data: PublishingData }) {
  const events = data.workspace.events.slice(0, 6);
  return (
    <Panel className="flex flex-col p-4 sm:p-5" aria-labelledby="activity-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="activity-title" className="flex items-center gap-2 font-heading text-base font-bold">
          <ListChecks className="size-4 text-muted-foreground" aria-hidden /> Recent activity
        </h2>
        <Link href={SOCIAL_ROUTES.activity} className="inline-flex h-9 items-center rounded-full px-3 text-sm font-semibold text-primary hover:bg-secondary focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none">
          View all
        </Link>
      </div>
      {events.length ? (
        <ActivityList events={events} compact />
      ) : (
        <p className="mt-3 rounded-xl border border-dashed p-4 text-[0.8rem] text-muted-foreground">Connections, refreshes and publishing results appear here as they happen.</p>
      )}
    </Panel>
  );
}

/** No accounts yet: one compact card that explains connecting, instead of a full-width hero. */
function ConnectCard({ data }: { data: PublishingData }) {
  const available = data.workspace.platforms.filter((p) => p.availability.state === "available").length;
  return (
    <section aria-labelledby="connect-title" className="relative isolate overflow-hidden rounded-2xl bg-graphite p-5 text-white sm:p-6 dark:border dark:border-white/[0.06] dark:bg-[#121318]">
      <div className="pointer-events-none absolute -top-24 -end-16 -z-10 size-64 rounded-full bg-primary/30 blur-3xl" aria-hidden />
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h2 id="connect-title" className="font-heading text-lg font-extrabold tracking-tight sm:text-xl">
            Connect the accounts you manage
          </h2>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-white/65">
            {available
              ? `${available} platform${available === 1 ? " is" : "s are"} ready. Sign in on the platform itself — Sociotix gets read-only access and never sees your password.`
              : "Each platform has to approve Sociotix first, so none can be connected yet. You can still write, plan and organise posts today."}
          </p>
          <p className="mt-2 flex items-center gap-1.5 text-[0.75rem] text-white/50">
            <ShieldCheck className="size-3.5 shrink-0" aria-hidden /> Read-only. Sociotix never posts, messages or spends on your accounts without you.
          </p>
        </div>
        <Link href={SOCIAL_ROUTES.accounts} className={cn(primaryButton, "shrink-0 bg-lime px-5 whitespace-nowrap text-graphite shadow-none hover:bg-lime/90 focus-visible:ring-lime/40")}>
          {available ? "Connect an account" : "See every platform"} <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden />
        </Link>
      </div>
    </section>
  );
}

export function SocialOverview({ data }: { data: PublishingData }) {
  const { accounts } = data.workspace;
  const attention = accounts.filter((a) => a.health === "action_needed" || a.health === "sync_issue");

  return (
    <div className={page}>
      <SocialHeader
        title="Social workspace"
        subtitle="Your accounts, posts and what's coming up — in one calm place."
        action={
          <Link href="/dashboard/social/publishing/new" className={primaryButton}>
            <PenLine className="size-4" aria-hidden /> Create post
          </Link>
        }
      />

      <Summary data={data} />
      <QuickActions />

      {attention.length ? (
        <section aria-labelledby="attention-title" className="mt-5 rounded-2xl border border-soon/25 bg-soon-soft/60 p-4 sm:p-5">
          <h2 id="attention-title" className="flex items-center gap-2 text-sm font-bold text-soon">
            <CircleAlert className="size-4" aria-hidden /> Needs your attention
          </h2>
          <ul className="mt-2.5 space-y-2">
            {attention.map((a) => (
              <li key={a.id}>
                <Link href={accountHref(a.id)} className="flex items-center gap-3 rounded-xl bg-card px-3 py-2.5 transition-colors hover:bg-card/70 focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none">
                  <SocialTile provider={a.provider} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{a.displayName}</span>
                    <span className="block truncate text-[0.78rem] text-muted-foreground">{a.healthNote}</span>
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground rtl:-scale-x-100" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-5">{accounts.length ? null : <ConnectCard data={data} />}</div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Upcoming posts={data.posts} />
        <RecentActivity data={data} />
      </div>

      {accounts.length ? (
        <section aria-labelledby="accounts-title" className="mt-6">
          <div className="flex items-center justify-between gap-3">
            <h2 id="accounts-title" className="font-heading text-base font-bold">
              Connected accounts
            </h2>
            <Link href={SOCIAL_ROUTES.accounts} className="inline-flex h-9 items-center rounded-full px-3 text-sm font-semibold text-primary hover:bg-secondary focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none">
              Manage
            </Link>
          </div>
          <ul className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {accounts.map((a) => {
              const p = SOCIAL_PLATFORM[a.provider];
              return (
                <li key={a.id}>
                  <Link href={accountHref(a.id)} className="group flex h-full flex-col rounded-2xl border bg-card p-4 shadow-soft transition-[border-color,box-shadow] hover:border-primary/30 focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none">
                    <div className="flex items-start gap-3">
                      <SocialTile provider={a.provider} size="md" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-heading font-bold">{a.displayName}</p>
                        <p className="truncate text-sm text-muted-foreground">{a.handle ?? p.name}</p>
                      </div>
                      <HealthPill health={a.health} />
                    </div>
                    {a.metrics.length ? (
                      <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
                        {a.metrics.map((m) => (
                          <div key={m.capability}>
                            <dt className="text-[0.7rem] font-semibold text-muted-foreground">{m.label}</dt>
                            <dd className="font-heading text-lg font-extrabold tabular-nums">{metricValue(m.value)}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : (
                      <p className="mt-4 text-[0.8rem] text-muted-foreground">{p.capabilities.length > 1 ? "Figures appear after the next refresh." : `${p.name} shares profile details only.`}</p>
                    )}
                    <p className="mt-auto pt-4 text-[0.75rem] text-muted-foreground">{a.lastSyncAt ? <When iso={a.lastSyncAt} prefix="Refreshed" /> : "Not refreshed yet"}</p>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
