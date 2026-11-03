"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeftRight, ArrowRight, Compass, Eye, EyeOff, Info, Library, LifeBuoy, Plus, Store, Wallet } from "lucide-react";
import { DIGITAL_PRODUCTS_PATH } from "@/lib/digital-products";
import { LIBRARY_PATH } from "@/lib/digital-products/library";
import { cn } from "@/lib/utils";
import { dashButton, DemoTag, FINDER_ROUTE, Panel, ROUTES } from "./shared";

/*
 * Cards shared by the demo and live Overview pages. None of them invents a
 * figure: amounts and lists are passed in from the account's own records.
 */

type CardProps = { className?: string; style?: React.CSSProperties };

/** A small tinted icon square used in card headings. */
export function CardIcon({ icon: Icon, tone = "violet" }: { icon: React.ComponentType<{ className?: string }>; tone?: "violet" | "amber" | "neutral" }) {
  return (
    <span
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-xl",
        tone === "violet" && "bg-secondary text-secondary-foreground",
        tone === "amber" && "bg-soon-soft text-soon",
        tone === "neutral" && "bg-muted text-muted-foreground",
      )}
      aria-hidden
    >
      <Icon className="size-4" />
    </span>
  );
}

const greetingFor = (h: number) => (h < 5 ? "Good evening" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening");
const noopSubscribe = () => () => {};

/** "Good morning" in the visitor's own time; a neutral greeting during server rendering. */
export function useGreeting() {
  return React.useSyncExternalStore(noopSubscribe, () => greetingFor(new Date().getHours()), () => "Welcome back");
}

/* -------------------------------------------------------------------------- */
/*  Wallet                                                                    */
/* -------------------------------------------------------------------------- */

/** Splits a formatted amount into its whole part and its decimals ("$250" + ".00"). */
export function splitAmount(formatted: string) {
  const m = formatted.match(/^(.*?)([.,]\d{1,2})(\D*)$/);
  return m ? { whole: m[1], rest: m[2] + m[3] } : { whole: formatted, rest: "" };
}

export function WalletCard({
  whole,
  rest,
  stats,
  note,
  demo,
  actions,
  className,
  style,
}: CardProps & {
  whole: string;
  rest: string;
  stats: { label: string; value: string }[];
  note: React.ReactNode;
  demo?: boolean;
  /** Replaces the default Add Funds / History buttons. */
  actions?: React.ReactNode;
}) {
  const [hidden, setHidden] = React.useState(false);
  return (
    <section
      aria-labelledby="wallet-title"
      className={cn(
        "relative isolate flex flex-col overflow-hidden rounded-2xl bg-graphite p-4 text-white shadow-float sm:p-5 dark:bg-[#18191f] dark:ring-1 dark:ring-white/10",
        className,
      )}
      style={style}
    >
      {/* One quiet light, so the graphite doesn't read flat */}
      <div className="pointer-events-none absolute -end-16 -top-20 -z-10 size-48 rounded-full bg-primary/30 blur-3xl" aria-hidden />

      <div className="flex items-center justify-between gap-3">
        <h2 id="wallet-title" className="flex items-center gap-2 text-sm font-semibold text-white/75">
          <span className="grid size-7 place-items-center rounded-lg bg-white/10">
            <Wallet className="size-3.5 text-lime" aria-hidden />
          </span>
          Wallet balance
        </h2>
        <div className="flex items-center gap-1">
          {demo ? <DemoTag className="text-white/55" /> : null}
          <button
            type="button"
            onClick={() => setHidden((h) => !h)}
            aria-pressed={hidden}
            aria-label={hidden ? "Show balance" : "Hide balance"}
            className="grid size-9 place-items-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-lime/50 focus-visible:outline-none"
          >
            {hidden ? <Eye className="size-4" aria-hidden /> : <EyeOff className="size-4" aria-hidden />}
          </button>
        </div>
      </div>

      <p className="mt-4 font-heading leading-none font-extrabold tracking-tight tabular-nums" aria-live="polite">
        {hidden ? (
          <span className="text-4xl text-white/80">
            <span className="sr-only">Balance hidden</span>
            <span aria-hidden>•••••</span>
          </span>
        ) : (
          <>
            <span className="text-4xl sm:text-[2.6rem]">{whole}</span>
            <span className="text-xl text-white/50">{rest}</span>
          </>
        )}
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
        {stats.map((s) => (
          <div key={s.label} className="flex flex-col-reverse gap-0.5 rounded-xl bg-white/[0.06] px-3 py-2.5">
            <dt className="truncate text-[0.72rem] text-white/55">{s.label}</dt>
            <dd className="font-semibold tabular-nums">{hidden ? "•••" : s.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {actions ?? (
        <>
        <Link
          href={ROUTES["add-funds"]}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-lime text-sm font-semibold text-graphite transition-transform hover:-translate-y-px focus-visible:ring-3 focus-visible:ring-lime/50 focus-visible:outline-none motion-reduce:hover:translate-y-0"
        >
          <Plus className="size-4" strokeWidth={2.6} aria-hidden /> Add Funds
        </Link>
        <Link
          href={ROUTES.transactions}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-white/10 text-sm font-semibold text-white transition-colors hover:bg-white/15 focus-visible:ring-3 focus-visible:ring-white/30 focus-visible:outline-none"
        >
          <ArrowLeftRight className="size-4" aria-hidden /> History
        </Link>
        </>
        )}
      </div>

      <p className="mt-3.5 flex gap-2 text-[0.72rem] leading-relaxed text-white/50">
        <Info className="mt-px size-3.5 shrink-0" aria-hidden />
        <span>{note}</span>
      </p>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  AI Service Finder                                                         */
/* -------------------------------------------------------------------------- */

export function FinderCard({ className, style }: CardProps) {
  return (
    <Link
      href={FINDER_ROUTE}
      aria-labelledby="finder-card-title"
      aria-describedby="finder-card-text"
      className={cn(
        "group relative isolate flex items-center gap-3.5 overflow-hidden rounded-2xl md:flex-col md:items-start md:justify-between xl:flex-row xl:items-center xl:justify-start border border-primary/20 bg-linear-to-br from-secondary via-secondary/50 to-card p-4 shadow-soft transition-[border-color,translate] duration-200 hover:-translate-y-px hover:border-primary/45 focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none active:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:p-5 dark:border-primary/25 dark:from-primary/[0.16] dark:via-primary/[0.06] dark:to-card",
        className,
      )}
      style={style}
    >
      <span className="relative grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-[0_8px_20px_-10px_rgb(112_71_235/0.9)]" aria-hidden>
        <Compass className="size-5 transition-transform duration-300 group-hover:-rotate-[25deg] motion-reduce:transition-none" />
        <span className="absolute -end-1 -top-1 size-3 rounded-full bg-lime ring-2 ring-secondary dark:ring-card" />
      </span>
      <span className="min-w-0 flex-1">
        <span id="finder-card-title" className="block font-heading text-[0.95rem] leading-snug font-bold">
          AI Service Finder
        </span>
        <span id="finder-card-text" className="mt-0.5 block text-[0.8rem] leading-snug text-muted-foreground">
          Tell us your goal and get matching services in a few quick steps.
        </span>
      </span>
      <span className="hidden h-10 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground md:inline-flex xl:hidden">
        Find My Service <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden />
      </span>
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-card text-primary shadow-xs md:hidden xl:grid transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none rtl:-scale-x-100" aria-hidden>
        <ArrowRight className="size-4" />
      </span>
    </Link>
  );
}

/* -------------------------------------------------------------------------- */
/*  Digital Products                                                          */
/* -------------------------------------------------------------------------- */

const tile =
  "group flex min-w-0 items-center gap-2.5 rounded-xl border bg-card p-2.5 text-sm font-semibold transition-colors hover:border-primary/35 hover:bg-secondary/40 focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none";

export function DigitalProductsCard({ className, style }: CardProps) {
  return (
    <Panel className={cn("flex flex-col p-4 sm:p-5", className)} style={style} aria-labelledby="digital-card-title">
      <div className="flex items-start gap-3">
        <CardIcon icon={Library} />
        <div className="min-w-0">
          <h2 id="digital-card-title" className="font-heading text-[0.98rem] font-bold tracking-tight">
            Digital Products
          </h2>
          <p className="mt-0.5 text-[0.84rem] leading-snug text-muted-foreground">Templates, guides and toolkits you can download.</p>
        </div>
      </div>
      <div className="mt-auto grid grid-cols-1 gap-2 pt-3.5 min-[360px]:grid-cols-2">
        <Link href={LIBRARY_PATH} className={tile}>
          <Library className="size-4 shrink-0 text-primary" aria-hidden />
          <span className="truncate">My library</span>
        </Link>
        <Link href={DIGITAL_PRODUCTS_PATH} className={tile}>
          <Store className="size-4 shrink-0 text-primary" aria-hidden />
          <span className="truncate">Marketplace</span>
        </Link>
      </div>
    </Panel>
  );
}

/* -------------------------------------------------------------------------- */
/*  Help & Support                                                            */
/* -------------------------------------------------------------------------- */

export function HelpCard({ className, style }: CardProps) {
  return (
    <Panel className={cn("flex items-start gap-3 p-4 sm:p-5", className)} style={style} aria-labelledby="help-title">
      <CardIcon icon={LifeBuoy} tone="neutral" />
      <div className="min-w-0 flex-1">
        <h2 id="help-title" className="font-heading text-[0.98rem] font-bold tracking-tight">
          Help &amp; Support
        </h2>
        <p className="mt-0.5 text-[0.84rem] leading-snug text-muted-foreground">Questions about an order or payment? Share the ID and we&apos;ll help.</p>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Link href={ROUTES.support} className={cn(dashButton.primary, "h-9 px-4")}>
            Get Support
          </Link>
          <Link href="/#faq" className={dashButton.ghost}>
            Read the FAQ
          </Link>
        </div>
      </div>
    </Panel>
  );
}
