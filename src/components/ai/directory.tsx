"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, Search, SearchX, X } from "lucide-react";
import { AI_CATEGORIES, AI_TOOLS, type AiCategoryId, type AiTool, aiToolHref } from "@/lib/ai/registry";
import { cn } from "@/lib/utils";
import { LiveAvailabilityBadge } from "./live-badge";
import { FAMILY, ToolGlyph } from "./parts";

/*
 * Tools directory — a marketplace you can scan in seconds: category tabs,
 * search and one consistent card for every tool. All 13 registered tools
 * appear once in "All tools", each with its real status and working route.
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
      className="group grid h-full grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3.5 gap-y-1 rounded-2xl border bg-card p-4 transition-[border-color,box-shadow,translate] duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[0_18px_40px_-28px_rgb(112_71_235/0.55)] focus-visible:border-primary/50 focus-visible:ring-3 focus-visible:ring-primary/25 focus-visible:outline-none motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:grid-rows-[auto_auto_1fr_auto] sm:gap-x-3 sm:gap-y-0 sm:p-5"
    >
      <ToolGlyph tool={tool} className="row-span-2 transition-transform duration-200 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100 sm:row-span-1" />
      <h4 className="col-start-2 row-start-1 self-center font-heading text-[1.02rem] leading-snug font-bold sm:col-span-3 sm:col-start-1 sm:row-start-2 sm:mt-4 sm:self-auto sm:text-[1.05rem]">{tool.name.replace(/^AI /, "")}</h4>
      <LiveAvailabilityBadge tool={tool} className="col-start-3 row-start-1 justify-self-end" />
      <p className="col-span-2 col-start-2 row-start-2 line-clamp-2 text-[0.88rem] leading-relaxed text-muted-foreground sm:col-span-3 sm:col-start-1 sm:row-start-3 sm:mt-1.5 sm:line-clamp-none sm:text-[0.92rem]">{tool.tagline}</p>
      <div className="col-span-3 row-start-4 mt-4 hidden items-center justify-between border-t pt-3.5 text-[0.78rem] font-medium text-muted-foreground sm:flex">
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
  const [query, setQuery] = React.useState("");
  const q = query.trim().toLowerCase();
  const matches = (t: AiTool) => !q || [t.name, t.tagline, t.description, FAMILY[t.category].name].some((v) => v.toLowerCase().includes(q));
  const shown = AI_TOOLS.filter((t) => (tab === "all" || t.category === tab) && matches(t));
  const tabs: { id: Tab; name: string; count: number }[] = [
    { id: "all", name: "All tools", count: AI_TOOLS.filter(matches).length },
    ...AI_CATEGORIES.map((c) => ({ id: c.id, name: FAMILY[c.id].name, count: AI_TOOLS.filter((t) => t.category === c.id && matches(t)).length })),
  ];
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const groups = AI_CATEGORIES.filter((c) => shown.some((t) => t.category === c.id));

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
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
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
                    "inline-flex h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold sm:h-10 whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:outline-none",
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

        <div className="relative w-full lg:w-80" role="search">
          <label htmlFor="ai-tool-search" className="sr-only">
            Search AI tools
          </label>
          <Search className="pointer-events-none absolute top-1/2 start-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            id="ai-tool-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tools, e.g. hashtags"
            autoComplete="off"
            maxLength={60}
            className="h-11 w-full rounded-full border bg-card ps-10 pe-11 text-sm shadow-[0_1px_2px_rgb(32_33_39/0.04)] transition-colors outline-none placeholder:text-muted-foreground hover:border-foreground/20 focus-visible:border-primary/50 focus-visible:ring-3 focus-visible:ring-primary/15 [&::-webkit-search-cancel-button]:hidden"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute top-1/2 end-1 grid size-9 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none"
            >
              <X className="size-4" aria-hidden />
            </button>
          ) : null}
        </div>
      </div>
      <p className="sr-only" aria-live="polite">
        {q ? `${shown.length} tool${shown.length === 1 ? "" : "s"} match` : ""}
      </p>

      <div id="ai-tools-panel" role="tabpanel" aria-labelledby={`ai-tab-${tab}`} className="mt-8 space-y-10">
        {groups.map((c) => {
          const tools = shown.filter((t) => t.category === c.id);
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

        {!shown.length ? (
          <div className="rounded-2xl border border-dashed px-6 py-12 text-center">
            <span className="mx-auto grid size-11 place-items-center rounded-2xl bg-muted text-muted-foreground" aria-hidden>
              <SearchX className="size-5" />
            </span>
            <p className="mt-3 font-heading font-bold">No tools match “{query.trim()}”</p>
            <p className="mt-1 text-sm text-muted-foreground">Try a word like captions, growth or orders.</p>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setTab("all");
              }}
              className="mt-3 inline-flex h-10 items-center rounded-full px-4 text-sm font-semibold text-primary hover:bg-secondary focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none"
            >
              Show all tools
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
