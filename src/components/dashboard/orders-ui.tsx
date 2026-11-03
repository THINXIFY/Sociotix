"use client";

import * as React from "react";
import Link from "next/link";
import { Check, ChevronRight, CircleAlert, Copy, PackageSearch, Plus, RotateCw, Search, TriangleAlert, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PlatformTile } from "@/components/brand";
import { Select } from "@/components/ui/select";
import type { Platform } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import { dashButton, DemoTag, newOrderHref } from "./shared";

/*
 * Building blocks shared by the demo and live My Orders pages and their order
 * panels. They only lay out what they're given: every count, date, amount and
 * progress figure comes from the caller's own order records.
 */

/* -------------------------------------------------------------------------- */
/*  Page header & overview                                                    */
/* -------------------------------------------------------------------------- */

export function OrdersHeader({ description, demo }: { description: string; demo?: boolean }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <h1 className="flex flex-wrap items-center gap-x-3 gap-y-1 font-heading text-[1.6rem] leading-tight font-extrabold tracking-tight sm:text-[1.9rem]">
          My Orders
          {demo ? <DemoTag className="text-muted-foreground" /> : null}
        </h1>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground sm:text-[0.95rem]">{description}</p>
      </div>
      <Link href={newOrderHref()} className={cn(dashButton.primary, "h-11 px-5")}>
        <Plus className="size-4" strokeWidth={2.6} aria-hidden /> New Order
      </Link>
    </header>
  );
}

export interface OverviewItem<T extends string> {
  id: T;
  label: string;
  /** Null while the count is loading. */
  value: number | null;
  hint?: string;
  Icon: LucideIcon;
  tone: "neutral" | "violet" | "amber" | "green";
}

const TILE_TONE = {
  neutral: "bg-muted text-foreground/75",
  violet: "bg-secondary text-secondary-foreground",
  amber: "bg-soon-soft text-soon",
  green: "bg-ok-soft text-ok",
};

/** Four real counts in one compact strip. Each one filters the list. */
export function StatusOverview<T extends string>({ items, value, onSelect }: { items: OverviewItem<T>[]; value: T; onSelect: (id: T) => void }) {
  return (
    <div role="group" aria-label="Order overview" className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-border shadow-soft lg:grid-cols-4">
      {items.map((t) => {
        const on = value === t.id;
        const alert = t.tone === "amber" && Boolean(t.value);
        return (
          <button
            key={t.id}
            type="button"
            aria-pressed={on}
            onClick={() => onSelect(t.id)}
            className={cn(
              "group relative flex min-w-0 items-center gap-3 bg-card px-3.5 py-3 text-start transition-colors hover:bg-muted/50 focus-visible:z-10 focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none focus-visible:ring-inset sm:px-4",
              on && "bg-secondary/50 hover:bg-secondary/60 dark:bg-secondary/25",
              alert && !on && "bg-soon-soft/30",
            )}
          >
            {on ? <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" aria-hidden /> : null}
            <span className={cn("hidden size-9 shrink-0 place-items-center rounded-xl sm:grid", TILE_TONE[t.tone])} aria-hidden>
              <t.Icon className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="flex items-baseline gap-2">
                {t.value === null ? (
                  <span className="h-6 w-8 animate-pulse rounded-md bg-muted motion-reduce:animate-none" aria-label="Loading" />
                ) : (
                  <span className={cn("font-heading text-xl leading-none font-extrabold tabular-nums sm:text-2xl", alert && "text-soon")}>{t.value}</span>
                )}
                <span className="truncate text-[0.8rem] font-semibold">{t.label}</span>
              </span>
              {t.hint ? <span className="mt-1 block truncate text-[0.7rem] text-muted-foreground">{t.hint}</span> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Toolbar                                                                   */
/* -------------------------------------------------------------------------- */

export function QuickFilters<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; count?: number | null; alert?: boolean }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 no-scrollbar sm:-mx-5 sm:px-5">
      <div role="group" aria-label="Filter by status" className="inline-flex gap-1 rounded-xl bg-muted p-1">
        {options.map((f) => {
          const on = value === f.value;
          return (
            <button
              key={f.value}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(f.value)}
              className={cn(
                "inline-flex h-11 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[0.82rem] font-semibold whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none sm:h-9",
                on && "bg-card text-foreground shadow-xs",
              )}
            >
              {f.label}
              {typeof f.count === "number" ? (
                <span className={cn("rounded-full px-1.5 text-[0.68rem] tabular-nums", f.alert && f.count ? "bg-soon-soft text-soon" : "bg-foreground/[0.06]")}>{f.count}</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const fieldClass =
  "h-11 w-full rounded-xl border bg-card text-sm shadow-xs transition-colors outline-none hover:border-foreground/20 focus-visible:border-primary/50 focus-visible:ring-3 focus-visible:ring-primary/15";

export function SearchBox({ id, value, onChange, placeholder }: { id: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative min-w-0 flex-1">
      <label htmlFor={id} className="sr-only">
        Search orders
      </label>
      <Search className="pointer-events-none absolute top-1/2 start-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <input
        id={id}
        type="search"
        value={value}
        maxLength={80}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className={cn(fieldClass, "pe-11 ps-10 placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden")}
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute top-1/2 end-1 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none"
        >
          <X className="size-4" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

export function ToolbarSelect<T extends string>({
  id,
  label,
  value,
  onChange,
  options,
  className,
}: {
  id: string;
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value as T)} className={cn(fieldClass, "ps-3.5 font-medium")}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  List                                                                      */
/* -------------------------------------------------------------------------- */

export interface OrderRowView {
  id: string;
  service: string;
  platform: Platform | null;
  platformName: string;
  date: string;
  amount: string;
  quantity: string;
  status: React.ReactNode;
  /** Only from recorded delivery counts. */
  progress: { pct: number; label: string } | null;
  note: { text: string; tone: "attention" | "muted" } | null;
  flagged?: boolean;
  dim?: boolean;
  /** Accessible summary of the row. */
  label: string;
}

/* md: compact table; xl: every column. Below md, rows become cards. */
const COLS =
  "md:grid md:grid-cols-[minmax(0,1fr)_6.5rem_5.5rem_9.5rem_1.75rem] md:items-center md:gap-4 xl:grid-cols-[minmax(0,1fr)_6.5rem_7rem_6rem_8rem_9.5rem_1.75rem]";

export function OrderList({ rows, activeId, onOpen }: { rows: OrderRowView[]; activeId?: string | null; onOpen: (id: string) => void }) {
  return (
    <>
      <div className={cn("hidden border-y bg-muted/40 px-5 py-2.5 text-[0.68rem] font-bold tracking-wider text-muted-foreground uppercase", COLS)} aria-hidden>
        <span>Service</span>
        <span className="hidden xl:block">Order ID</span>
        <span>Date</span>
        <span className="text-end">Amount</span>
        <span className="hidden xl:block">Progress</span>
        <span>Status</span>
        <span />
      </div>
      <ul className="divide-y border-t md:border-t-0" aria-label="Orders">
        {rows.map((r) => (
          <li key={r.id}>
            <OrderListRow row={r} active={activeId === r.id} onOpen={() => onOpen(r.id)} />
          </li>
        ))}
      </ul>
    </>
  );
}

function ProgressBar({ progress, className }: { progress: { pct: number; label: string }; className?: string }) {
  return (
    <span className={cn("flex min-w-0 items-center gap-2", className)} title={progress.label}>
      <span className="h-1.5 w-full max-w-24 overflow-hidden rounded-full bg-muted">
        <span className="block h-full rounded-full bg-primary transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${progress.pct}%` }} />
      </span>
      <span className="text-[0.7rem] font-semibold text-muted-foreground tabular-nums">{progress.pct}%</span>
    </span>
  );
}

function Note({ note, className }: { note: NonNullable<OrderRowView["note"]>; className?: string }) {
  return (
    <span className={cn("flex min-w-0 items-center gap-1 text-[0.72rem]", note.tone === "attention" ? "font-semibold text-soon" : "text-muted-foreground", className)}>
      {note.tone === "attention" ? <CircleAlert className="size-3.5 shrink-0" aria-hidden /> : null}
      <span className="truncate">{note.text}</span>
    </span>
  );
}

function OrderListRow({ row: r, active, onOpen }: { row: OrderRowView; active: boolean; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={r.label}
      className={cn(
        "group relative flex w-full items-start gap-3 px-4 py-3.5 text-start transition-colors hover:bg-muted/50 focus-visible:bg-muted/60 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:ring-inset sm:px-5",
        COLS,
        r.flagged && "bg-soon-soft/25",
        active && "bg-secondary/40",
      )}
    >
      {r.flagged ? <span className="absolute inset-y-2.5 start-0 w-[3px] rounded-e-full bg-soon" aria-hidden /> : null}

      {/* Service: on phones this cell carries everything */}
      <span className="flex min-w-0 flex-1 items-start gap-3 md:items-center">
        {r.platform ? <PlatformTile platform={r.platform} size="md" className="size-10 rounded-xl" /> : <span className="size-10 shrink-0 rounded-xl bg-muted" aria-hidden />}
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-3">
            <span className={cn("text-sm leading-snug font-semibold max-md:line-clamp-2 md:truncate", r.dim && "text-muted-foreground")}>{r.service}</span>
            <span className="shrink-0 text-sm font-semibold tabular-nums md:hidden">{r.amount}</span>
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            <span className="xl:hidden">
              <span className="font-mono">{r.id}</span> ·{" "}
            </span>
            <span className="md:hidden">{r.date} · </span>
            {r.platformName}
            <span className="max-xl:hidden"> · {r.quantity}</span>
          </span>
          <span className="mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 md:hidden">
            {r.status}
            {r.progress ? <ProgressBar progress={r.progress} className="flex-1" /> : r.note ? <Note note={r.note} className="flex-1" /> : null}
          </span>
        </span>
      </span>

      <span className="hidden font-mono text-xs text-muted-foreground xl:block">{r.id}</span>
      <span className="hidden text-[0.8rem] text-muted-foreground md:block">{r.date}</span>
      <span className="hidden text-end text-sm font-semibold tabular-nums md:block">{r.amount}</span>
      <span className="hidden min-w-0 xl:block">
        {r.progress ? <ProgressBar progress={r.progress} /> : r.note ? <Note note={r.note} /> : <span className="text-xs text-muted-foreground">—</span>}
      </span>
      <span className="hidden min-w-0 space-y-1 md:block">
        {r.status}
        <span className="block xl:hidden">{r.progress ? <ProgressBar progress={r.progress} /> : r.note ? <Note note={r.note} /> : null}</span>
      </span>
      <span
        className="hidden size-7 place-items-center rounded-full text-muted-foreground transition-[background-color,color,translate] group-hover:translate-x-0.5 group-hover:bg-card group-hover:text-primary group-hover:shadow-xs motion-reduce:transition-none md:grid rtl:-scale-x-100"
        aria-hidden
      >
        <ChevronRight className="size-4" />
      </span>
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/*  States                                                                    */
/* -------------------------------------------------------------------------- */

export function OrdersSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <ul className="divide-y border-t" aria-busy="true" aria-label="Loading orders">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
          <span className="size-10 shrink-0 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />
          <span className="flex-1 space-y-2">
            <span className="block h-3.5 w-2/5 animate-pulse rounded bg-muted motion-reduce:animate-none" />
            <span className="block h-3 w-1/4 animate-pulse rounded bg-muted motion-reduce:animate-none" />
          </span>
          <span className="hidden h-6 w-24 animate-pulse rounded-full bg-muted motion-reduce:animate-none md:block" />
        </li>
      ))}
    </ul>
  );
}

export function OrdersMessage({
  icon: Icon = PackageSearch,
  tone = "neutral",
  title,
  children,
  actions,
  role,
}: {
  icon?: LucideIcon;
  tone?: "neutral" | "ok" | "error";
  title: string;
  children?: React.ReactNode;
  actions?: React.ReactNode;
  role?: "alert";
}) {
  return (
    <div role={role} className="flex flex-col items-center border-t px-6 py-12 text-center">
      <span
        className={cn(
          "grid size-11 place-items-center rounded-2xl",
          tone === "ok" ? "bg-ok-soft text-ok" : tone === "error" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground",
        )}
        aria-hidden
      >
        <Icon className="size-5" />
      </span>
      <p className="mt-3.5 font-heading font-bold">{title}</p>
      {children ? <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{children}</p> : null}
      {actions ? <div className="mt-4 flex flex-wrap justify-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function RetryButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={dashButton.secondary}>
      <RotateCw className="size-3.5" aria-hidden /> Try again
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/*  Order panel pieces                                                        */
/* -------------------------------------------------------------------------- */

export function CopyIdButton({ id, label = "order ID", display }: { id: string; label?: string; display?: string }) {
  const [state, setState] = React.useState<"idle" | "done" | "failed">("idle");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(id);
      setState("done");
    } catch {
      setState("failed");
    }
    window.setTimeout(() => setState("idle"), 2000);
  };
  return (
    <>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy ${label} ${id}`}
        className="relative inline-flex h-7 items-center gap-1.5 rounded-full border bg-card px-2.5 font-mono text-[0.72rem] font-semibold transition-colors after:absolute after:-inset-y-2 after:inset-x-0 hover:border-primary/40 hover:text-primary focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none"
      >
        {display ?? id}
        {state === "done" ? <Check className="size-3 text-ok" aria-hidden /> : <Copy className="size-3" aria-hidden />}
      </button>
      <span className="sr-only" aria-live="polite">
        {state === "done" ? `${label[0].toUpperCase()}${label.slice(1)} copied` : state === "failed" ? "Couldn't copy. Select the ID to copy it." : ""}
      </span>
      {state === "failed" ? <span className="text-xs text-destructive">Couldn&apos;t copy</span> : null}
    </>
  );
}

export function SectionTitle({ id, children, aside }: { id?: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h3 id={id} className="text-[0.7rem] font-bold tracking-wider text-muted-foreground uppercase">
        {children}
      </h3>
      {aside ? <span className="text-[0.7rem] text-muted-foreground">{aside}</span> : null}
    </div>
  );
}

/** Label / value rows. */
export function DetailList({ rows }: { rows: { label: string; value: React.ReactNode; mono?: boolean }[] }) {
  return (
    <dl className="mt-2 divide-y rounded-xl border text-sm">
      {rows.map((r) => (
        <div key={r.label} className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3 px-3.5 py-2.5 sm:grid-cols-[8rem_minmax(0,1fr)]">
          <dt className="text-muted-foreground">{r.label}</dt>
          <dd className={cn("min-w-0 font-medium break-words", r.mono && "font-mono text-[0.78rem] break-all")}>{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export type StepState = "done" | "current" | "blocked" | "upcoming" | "closed";

const STEP_TEXT: Record<StepState, string> = {
  done: "completed",
  current: "current step",
  blocked: "paused, action needed",
  upcoming: "upcoming",
  closed: "closed",
};

/** Horizontal lifecycle derived from the order's real status and timestamps. */
export function Lifecycle({ steps }: { steps: { label: string; state: StepState; at?: string | null }[] }) {
  return (
    <ol className="flex items-start">
      {steps.map((s, i) => (
        <li key={s.label} className="relative flex min-w-0 flex-1 flex-col items-center text-center">
          {i > 0 ? (
            <span
              className={cn(
                "absolute top-3.5 right-1/2 h-0.5 w-full -translate-y-1/2 rtl:right-auto rtl:left-1/2",
                s.state === "upcoming" ? "bg-border" : s.state === "closed" ? "bg-off/40" : "bg-primary/50",
              )}
              aria-hidden
            />
          ) : null}
          <span
            className={cn(
              "relative grid size-7 place-items-center rounded-full",
              s.state === "done" && "bg-primary text-primary-foreground",
              s.state === "current" && "bg-card text-primary ring-2 ring-primary",
              s.state === "blocked" && "bg-soon text-white dark:text-graphite",
              s.state === "upcoming" && "border-2 border-dashed bg-card",
              s.state === "closed" && "bg-off text-white dark:text-graphite",
            )}
            aria-hidden
          >
            {s.state === "done" ? <Check className="size-3.5" strokeWidth={3} /> : null}
            {s.state === "current" ? <span className="size-2 animate-pulse rounded-full bg-primary motion-reduce:animate-none" /> : null}
            {s.state === "blocked" ? <TriangleAlert className="size-3.5" strokeWidth={2.5} /> : null}
            {s.state === "closed" ? <X className="size-3.5" strokeWidth={3} /> : null}
          </span>
          <span
            className={cn(
              "mt-1.5 w-full truncate px-0.5 text-[0.7rem] leading-tight font-semibold",
              s.state === "upcoming" && "font-medium text-muted-foreground",
              s.state === "blocked" && "text-soon",
              s.state === "current" && "text-primary",
            )}
          >
            {s.label}
            <span className="sr-only">, {STEP_TEXT[s.state]}</span>
          </span>
          {s.at ? <span className="mt-0.5 w-full truncate text-[0.65rem] text-muted-foreground">{s.at}</span> : null}
        </li>
      ))}
    </ol>
  );
}

export interface TimelineEvent {
  at: string | null;
  title: string;
  detail?: string | null;
  tone?: "default" | "attention" | "done" | "demo" | "muted";
}

const EVENT_DOT: Record<NonNullable<TimelineEvent["tone"]>, string> = {
  default: "bg-primary",
  attention: "bg-soon",
  done: "bg-ok",
  demo: "bg-card ring-2 ring-primary",
  muted: "bg-off",
};

/** Recorded events, newest first. `format` turns a timestamp into display text. */
export function Timeline({ events, format }: { events: TimelineEvent[]; format: (iso: string) => string }) {
  if (!events.length) return <p className="mt-2 text-sm text-muted-foreground">No activity recorded yet.</p>;
  return (
    <ol className="relative mt-3 space-y-4 before:absolute before:top-1.5 before:bottom-1.5 before:start-[0.3125rem] before:w-px before:bg-border">
      {events.map((ev, i) => (
        <li key={`${ev.title}-${i}`} className="relative flex gap-3.5">
          <span className={cn("relative mt-1.5 size-2.5 shrink-0 rounded-full ring-4 ring-card", EVENT_DOT[ev.tone ?? "default"], i === 0 && "ring-primary/15")} aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="text-sm font-semibold">{ev.title}</span>
              <time className="text-[0.72rem] text-muted-foreground" dateTime={ev.at ?? undefined}>
                {ev.at ? format(ev.at) : "Just now"}
              </time>
            </p>
            {ev.detail ? <p className="mt-0.5 text-[0.8rem] leading-relaxed break-words text-muted-foreground">{ev.detail}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Sticky action bar at the bottom of an order panel. */
export function PanelActions({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-2 border-t bg-card px-5 py-3.5 pb-[calc(env(safe-area-inset-bottom)+0.875rem)]">{children}</div>;
}

export const panelPrimary = cn(dashButton.primary, "col-span-2 h-11");
export const panelSecondary = cn(dashButton.secondary, "h-11 px-3");

/** Order panel header: platform, service, status, copyable ID and date. */
export function PanelHead({
  platform,
  title,
  subtitle,
  badges,
  actions,
}: {
  platform: Platform | null;
  title: React.ReactNode;
  subtitle: React.ReactNode;
  badges: React.ReactNode;
  actions: React.ReactNode;
}) {
  return (
    <div className="border-b px-5 pt-5 pb-4">
      <div className="flex items-start gap-3">
        {platform ? <PlatformTile platform={platform} size="md" className="size-11 rounded-xl" /> : null}
        <div className="min-w-0 flex-1">
          {title}
          {subtitle}
        </div>
        <div className="-me-1.5 -mt-1 flex shrink-0 items-center gap-0.5">{actions}</div>
      </div>
      <div className="mt-3.5 flex flex-wrap items-center gap-2">{badges}</div>
    </div>
  );
}

export function CloseButton({ onClick, label = "Close order details" }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none"
    >
      <X className="size-4.5" aria-hidden />
    </button>
  );
}
