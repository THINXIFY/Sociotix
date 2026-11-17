"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, Check, CircleAlert, Flag, History, Link2, Palette, PenLine, Sparkles, type LucideIcon } from "lucide-react";
import { useHydrated } from "@/components/dashboard/shared";
import { BRAND_ROUTES } from "@/lib/brand";
import { CAMPAIGN_ROUTES, campaignHref, localToday } from "@/lib/campaign";
import { CONTENT_ROUTES } from "@/lib/social/content";
import { SOCIAL_ROUTES } from "@/lib/social/platforms";
import { postHref, PUBLISHING_ROUTES, type PostView, type PublishingData } from "@/lib/social/publishing";
import { cn } from "@/lib/utils";
import { EasyGuide } from "./easy-guide";
import { eyebrow, page, primaryButton } from "./parts";

/*
 * "Start here": the home of the marketing area. One checklist built from the customer's own data, the four things
 * people do most, what's coming up, and a short list of the other tools. Nothing here is sample data.
 */

interface Step {
  done: boolean;
  title: string;
  body: string;
  href: string;
  cta: string;
  soon?: boolean;
}

const headline = (p: PostView) => p.title?.trim() || p.text.trim().split("\n")[0]?.slice(0, 70) || "Untitled post";
const card = "rounded-3xl border bg-card p-4 shadow-soft sm:p-5";

export function StartHere({ data }: { data: PublishingData }) {
  const hydrated = useHydrated();
  const [now] = React.useState(() => Date.now());
  const { posts, content, workspace } = data;
  const connected = workspace.accounts.filter((a) => a.status === "active").length;
  const canConnect = workspace.platforms.some((p) => p.availability.state === "available");
  const planned = posts.filter((p) => !p.archivedAt && (p.plannedAt || p.scheduledAt));
  const livePlans = content.campaigns.filter((c) => c.status !== "archived");
  const attention = workspace.accounts.filter((a) => a.health === "action_needed" || a.health === "sync_issue");

  const steps: Step[] = [
    { done: content.brands.length > 0, title: "Set up your brand", body: "Your logo, colours and how you like to sound.", href: content.brands.length ? BRAND_ROUTES.kit : BRAND_ROUTES.create, cta: "Create your brand" },
    { done: posts.length > 0, title: "Write your first post", body: "Write once, then adjust it for each platform.", href: PUBLISHING_ROUTES.compose, cta: "Write a post" },
    { done: planned.length > 0, title: "Put a post on the calendar", body: "Give a post a date so you can see your month.", href: PUBLISHING_ROUTES.calendar, cta: "Open the calendar" },
    { done: content.campaigns.length > 0, title: "Make a marketing plan", body: "Group a launch, sale or event with its to-dos.", href: CAMPAIGN_ROUTES.create, cta: "Make a plan" },
    { done: connected > 0, title: "Connect a social account", body: canConnect ? "So your posts can be published later." : "Coming soon: platforms still need to approve Sociotix.", href: SOCIAL_ROUTES.accounts, cta: canConnect ? "Connect an account" : "See platforms", soon: !canConnect },
  ];
  const counted = steps.filter((s) => !s.soon);
  const doneCount = counted.filter((s) => s.done).length;
  const allDone = doneCount === counted.length;
  const next = steps.find((s) => !s.done && !s.soon);

  // Coming up in the next 14 days: planned posts and plan dates. Dates need the viewer's clock, so after hydration.
  const today = hydrated ? localToday() : null;
  const soon = today
    ? [
        ...planned
          .map((p) => ({ when: p.scheduledAt ?? p.plannedAt!, p }))
          .filter((x) => Date.parse(x.when) >= now && Date.parse(x.when) - now <= 14 * 86_400_000)
          .map((x) => ({ key: x.p.id, sort: x.when.slice(0, 10), day: new Date(x.when), label: headline(x.p), kind: "Post", href: postHref(x.p.id) })),
        ...livePlans.flatMap((c) =>
          [
            ...c.milestones.filter((m) => m.dueDate && !m.done).map((m) => ({ key: m.id, date: m.dueDate!, label: `${m.title} · ${c.name}` })),
            ...(c.startDate ? [{ key: `${c.id}-s`, date: c.startDate, label: `${c.name} starts` }] : []),
            ...(c.endDate ? [{ key: `${c.id}-e`, date: c.endDate, label: `${c.name} ends` }] : []),
          ]
            .filter((e) => e.date >= today && Date.parse(`${e.date}T00:00:00`) - Date.parse(`${today}T00:00:00`) <= 14 * 86_400_000)
            .map((e) => ({ key: e.key, sort: e.date, day: new Date(`${e.date}T00:00:00`), label: e.label, kind: "Plan", href: campaignHref(c.id) })),
        ),
      ]
        .sort((a, b) => a.sort.localeCompare(b.sort))
        .slice(0, 6)
    : [];

  const stats = [
    { label: "Posts", value: posts.filter((p) => !p.archivedAt).length, href: CONTENT_ROUTES.library },
    { label: "On the calendar", value: planned.length, href: PUBLISHING_ROUTES.calendar },
    { label: "Marketing plans", value: livePlans.length, href: CAMPAIGN_ROUTES.home },
    { label: "Brands", value: content.brands.length, href: BRAND_ROUTES.kit },
  ];

  const actions: { href: string; icon: LucideIcon; title: string; body: string }[] = [
    { href: PUBLISHING_ROUTES.compose, icon: PenLine, title: "Write a post", body: "Draft a caption with hashtags and images." },
    { href: PUBLISHING_ROUTES.calendar, icon: CalendarDays, title: "Calendar", body: "See and move what's planned." },
    { href: CAMPAIGN_ROUTES.home, icon: Flag, title: "Marketing Plans", body: "Launches, sales and events with to-dos." },
    { href: BRAND_ROUTES.kit, icon: Palette, title: "Brand Kit", body: "Logo, colours and voice for your posts." },
  ];

  const more: { href: string; icon: LucideIcon; title: string; body: string }[] = [
    { href: "/dashboard/ai", icon: Sparkles, title: "AI tools", body: "Caption, hashtag and idea helpers. See what's available." },
    { href: SOCIAL_ROUTES.activity, icon: History, title: "Activity", body: "A log of account and publishing events." },
  ];

  return (
    <div className={page}>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className={cn(eyebrow, "text-primary")}>Marketing</p>
          <h1 className="mt-1.5 font-heading text-[1.6rem] leading-tight font-extrabold tracking-tight sm:text-[1.9rem]">Start here</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground sm:text-[0.95rem]">Write your posts, plan them on a calendar and keep every launch organised. Nothing is ever posted without you.</p>
        </div>
        <Link href={PUBLISHING_ROUTES.compose} className={primaryButton}>
          <PenLine className="size-4" aria-hidden /> Write a post
        </Link>
      </header>

      {attention.length ? (
        <p role="status" className="mt-4 flex items-start gap-2 rounded-2xl bg-soon-soft px-4 py-3 text-[0.85rem] font-medium text-soon">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {attention.length === 1 ? "One connected account needs" : `${attention.length} connected accounts need`} your attention.{" "}
            <Link href={SOCIAL_ROUTES.accounts} className="font-semibold underline">
              Check accounts
            </Link>
          </span>
        </p>
      ) : null}

      {allDone ? (
        <p className="mt-5 flex items-center gap-2.5 rounded-2xl border bg-card px-4 py-3 text-[0.9rem] shadow-soft">
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" aria-hidden>
            <Check className="size-4" />
          </span>
          <span>
            <strong className="font-semibold">You&apos;re all set up.</strong> <span className="text-muted-foreground">Use the shortcuts below to keep going.</span>
          </span>
        </p>
      ) : (
        <section className={cn(card, "mt-5 border-primary/30")} aria-labelledby="setup-h">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="setup-h" className="font-heading text-[1.1rem] font-bold">
                Get set up in a few minutes
              </h2>
              <p className="text-[0.82rem] text-muted-foreground">
                {doneCount} of {counted.length} done{next ? ` · Next: ${next.title.toLowerCase()}` : ""}
              </p>
            </div>
            <div className="h-2 w-40 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Setup progress" aria-valuenow={doneCount} aria-valuemin={0} aria-valuemax={counted.length}>
              <div className="h-full rounded-full bg-primary transition-[width] motion-reduce:transition-none" style={{ width: `${(doneCount / counted.length) * 100}%` }} />
            </div>
          </div>
          <ol className="mt-4 grid gap-2">
            {steps.map((s, i) => {
              const isNext = s === next;
              return (
                <li key={s.title} className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border p-3", isNext ? "border-primary/40 bg-primary/[0.04]" : s.done ? "border-dashed" : "bg-card")}>
                  <span className={cn("grid size-7 shrink-0 place-items-center rounded-full text-[0.78rem] font-bold", s.done ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-primary/10 text-primary dark:text-[#c4b5ff]")} aria-hidden>
                    {s.done ? <Check className="size-4" /> : i + 1}
                  </span>
                  <span className="min-w-0 flex-1 basis-48">
                    <span className={cn("block text-[0.9rem] font-semibold", s.done && "text-muted-foreground line-through")}>
                      {s.title}
                      {s.done ? <span className="sr-only"> (done)</span> : null}
                    </span>
                    <span className="block text-[0.78rem] text-muted-foreground">{s.body}</span>
                  </span>
                  {s.soon ? <span className="rounded-full border border-dashed px-2.5 py-0.5 text-[0.72rem] font-semibold text-muted-foreground">Coming soon</span> : null}
                  {!s.done ? (
                    <Link href={s.href} className={cn(isNext ? primaryButton : "inline-flex h-9 items-center gap-1 rounded-full border px-3.5 text-[0.82rem] font-semibold hover:bg-muted", isNext && "h-9 px-4 text-[0.84rem]")}>
                      {s.cta} <ArrowRight className="size-3.5" aria-hidden />
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <EasyGuide />

      <section className="mt-5" aria-labelledby="quick-h">
        <h2 id="quick-h" className="sr-only">
          Shortcuts
        </h2>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {actions.map((a) => (
            <li key={a.href}>
              <Link href={a.href} className="group flex h-full items-start gap-3 rounded-2xl border bg-card p-4 shadow-soft transition-colors hover:border-primary/40 focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary dark:text-[#c4b5ff]" aria-hidden>
                  <a.icon className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold group-hover:text-primary">{a.title}</span>
                  <span className="block text-[0.8rem] text-muted-foreground">{a.body}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <section className={cn(card, "lg:col-span-2")} aria-labelledby="soon-h">
          <h2 id="soon-h" className="font-heading text-[1rem] font-bold">
            Coming up in the next 2 weeks
          </h2>
          {!hydrated ? (
            <div className="mt-3 h-24 animate-pulse rounded-2xl bg-muted motion-reduce:animate-none" aria-hidden />
          ) : soon.length ? (
            <ul className="mt-2 divide-y">
              {soon.map((x) => (
                <li key={x.key}>
                  <Link href={x.href} className="flex items-center gap-3 rounded-lg py-2.5 outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/40">
                    <span className="w-14 shrink-0 text-center">
                      <span className="block text-[0.68rem] font-bold text-muted-foreground uppercase">{x.day.toLocaleDateString("en-US", { month: "short" })}</span>
                      <span className="block font-heading text-lg leading-none font-extrabold">{x.day.getDate()}</span>
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[0.88rem] font-medium">{x.label}</span>
                    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[0.68rem] font-bold", x.kind === "Post" ? "bg-primary/10 text-primary dark:text-[#c4b5ff]" : "bg-lime/50 text-[#2c3a00] dark:text-lime dark:bg-lime/15")}>{x.kind}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[0.86rem] text-muted-foreground">
              Nothing planned yet. Give a post a date on the{" "}
              <Link href={PUBLISHING_ROUTES.calendar} className="font-semibold text-primary hover:underline">
                calendar
              </Link>{" "}
              and it shows up here.
            </p>
          )}
        </section>

        <section className={card} aria-labelledby="glance-h">
          <h2 id="glance-h" className="font-heading text-[1rem] font-bold">
            At a glance
          </h2>
          <ul className="mt-3 grid grid-cols-2 gap-2.5">
            {stats.map((s) => (
              <li key={s.label}>
                <Link href={s.href} className="block rounded-2xl bg-muted/50 p-3 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-primary/30">
                  <span className="block text-[0.74rem] text-muted-foreground">{s.label}</span>
                  <span className="block font-heading text-xl font-extrabold tabular-nums">{s.value}</span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-3 flex items-center gap-1.5 text-[0.78rem] text-muted-foreground">
            <Link2 className="size-3.5" aria-hidden /> {connected ? `${connected} connected ${connected === 1 ? "account" : "accounts"}` : "No accounts connected yet"}
          </p>
        </section>
      </div>

      <section className="mt-5" aria-labelledby="more-h">
        <h2 id="more-h" className="font-heading text-[1rem] font-bold">
          More tools
        </h2>
        <ul className="mt-2 grid gap-3 sm:grid-cols-2">
          {more.map((m) => (
            <li key={m.href}>
              <Link href={m.href} className="flex h-full items-start gap-3 rounded-2xl border border-dashed p-3.5 transition-colors hover:border-primary/40 hover:bg-card focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none">
                <m.icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
                <span>
                  <span className="block text-[0.88rem] font-semibold">{m.title}</span>
                  <span className="block text-[0.78rem] text-muted-foreground">{m.body}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
