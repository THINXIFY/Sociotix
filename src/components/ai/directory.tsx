"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { AI_CATEGORIES, AI_TOOLS, type AiCategoryId, type AiTool, aiToolHref } from "@/lib/ai/registry";
import { cn } from "@/lib/utils";
import { LiveAvailabilityBadge } from "./live-badge";
import { FAMILY, ToolGlyph } from "./parts";

/*
 * Tools directory — a marketplace you can scan in seconds: category tabs and
 * one consistent card for every tool. All 13 registered tools appear once in
 * "All tools", each with its real status and working route.
 */

type Tab = AiCategoryId | "all";

const NOTES: Record<AiCategoryId, string> = {
  content: "Launching first — words, tags, ideas and plans for your next posts.",
  growth: "Up next — priorities, staged plans and services that fit your goal.",
  assist: "On the roadmap — help finding services, understanding orders and getting answers.",
};

/** Phones: a compact row (icon, name, status, one-line summary). From 640px: the full card. One badge, placed by the grid. */
function ToolCard({ tool }: { tool: AiTool }) {
  return (
    <Link
      href={aiToolHref(tool)}
      className="group grid h-full grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3.5 gap-y-1 rounded-[1.25rem] border bg-card p-4 transition-[border-color,box-shadow] duration-200 hover:border-primary/35 hover:shadow-[0_18px_40px_-28px_rgb(112_71_235/0.55)] focus-visible:border-primary/50 focus-visible:ring-3 focus-visible:ring-primary/25 focus-visible:outline-none motion-reduce:transition-none sm:grid-rows-[auto_auto_1fr_auto] sm:gap-x-3 sm:gap-y-0 sm:p-5"
    >
      <ToolGlyph tool={tool} className="row-span-2 sm:row-span-1" />
      <h4 className="col-start-2 row-start-1 self-center font-heading text-[1.02rem] leading-snug font-bold sm:col-span-3 sm:col-start-1 sm:row-start-2 sm:mt-4 sm:self-auto sm:text-[1.05rem]">{tool.name.replace(/^AI /, "")}</h4>
      <LiveAvailabilityBadge tool={tool} className="col-start-3 row-start-1 justify-self-end" />
      <p className="col-span-2 col-start-2 row-start-2 line-clamp-2 text-[0.88rem] leading-relaxed text-muted-foreground sm:col-span-3 sm:col-start-1 sm:row-start-3 sm:mt-1.5 sm:line-clamp-none sm:text-[0.92rem]">{tool.tagline}</p>
      <div className="col-span-3 row-start-4 mt-5 hidden items-center justify-between border-t pt-3.5 text-[0.78rem] font-medium text-muted-foreground sm:flex">
        <span>{FAMILY[tool.category].name}</span>
        <span className="inline-flex items-center gap-1 text-foreground/70 transition-colors group-hover:text-primary group-focus-visible:text-primary">
          View tool <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none" aria-hidden />
        </span>
      </div>
    </Link>
  );
}

export function AiDirectory() {
  const [tab, setTab] = React.useState<Tab>("all");
  const tabs: { id: Tab; name: string; count: number }[] = [
    { id: "all", name: "All tools", count: AI_TOOLS.length },
    ...AI_CATEGORIES.map((c) => ({ id: c.id, name: FAMILY[c.id].name, count: AI_TOOLS.filter((t) => t.category === c.id).length })),
  ];
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const groups = AI_CATEGORIES.filter((c) => tab === "all" || c.id === tab);

  const onKey = (e: React.KeyboardEvent) => {
    const i = tabs.findIndex((t) => t.id === tab);
    let next = i;
    if (e.key === "ArrowRight") next = (i + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    else return;
    e.preventDefault();
    setTab(tabs[next].id);
    refs.current[next]?.focus();
  };

  return (
    <div>
      <div className="-mx-4 overflow-x-auto px-4 pb-1 no-scrollbar sm:mx-0 sm:px-0">
        <div role="tablist" aria-label="Tool categories" onKeyDown={onKey} className="inline-flex gap-1 rounded-full border bg-card p-1 shadow-[0_1px_2px_rgb(32_33_39/0.04)]">
          {tabs.map((t, i) => {
            const on = t.id === tab;
            return (
              <button
                key={t.id}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                id={`ai-tab-${t.id}`}
                type="button"
                role="tab"
                aria-selected={on}
                aria-controls="ai-tools-panel"
                tabIndex={on ? 0 : -1}
                onClick={() => setTab(t.id)}
                className={cn(
                  "inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:outline-none",
                  on ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {t.name}
                <span className={cn("rounded-full px-1.5 py-px text-[0.7rem] tabular-nums", on ? "bg-background/15" : "bg-muted")}>{t.count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div id="ai-tools-panel" role="tabpanel" aria-labelledby={`ai-tab-${tab}`} className="mt-10 space-y-12">
        {groups.map((c) => {
          const tools = AI_TOOLS.filter((t) => t.category === c.id);
          return (
            <section key={c.id} aria-labelledby={`family-${c.id}`}>
              <div className="flex flex-col gap-1 border-b pb-4 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
                <h3 id={`family-${c.id}`} className="font-heading text-xl font-bold tracking-tight">
                  {FAMILY[c.id].name}
                </h3>
                <p className="text-sm text-muted-foreground">{NOTES[c.id]}</p>
              </div>
              <ul className={cn("mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4", c.id === "content" ? "xl:grid-cols-4" : "lg:grid-cols-3")}>
                {tools.map((t) => (
                  <li key={t.id}>
                    <ToolCard tool={t} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
