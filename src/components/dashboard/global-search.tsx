"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import {
  ArrowLeftRight,
  ArrowRight,
  Bell,
  BookOpen,
  CalendarDays,
  Compass,
  CornerDownLeft,
  Gift,
  History,
  LayoutDashboard,
  LifeBuoy,
  Library,
  type LucideIcon,
  Package,
  Plus,
  Search,
  Settings,
  Share2,
  ShieldCheck,
  Sparkles,
  CircleUserRound,
  Wallet,
  X,
} from "lucide-react";
import { PlatformTile } from "@/components/brand";
import { AI_ICONS } from "@/components/ai/parts";
import { PLATFORM_BY_ID } from "@/lib/catalog";
import type { AiIconKey } from "@/lib/ai/registry";
import { globalSearch, GROUP_LABEL, highlightParts, QUICK_LINKS, queryTerms, type SearchItem } from "@/lib/global-search";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/*
 * Global search (GS-01): a command-style dialog over services, AI tools,
 * dashboard pages and help. Ctrl/⌘ K opens it from anywhere in the dashboard.
 * Everything searched is public catalog data or the customer's own page list;
 * recent searches stay in this browser only.
 */

const PAGE_ICONS: Record<string, LucideIcon> = {
  overview: LayoutDashboard,
  "new-order": Plus,
  finder: Compass,
  orders: Package,
  "add-funds": Wallet,
  transactions: ArrowLeftRight,
  notifications: Bell,
  support: LifeBuoy,
  digital: Library,
  ai: Sparkles,
  social: Share2,
  calendar: CalendarDays,
  referrals: Gift,
  settings: Settings,
  security: ShieldCheck,
  profile: CircleUserRound,
  help: BookOpen,
};

const RECENT_KEY = "sv-recent-searches";
const RECENT_MAX = 5;

function readRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}
function saveRecent(list: string[]) {
  try {
    if (list.length) localStorage.setItem(RECENT_KEY, JSON.stringify(list));
    else localStorage.removeItem(RECENT_KEY);
  } catch {}
}

/** Runs a change just after the current click (see `setTyped`). */
const defer = (fn: () => void) => window.setTimeout(fn, 0);

function Highlight({ text, terms }: { text: string; terms: string[] }) {
  return (
    <>
      {highlightParts(text, terms).map((p, i) =>
        p.match ? (
          <mark key={i} className="rounded-[3px] bg-primary/12 px-px text-inherit dark:bg-primary/30">
            {p.text}
          </mark>
        ) : (
          <React.Fragment key={i}>{p.text}</React.Fragment>
        ),
      )}
    </>
  );
}

function ItemIcon({ item }: { item: SearchItem }) {
  if (item.service) {
    const p = PLATFORM_BY_ID[item.service.platformId];
    if (p) return <PlatformTile platform={p} size="sm" />;
  }
  const Icon = (item.group === "tools" ? AI_ICONS[item.icon as AiIconKey] : PAGE_ICONS[item.icon ?? ""]) ?? Search;
  return (
    <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", item.group === "tools" ? "bg-primary/10 text-primary dark:bg-primary/20 dark:text-[#c9bcff]" : item.group === "help" ? "bg-lime/45 text-graphite dark:bg-lime/15 dark:text-lime" : "bg-muted text-foreground/70")} aria-hidden>
      <Icon className="size-4" />
    </span>
  );
}

export function GlobalSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [active, setActive] = React.useState(0);
  // Mounted fresh for each opening (see the shell), so recent searches are read once per open.
  const [recent, setRecent] = React.useState<string[]>(readRecent);
  const listRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // A light debounce keeps typing smooth; the index is local, so results are still instant.
  React.useEffect(() => {
    const id = window.setTimeout(() => setDebounced(query), 60);
    return () => window.clearTimeout(id);
  }, [query]);

  const { terms, groups } = React.useMemo(() => globalSearch(debounced), [debounced]);
  const searching = queryTerms(query).length > 0;
  const flat = React.useMemo(() => (searching ? groups.flatMap((g) => g.items) : QUICK_LINKS), [searching, groups]);

  /**
   * Controls that disappear when clicked (Clear, a recent search, the clear-text button) apply their change just
   * after the click; otherwise the dialog sees a click on a removed element and closes as if clicked outside.
   */
  const setTyped = (q: string) => {
    setQuery(q);
    setActive(0);
    inputRef.current?.focus();
  };

  const choose = (item: SearchItem) => {
    if (query.trim()) {
      const q = query.trim().slice(0, 60);
      const next = [q, ...readRecent().filter((r) => r.toLowerCase() !== q.toLowerCase())].slice(0, RECENT_MAX);
      saveRecent(next);
    }
    onOpenChange(false);
    router.push(item.href);
  };

  // Keep the highlighted row in view while moving with the arrow keys.
  React.useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (flat.length ? (i + 1) % flat.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (flat.length ? (i - 1 + flat.length) % flat.length : 0));
    } else if (e.key === "Enter" && flat[active]) {
      e.preventDefault();
      choose(flat[active]);
    }
  };

  // Each row's position in the keyboard order (the same order as `flat`).
  const position = new Map(flat.map((it, i) => [it.id, i]));
  const row = (item: SearchItem) => {
    const i = position.get(item.id) ?? -1;
    const selected = i === active;
    return (
      <li key={item.id} role="presentation">
        <div
          id={`gs-opt-${i}`}
          role="option"
          aria-selected={selected}
          data-index={i}
          onMouseMove={() => active !== i && setActive(i)}
          onClick={() => choose(item)}
          className={cn("flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 transition-colors duration-100 motion-reduce:transition-none", selected ? "bg-primary/[0.07] dark:bg-primary/15" : "")}
        >
          <ItemIcon item={item} />
          <span className="min-w-0 flex-1">
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate text-sm font-semibold">
                <Highlight text={item.title} terms={terms} />
              </span>
              {item.badge ? <span className="shrink-0 rounded-full bg-muted px-1.5 py-px text-[0.65rem] font-semibold text-muted-foreground">{item.badge}</span> : null}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {item.meta}
              <span aria-hidden> · </span>
              <Highlight text={item.description} terms={terms} />
            </span>
          </span>
          <CornerDownLeft className={cn("size-3.5 shrink-0 text-primary transition-opacity", selected ? "opacity-100" : "opacity-0")} aria-hidden />
        </div>
      </li>
    );
  };

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next, details) => {
        // A page moving focus on its own (e.g. New Order focusing its first step) isn't the person closing search.
        if (!next && details.reason === "focus-out") {
          inputRef.current?.focus();
          return;
        }
        onOpenChange(next);
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-graphite/30 backdrop-blur-[2px] transition-opacity duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none dark:bg-black/50" />
        <DialogPrimitive.Popup
          initialFocus={inputRef}
          onKeyDown={(e) => e.stopPropagation()}
          className="fixed inset-x-2 top-2 z-50 mx-auto flex max-h-[min(36rem,calc(100dvh-1rem))] max-w-[40rem] flex-col overflow-hidden rounded-2xl border bg-popover text-popover-foreground shadow-[0_24px_64px_-24px_rgb(32_33_39/0.45)] transition-[opacity,transform] duration-150 outline-none data-[ending-style]:scale-[0.98] data-[ending-style]:opacity-0 data-[starting-style]:scale-[0.98] data-[starting-style]:opacity-0 motion-reduce:transition-none sm:top-[12vh] dark:shadow-[0_24px_64px_-20px_rgb(0_0_0/0.8)]"
        >
          <DialogPrimitive.Title className="sr-only">Search Sociotix</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">Services, AI tools, dashboard pages and help. Use the arrow keys to move and Enter to open.</DialogPrimitive.Description>
          <div className="flex items-center gap-2 border-b px-3.5">
            <Search className="size-[1.1rem] shrink-0 text-muted-foreground" aria-hidden />
            <input
              ref={inputRef}
              type="text"
              role="combobox"
              aria-expanded="true"
              aria-controls="gs-list"
              aria-autocomplete="list"
              aria-activedescendant={flat[active] ? `gs-opt-${active}` : undefined}
              aria-label="Search Sociotix"
              autoComplete="off"
              spellCheck={false}
              maxLength={80}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              placeholder="Search services, AI tools, pages and help…"
              className="h-14 min-w-0 flex-1 bg-transparent text-[0.95rem] outline-none placeholder:text-muted-foreground/70"
            />
            {query ? (
              <button type="button" onClick={() => defer(() => setTyped(""))} aria-label="Clear search" className="grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground sm:size-8">
                <X className="size-4" aria-hidden />
              </button>
            ) : null}
            <DialogPrimitive.Close className="hidden h-6 shrink-0 items-center rounded-md border bg-muted px-1.5 font-sans text-[0.65rem] font-semibold text-muted-foreground hover:text-foreground sm:inline-flex" aria-label="Close search">
              Esc
            </DialogPrimitive.Close>
            <DialogPrimitive.Close className="grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted sm:hidden" aria-label="Close search">
              <X className="size-4" aria-hidden />
            </DialogPrimitive.Close>
          </div>

          <div ref={listRef} id="gs-list" role="listbox" aria-label="Search results" className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5">
            {searching ? (
              groups.length ? (
                groups.map((g) => (
                  <section key={g.group} aria-label={GROUP_LABEL[g.group]} className="pb-1">
                    <p className="flex items-center justify-between px-2.5 pt-2 pb-1 text-[0.68rem] font-bold tracking-wider text-muted-foreground uppercase">
                      {GROUP_LABEL[g.group]}
                      {g.total > g.items.length ? <span className="font-medium tracking-normal normal-case">{`${g.items.length} of ${g.total}`}</span> : null}
                    </p>
                    <ul role="presentation">{g.items.map(row)}</ul>
                  </section>
                ))
              ) : (
                <div className="px-6 py-10 text-center" role="presentation">
                  <p className="text-sm font-semibold">No results for “{query.trim()}”</p>
                  <p className="mt-1 text-xs text-muted-foreground">Try a platform (Instagram), a type (followers, views) or a page (wallet, support).</p>
                </div>
              )
            ) : (
              <>
                {recent.length ? (
                  <section aria-label="Recent searches" className="pb-1" role="presentation">
                    <p className="flex items-center justify-between px-2.5 pt-2 pb-1 text-[0.68rem] font-bold tracking-wider text-muted-foreground uppercase">
                      Recent
                      <button type="button" onClick={() => defer(() => (saveRecent([]), setRecent([]), inputRef.current?.focus()))} className="inline-flex h-8 items-center rounded-full px-2 font-semibold tracking-normal text-primary normal-case hover:bg-secondary">
                        Clear
                      </button>
                    </p>
                    <div className="flex flex-wrap gap-1.5 px-2.5 pb-2">
                      {recent.map((r) => (
                        <button key={r} type="button" onClick={() => defer(() => setTyped(r))} className="inline-flex h-11 items-center gap-1.5 rounded-full border bg-card px-3 text-xs font-medium hover:border-primary/40 sm:h-8">
                          <History className="size-3.5 text-muted-foreground" aria-hidden /> {r}
                        </button>
                      ))}
                    </div>
                  </section>
                ) : null}
                <section aria-label="Quick links" className="pb-1">
                  <p className="px-2.5 pt-2 pb-1 text-[0.68rem] font-bold tracking-wider text-muted-foreground uppercase">Quick links</p>
                  <ul role="presentation">{QUICK_LINKS.map(row)}</ul>
                </section>
              </>
            )}
          </div>

          <div className="hidden items-center gap-4 border-t px-4 py-2 text-[0.7rem] text-muted-foreground sm:flex" aria-hidden>
            <span className="flex items-center gap-1">
              <kbd className="rounded border bg-muted px-1 font-sans">↑</kbd>
              <kbd className="rounded border bg-muted px-1 font-sans">↓</kbd> to move
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border bg-muted px-1 font-sans">Enter</kbd> to open
            </span>
            <span className="ms-auto flex items-center gap-1">
              Services open in New Order <ArrowRight className="size-3" />
            </span>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** The compact top-bar trigger; Ctrl/⌘ K opens the same dialog. */
export function GlobalSearchTrigger({ onOpen, className }: { onOpen: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-keyshortcuts="Control+K Meta+K"
      className={cn("group flex h-10 w-full items-center gap-2.5 rounded-full border bg-card ps-3.5 pe-2 text-sm text-muted-foreground shadow-xs transition-colors hover:border-primary/30 hover:text-foreground focus-visible:ring-3 focus-visible:ring-primary/15 focus-visible:outline-none", className)}
    >
      <Search className="size-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 truncate text-start">Search services, tools and pages…</span>
      <kbd className="hidden shrink-0 rounded-md border bg-muted px-1.5 py-0.5 font-sans text-[0.65rem] font-semibold xl:block">{t("search.shortcut")}</kbd>
    </button>
  );
}
