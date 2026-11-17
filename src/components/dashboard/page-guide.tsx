"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * "How this works" (marketing area): three short steps at the top of a page. It starts open while the page is empty
 * (when people need it) and closed otherwise, so returning users aren't slowed down. No storage: always predictable.
 */

export interface GuideStep {
  title: string;
  body: string;
  href?: string;
  cta?: string;
}

export function PageGuide({ id, steps, open: defaultOpen = false, title = "How this works", className }: { id: string; steps: GuideStep[]; open?: boolean; title?: string; className?: string }) {
  const [open, setOpen] = React.useState(defaultOpen);
  const panel = `${id}-guide`;
  return (
    <section className={cn("rounded-2xl border border-primary/20 bg-primary/[0.03] dark:bg-primary/[0.06]", className)} aria-labelledby={`${panel}-btn`}>
      <h2 className="m-0">
        <button id={`${panel}-btn`} type="button" aria-expanded={open} aria-controls={panel} onClick={() => setOpen(!open)} className="flex w-full items-center gap-2.5 rounded-2xl px-4 py-3 text-start text-[0.9rem] font-semibold outline-none focus-visible:ring-3 focus-visible:ring-primary/30">
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-lime/70 text-[#1b2400]" aria-hidden>
            <Lightbulb className="size-4" />
          </span>
          <span className="flex-1">{title}</span>
          <span className="text-[0.76rem] font-medium text-muted-foreground">{open ? "Hide" : `${steps.length} quick steps`}</span>
          <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none", open && "rotate-180")} aria-hidden />
        </button>
      </h2>
      <ol id={panel} hidden={!open} className="grid gap-2.5 px-4 pb-4 sm:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.title} className="flex gap-2.5 rounded-xl border bg-card p-3">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-[0.74rem] font-bold text-primary dark:text-[#c4b5ff]" aria-hidden>
              {i + 1}
            </span>
            <span className="min-w-0">
              <span className="block text-[0.86rem] font-semibold">{s.title}</span>
              <span className="block text-[0.78rem] text-muted-foreground">{s.body}</span>
              {s.href ? (
                <Link href={s.href} className="mt-1 inline-block text-[0.78rem] font-semibold text-primary hover:underline">
                  {s.cta ?? "Open"} →
                </Link>
              ) : null}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
