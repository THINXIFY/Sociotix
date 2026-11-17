"use client";

import * as React from "react";
import Link from "next/link";
import { BookOpen, CalendarDays, ChevronDown, FileText, Flag, Link2, Palette, Workflow, type LucideIcon } from "lucide-react";
import { BRAND_ROUTES } from "@/lib/brand";
import { CAMPAIGN_ROUTES } from "@/lib/campaign";
import { CONTENT_ROUTES } from "@/lib/social/content";
import { SOCIAL_ROUTES } from "@/lib/social/platforms";
import { PUBLISHING_ROUTES } from "@/lib/social/publishing";
import { cn } from "@/lib/utils";

/*
 * The easy guide on Start here: the whole marketing process in six plain steps, then the questions people ask most.
 * Written for someone who has never used a marketing tool. Every step links to the page it describes.
 */

interface GuideStep {
  icon: LucideIcon;
  title: string;
  what: string;
  how: string[];
  tip?: string;
  href: string;
  cta: string;
}

const STEPS: GuideStep[] = [
  {
    icon: Palette,
    title: "Set up your brand",
    what: "Tell Sociotix who you are, so every post looks and sounds like you.",
    how: ["Open Brand Kit and click “New brand”.", "Add your name, logo and colours.", "Write a few words about your audience and tone, and words you never use."],
    tip: "Have more than one business? Make one brand for each.",
    href: BRAND_ROUTES.kit,
    cta: "Open Brand Kit",
  },
  {
    icon: FileText,
    title: "Write your posts",
    what: "Posts is where everything you write is kept, like a notebook for your social media.",
    how: ["Click “Write a post”.", "Type your caption, add hashtags and images, and pick the platforms.", "Click “Save draft”. It stays private until you decide to use it."],
    tip: "Save a caption you like as a template to reuse it next time.",
    href: CONTENT_ROUTES.library,
    cta: "Open Posts",
  },
  {
    icon: CalendarDays,
    title: "Plan them on the calendar",
    what: "The calendar shows what you want to post and when, so you never miss a day.",
    how: ["Open Calendar and click “Add from library”.", "Pick a draft and choose a day and time.", "Click any post on the calendar to move it or change it."],
    tip: "Planning is just a reminder for you: nothing is posted automatically.",
    href: PUBLISHING_ROUTES.calendar,
    cta: "Open Calendar",
  },
  {
    icon: Flag,
    title: "Group big moments into a marketing plan",
    what: "A plan keeps a launch, sale or event together: the goal, a to-do list and its posts.",
    how: ["Open Marketing Plans and click “New plan”.", "Pick a ready-made starter, like “Seasonal sale”, or start blank.", "Tick off to-dos as you go and add the posts that belong to it."],
    tip: "The plan's dates and stages show up on your calendar as flags.",
    href: CAMPAIGN_ROUTES.home,
    cta: "Open Marketing Plans",
  },
  {
    icon: Workflow,
    title: "Let routines run by themselves",
    what: "Automations are repeating helpers, for example “every Monday, remind me to plan the week”.",
    how: ["Open Automations and choose a template.", "Pick when it runs and what it does: a reminder, a checklist or a review.", "Turn it on. Results appear in its inbox."],
    tip: "Automations never post anything. They only remind and prepare.",
    href: "/dashboard/social/automations",
    cta: "Open Automations",
  },
  {
    icon: Link2,
    title: "Connect your social accounts",
    what: "Link the accounts you manage, so Sociotix can show their status and, later, publish for you.",
    how: ["Open Connected accounts.", "Choose a platform and sign in there.", "Disconnect any time with one click."],
    tip: "Platforms must approve Sociotix first, so this may show as coming soon.",
    href: SOCIAL_ROUTES.accounts,
    cta: "Open Connected accounts",
  },
];

const FAQ: { q: string; a: string }[] = [
  { q: "Will Sociotix post anything without me?", a: "No. Drafts, calendar dates, plans and automations are all for your planning. Nothing is published unless you schedule it yourself on a connected account." },
  { q: "What's the difference between a post, a plan and an automation?", a: "A post is one thing you'll publish. A plan is a one-off project, like a launch, with to-dos and several posts. An automation is a routine that repeats, like a weekly reminder." },
  { q: "Do I have to do the steps in order?", a: "No. The order is just the easiest way to start. You can write posts before you set up a brand, for example." },
  { q: "Do I need to connect an account to use this?", a: "No. You can write, organise and plan everything without connecting anything." },
  { q: "Where are the AI tools?", a: "Under “More tools” on this page. They show what's available and what's coming soon." },
];

/** Closed by default; one click (or Enter/Space) opens it. */
export function EasyGuide() {
  const [open, setOpen] = React.useState(false);
  return (
    <section className="mt-5 rounded-3xl border bg-card shadow-soft" aria-labelledby="guide-btn">
      <h2 className="m-0">
        <button id="guide-btn" type="button" aria-expanded={open} aria-controls="easy-guide" onClick={() => setOpen(!open)} className="flex w-full items-center gap-3 rounded-3xl p-4 text-start outline-none focus-visible:ring-3 focus-visible:ring-primary/30 sm:p-5">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-lime/70 text-[#1b2400]" aria-hidden>
            <BookOpen className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-heading text-[1.1rem] font-bold">Easy guide: how everything works</span>
            <span className="block text-[0.82rem] font-normal text-muted-foreground">Six simple steps, from your brand to your posts. About 2 minutes to read.</span>
          </span>
          <span className="hidden text-[0.8rem] font-medium text-muted-foreground sm:inline">{open ? "Hide" : "Show"}</span>
          <ChevronDown className={cn("size-5 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none", open && "rotate-180")} aria-hidden />
        </button>
      </h2>

      <div id="easy-guide" hidden={!open} className="px-4 pb-5 sm:px-5">
        <ol className="grid gap-3 md:grid-cols-2">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex flex-col rounded-2xl border bg-background p-4 dark:bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-[0.9rem] font-bold text-primary-foreground" aria-hidden>
                  {i + 1}
                </span>
                <h3 className="flex min-w-0 items-center gap-2 font-semibold">
                  <s.icon className="size-4 shrink-0 text-primary" aria-hidden />
                  <span>
                    <span className="sr-only">Step {i + 1}: </span>
                    {s.title}
                  </span>
                </h3>
              </div>
              <p className="mt-2 text-[0.86rem]">{s.what}</p>
              <ul className="mt-2 grid gap-1">
                {s.how.map((h) => (
                  <li key={h} className="flex gap-2 text-[0.82rem] text-muted-foreground">
                    <span className="mt-[0.45rem] size-1.5 shrink-0 rounded-full bg-primary/60" aria-hidden />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
              {s.tip ? <p className="mt-2.5 rounded-xl bg-muted/60 px-3 py-2 text-[0.78rem]">💡 {s.tip}</p> : null}
              <Link href={s.href} className="mt-auto self-start pt-3 text-[0.84rem] font-semibold text-primary hover:underline">
                {s.cta} →
              </Link>
            </li>
          ))}
        </ol>

        <h3 className="mt-6 font-heading text-[1rem] font-bold">Common questions</h3>
        <div className="mt-2 divide-y rounded-2xl border">
          {FAQ.map((f) => (
            <details key={f.q} className="group px-4 py-3">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded text-[0.88rem] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-primary/40 [&::-webkit-details-marker]:hidden">
                {f.q}
                <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
              </summary>
              <p className="mt-2 text-[0.84rem] text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
