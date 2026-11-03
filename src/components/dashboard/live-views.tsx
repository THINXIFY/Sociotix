"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  CircleAlert,
  CircleCheck,
  Clock,
  Compass,
  LayoutGrid,
  ListOrdered,
  Lock,
  PackageOpen,
  RotateCw,
  Search,
  ShoppingBag,
  Wallet,
} from "lucide-react";
import { PlatformTile } from "@/components/brand";
import { CATEGORY_META, CATEGORY_ORDER, PLATFORMS, type ServiceCategory } from "@/lib/catalog";
import { usd } from "@/lib/demo-account";
import { formatDate, formatDateTime, useDisplay } from "@/lib/i18n";
import { api, type WalletEntry } from "@/lib/live-account";
import { cn } from "@/lib/utils";
import type { CustomerDeposit } from "@/lib/deposits";
import { useLiveAccount } from "./live-account";
import { BankInstructionsPanel, DepositStatusBadge } from "./live-deposit";
import { CardIcon, DigitalProductsCard, FinderCard, HelpCard, splitAmount, useGreeting, WalletCard } from "./overview-parts";
import { dashButton, enter, FINDER_ROUTE, Pagination, Panel, PanelHeader, ROUTES } from "./shared";
import { Select } from "@/components/ui/select";

/*
 * Live-mode (DEMO_MODE off) dashboard views. Every figure comes from the
 * customer's own stored records. Ordering and adding funds aren't open yet,
 * so those actions are shown as unavailable rather than simulated.
 */

const page = "mx-auto max-w-[90rem] px-3 py-4 sm:px-6 sm:py-7 lg:px-8";
const h1 = "font-heading text-[1.6rem] leading-tight font-extrabold tracking-tight sm:text-[1.9rem]";
const cents = (n: number) => usd(n / 100);
const PLATFORM_BY_ID = new Map(PLATFORMS.map((p) => [p.id, p]));

function Header({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) {
  const e = enter(0);
  return (
    <header className={cn("flex flex-wrap items-end justify-between gap-4", e.className)} style={e.style}>
      <div className="min-w-0">
        <h1 className={h1}>{title}</h1>
        <p className="mt-1 max-w-xl text-[0.95rem] text-muted-foreground">{subtitle}</p>
      </div>
      {action}
    </header>
  );
}

function EmptyState({ icon: Icon, title, children, action }: { icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-secondary text-primary" aria-hidden>
        <Icon className="size-5" />
      </span>
      <p className="mt-4 font-heading text-lg font-bold">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{children}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center px-6 py-12 text-center">
      <CircleAlert className="size-6 text-destructive" aria-hidden />
      <p className="mt-3 font-semibold">This didn&apos;t load</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{message}</p>
      <button type="button" onClick={onRetry} className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none">
        <RotateCw className="size-3.5" aria-hidden /> Try again
      </button>
    </div>
  );
}

const secondaryLink =
  "inline-flex h-11 items-center gap-2 rounded-full border bg-card px-4 text-sm font-semibold transition-colors hover:border-primary/40 hover:text-primary focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none";

/* -------------------------------------------------------------------------- */
/*  Overview                                                                  */
/* -------------------------------------------------------------------------- */

export function LiveOverview() {
  useDisplay();
  const greeting = useGreeting();
  const live = useLiveAccount()!;
  const { profile, wallet, orderCount } = live;
  const { whole, rest } = splitAmount(cents(wallet.availableCents));
  const a = [0, 1, 2, 3, 4, 5, 6, 7].map(enter);

  // Same priority order as the demo overview; every figure is the customer's own record.
  return (
    <div className="mx-auto max-w-[90rem] px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
      <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,23rem)] xl:items-start xl:gap-5">
        <div className="contents xl:flex xl:flex-col xl:gap-5">
          <Panel className={cn("relative isolate order-1 overflow-hidden p-4 sm:p-6 md:col-span-2", a[0].className)} style={a[0].style} aria-labelledby="welcome-title">
            <div className="pointer-events-none absolute -end-24 -top-32 -z-10 size-80 rounded-full bg-primary/[0.08] blur-3xl dark:bg-primary/15" aria-hidden />
            <p className="text-[0.82rem] font-medium text-muted-foreground">
              {greeting}, {profile.displayName || profile.firstName}
            </p>
            <h1 id="welcome-title" className="mt-1.5 font-heading text-[1.6rem] leading-[1.12] font-extrabold tracking-tight text-balance sm:text-[2rem]">
              What would you like to grow today?
            </h1>
            <p className="mt-1.5 max-w-xl text-[0.9rem] text-muted-foreground">
              Checkout opens once services pass every review. Nothing is charged until then, and you can already explore every service.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Link href={ROUTES["new-order"]} className={cn(dashButton.primary, "h-11 px-5 text-[0.95rem]")}>
                <ShoppingBag className="size-4" aria-hidden /> New Order
              </Link>
              <Link href={ROUTES["add-funds"]} className={cn(dashButton.secondary, "h-11")}>
                <Wallet className="size-4" aria-hidden /> Add Funds
              </Link>
            </div>
          </Panel>

          <Panel className={cn("order-2 flex items-center gap-3 px-4 py-3.5 sm:px-5 md:col-span-2", a[1].className)} style={a[1].style} aria-labelledby="attention-title">
            <CardIcon icon={CircleCheck} tone="neutral" />
            <div className="min-w-0">
              <h2 id="attention-title" className="font-heading text-[0.95rem] font-bold">
                Nothing needs your action
              </h2>
              <p className="text-[0.8rem] text-muted-foreground">If an order ever needs something from you, it will show up here.</p>
            </div>
          </Panel>

          <Panel className={cn("order-3 md:col-span-2", a[2].className)} style={a[2].style} aria-labelledby="orders-title">
            <PanelHeader
              id="orders-title"
              className="px-4 pt-4 sm:px-5 sm:pt-5"
              title="Your orders"
              description={orderCount ? `${orderCount} order${orderCount === 1 ? "" : "s"} in total` : "Your orders and their progress will appear here."}
              action={
                orderCount ? (
                  <Link href={ROUTES.orders} className={dashButton.ghost}>
                    View all <ArrowRight className="size-3.5 rtl:-scale-x-100" aria-hidden />
                  </Link>
                ) : null
              }
            />
            <EmptyState
              icon={PackageOpen}
              title={orderCount ? "See every order in one place" : "No orders yet"}
              action={
                orderCount ? (
                  <Link href={ROUTES.orders} className={dashButton.primary}>
                    <ListOrdered className="size-4" aria-hidden /> View my orders
                  </Link>
                ) : (
                  <Link href={FINDER_ROUTE} className={dashButton.primary}>
                    <Compass className="size-4" aria-hidden /> Browse services
                  </Link>
                )
              }
            >
              {orderCount ? "Each order shows its status and recorded activity." : "Ordering isn't open yet. You can already browse every service we plan to offer."}
            </EmptyState>
          </Panel>

          <Panel className={cn("order-9 p-4 sm:p-5 md:col-span-2", a[7].className)} style={a[7].style} aria-labelledby="account-title">
            <PanelHeader
              id="account-title"
              title="Your account"
              action={
                <Link href={ROUTES.profile} className={dashButton.ghost}>
                  Edit profile <ArrowRight className="size-3.5 rtl:-scale-x-100" aria-hidden />
                </Link>
              }
            />
            <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2.5 text-sm sm:grid-cols-2">
              {[
                ["Account ID", <span key="r" className="font-mono text-[0.8rem] font-semibold">{profile.accountRef}</span>],
                ["Email", profile.email],
                ["Member since", formatDate(profile.createdAt, { year: true })],
                ["Account type", <span key="t" className="capitalize">{profile.accountType}</span>],
              ].map(([label, value]) => (
                <div key={String(label)} className="flex min-w-0 justify-between gap-3 border-b border-dashed pb-2.5 last:border-0 sm:[&:nth-last-child(-n+2)]:border-0">
                  <dt className="shrink-0 text-muted-foreground">{label}</dt>
                  <dd className="min-w-0 truncate font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          </Panel>
        </div>

        <div className="contents xl:flex xl:flex-col xl:gap-5">
          <WalletCard
            className={cn("order-4", a[3].className)}
            style={a[3].style}
            whole={whole}
            rest={rest}
            stats={[
              { label: "Pending deposits", value: cents(wallet.pendingCents) },
              { label: "Orders, all time", value: String(orderCount) },
            ]}
            note="USD, from your account ledger. Pending deposits aren't spendable until approved."
          />
          <FinderCard className={cn("order-5", a[4].className)} style={a[4].style} />
          <LiveActivity className={cn("order-6", a[5].className)} style={a[5].style} />
          <DigitalProductsCard className={cn("order-7", a[6].className)} style={a[6].style} />
          <HelpCard className={cn("order-8 md:col-span-2 xl:col-span-1", a[6].className)} style={a[6].style} />
        </div>
      </div>
    </div>
  );
}

/** The latest entries in the customer's wallet ledger — real records only, never a placeholder feed. */
function LiveActivity({ className, style }: { className?: string; style?: React.CSSProperties }) {
  const { data, error, loading, retry } = useRemote<EntriesPage>("/api/account/wallet/transactions?page=1&pageSize=4");
  return (
    <Panel className={cn("p-4 sm:p-5", className)} style={style} aria-labelledby="updates-title" aria-busy={loading}>
      <PanelHeader
        id="updates-title"
        title="Recent activity"
        description="The latest changes to your wallet."
        action={
          data?.items.length ? (
            <Link href={ROUTES.transactions} className={dashButton.ghost}>
              All <ArrowRight className="size-3.5 rtl:-scale-x-100" aria-hidden />
            </Link>
          ) : null
        }
      />
      {error ? (
        <p role="alert" className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-2">
            <CircleAlert className="size-4 shrink-0 text-destructive" aria-hidden /> Activity didn&apos;t load.
          </span>
          <button type="button" onClick={retry} className={dashButton.ghost}>
            Try again
          </button>
        </p>
      ) : !data ? (
        <div className="mt-4 space-y-3" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-9 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />
          ))}
        </div>
      ) : data.items.length ? (
        <ul className="mt-3 divide-y">
          {data.items.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 py-2.5">
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{e.label}</span>
                <time className="block text-[0.72rem] text-muted-foreground">{formatDateTime(e.at)}</time>
              </span>
              <span className={cn("shrink-0 text-sm font-semibold tabular-nums", e.amountCents > 0 && "text-ok")}>
                {e.amountCents > 0 ? "+" : ""}
                {cents(e.amountCents)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 flex items-center gap-2.5 rounded-xl border border-dashed p-3.5 text-sm text-muted-foreground">
          <Clock className="size-4 shrink-0" aria-hidden /> No activity yet. Deposits and payments will appear here.
        </p>
      )}
    </Panel>
  );
}

/* -------------------------------------------------------------------------- */
/*  Transactions (wallet)                                                     */
/* -------------------------------------------------------------------------- */

interface EntriesPage {
  items: WalletEntry[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
}

/** Loads JSON from one of our APIs. Errors are returned for display — never replaced with sample data. */
function useRemote<T>(url: string) {
  const [attempt, setAttempt] = React.useState(0);
  const key = `${url}#${attempt}`;
  const [state, setState] = React.useState<{ key?: string; data?: T; error?: string }>({});
  React.useEffect(() => {
    let cancelled = false;
    api<T>(url).then(
      (data) => !cancelled && setState({ key, data }),
      (e: Error) => !cancelled && setState({ key, error: e.message }),
    );
    return () => {
      cancelled = true;
    };
  }, [url, key]);
  const loading = state.key !== key;
  // While the next page loads, keep showing the previous one.
  return { data: state.data, error: loading ? undefined : state.error, loading, retry: () => setAttempt((n) => n + 1) };
}

/* -------------------------------------------------------------------------- */
/*  Deposit requests                                                          */
/* -------------------------------------------------------------------------- */

interface DepositPage {
  items: CustomerDeposit[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
}

/** The customer's own requests: pending ones are shown apart from the balance, with every outcome and reason. */
export function DepositRequests() {
  const live = useLiveAccount()!;
  const [pageNo, setPageNo] = React.useState(1);
  const [version, setVersion] = React.useState(0);
  const [open, setOpen] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [failure, setFailure] = React.useState<string | null>(null);
  const pageSize = 10;
  const list = useRemote<DepositPage>(`/api/account/deposits?page=${pageNo}&pageSize=${pageSize}&v=${version}`);

  const cancel = async (ref: string) => {
    setBusy(ref);
    setFailure(null);
    try {
      await api(`/api/account/deposits/${encodeURIComponent(ref)}/cancel`, { method: "POST", body: "{}" });
      setVersion((v) => v + 1);
      void live.refreshWallet();
    } catch (e) {
      setFailure(e instanceof Error ? e.message : "The request wasn't cancelled.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Panel className="mt-5 overflow-hidden" aria-busy={list.loading || undefined}>
      <PanelHeader className="px-5 pt-5 pb-3" title="Deposit requests" description="Pending requests are never part of your available balance." />
      {failure ? (
        <p role="alert" className="mx-5 mb-3 rounded-xl border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-sm">
          {failure}
        </p>
      ) : null}
      {list.error ? (
        <ErrorState message={list.error} onRetry={list.retry} />
      ) : !list.data ? (
        <div className="space-y-2 px-5 pb-5" aria-label="Loading deposit requests">
          {[0, 1].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />
          ))}
        </div>
      ) : list.data.items.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="No deposit requests"
          action={
            <Link href={ROUTES["add-funds"]} className={secondaryLink}>
              <Wallet className="size-4" aria-hidden /> Add funds
            </Link>
          }
        >
          When you request a deposit, its reference and status appear here.
        </EmptyState>
      ) : (
        <>
          <ul className="divide-y border-t">
            {list.data.items.map((d) => {
              const expanded = open === d.reference;
              return (
                <li key={d.reference} className="px-5 py-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                        <span className="font-mono text-[0.82rem]">{d.reference}</span>
                        <DepositStatusBadge status={d.status} />
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {d.methodName} · requested {formatDateTime(d.requestedAt)}
                        {d.creditedAt ? ` · credited ${formatDateTime(d.creditedAt)}` : d.status === "awaiting_payment" && d.expiresAt ? ` · expires ${formatDateTime(d.expiresAt)}` : ""}
                      </p>
                      {d.statusReason ? <p className="mt-1 text-xs text-muted-foreground">{d.statusReason}</p> : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <p className={cn("font-heading font-bold tabular-nums", d.status === "credited" ? "text-primary" : "text-muted-foreground")}>
                        {d.status === "credited" ? "+" : ""}
                        {cents(d.amountCents)}
                      </p>
                      {d.instructions ? (
                        <button type="button" onClick={() => setOpen(expanded ? null : d.reference)} aria-expanded={expanded} className="inline-flex h-8 items-center rounded-full border px-3 text-xs font-semibold hover:bg-muted">
                          {expanded ? "Hide details" : "Payment details"}
                        </button>
                      ) : null}
                      {d.status === "awaiting_payment" ? (
                        <button type="button" onClick={() => cancel(d.reference)} disabled={busy === d.reference} className="inline-flex h-8 items-center rounded-full px-3 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-destructive disabled:opacity-50">
                          {busy === d.reference ? "Cancelling…" : "Cancel"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                  {expanded && d.instructions ? (
                    <div className="mt-3 max-w-lg">
                      <BankInstructionsPanel instructions={d.instructions} amountCents={d.amountCents} />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {list.data.pages > 1 ? <Pagination page={pageNo} pageCount={list.data.pages} total={list.data.total} pageSize={pageSize} label="Deposit request pages" onPage={setPageNo} /> : null}
        </>
      )}
    </Panel>
  );
}

/* -------------------------------------------------------------------------- */
/*  Service catalog                                                           */
/* -------------------------------------------------------------------------- */

interface CatalogItem {
  id: string;
  name: string;
  description: string;
  platform: { id: string; name: string };
  category: ServiceCategory;
  categoryLabel: string;
  status: "available" | "preview";
  price: { amount: number; unit: string } | null;
  limits: { min: number | null; max: number | null } | null;
}

interface CatalogPage {
  items: CatalogItem[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
}

const control =
  "h-11 rounded-xl border bg-card px-3.5 text-sm shadow-xs outline-none transition-colors hover:border-foreground/20 focus-visible:border-primary/50 focus-visible:ring-3 focus-visible:ring-primary/15";

export function LiveCatalog() {
  useDisplay();
  const [q, setQ] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [platform, setPlatform] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [sort, setSort] = React.useState<"name" | "platform">("platform");
  const [pageNo, setPageNo] = React.useState(1);
  const pageSize = 24;

  // Debounce typing so each keystroke doesn't hit the server.
  React.useEffect(() => {
    const t = window.setTimeout(() => {
      setQuery(q.trim());
      setPageNo(1);
    }, 250);
    return () => window.clearTimeout(t);
  }, [q]);

  const params = new URLSearchParams({ sort, page: String(pageNo), pageSize: String(pageSize) });
  if (query) params.set("q", query);
  if (platform) params.set("platform", platform);
  if (category) params.set("category", category);
  const result = useRemote<CatalogPage>(`/api/catalog/services?${params}`);
  const e = [1, 2].map(enter);
  const filtered = Boolean(query || platform || category);

  return (
    <div className={page}>
      <Header title="Services" subtitle="Every service in the Sociotix catalog. Prices appear when a service opens for ordering." />

      <div className={cn("mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_12rem_12rem_10rem]", e[0].className)} style={e[0].style} role="search">
        <label className="relative sm:col-span-2 lg:col-span-1">
          <span className="sr-only">Search services</span>
          <Search className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input type="search" value={q} onChange={(ev) => setQ(ev.target.value)} placeholder="Search services" maxLength={80} className={cn(control, "w-full ps-10")} />
        </label>
        <label>
          <span className="sr-only">Platform</span>
          <Select value={platform} onChange={(ev) => (setPlatform(ev.target.value), setPageNo(1))} className={cn(control, "w-full")}>
            <option value="">All platforms</option>
            {PLATFORMS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </label>
        <label>
          <span className="sr-only">Service type</span>
          <Select value={category} onChange={(ev) => (setCategory(ev.target.value), setPageNo(1))} className={cn(control, "w-full")}>
            <option value="">All types</option>
            {CATEGORY_ORDER.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_META[c].label}
              </option>
            ))}
          </Select>
        </label>
        <label>
          <span className="sr-only">Sort by</span>
          <Select value={sort} onChange={(ev) => (setSort(ev.target.value as "name" | "platform"), setPageNo(1))} className={cn(control, "w-full")}>
            <option value="platform">By platform</option>
            <option value="name">By name</option>
          </Select>
        </label>
      </div>

      <div className={cn("mt-5", e[1].className)} style={e[1].style} aria-busy={result.loading || undefined}>
        <p className="mb-3 text-sm text-muted-foreground" aria-live="polite">
          {result.data ? `${result.data.total} ${result.data.total === 1 ? "service" : "services"}${filtered ? " match" : ""}` : " "}
        </p>
        {result.error ? (
          <Panel>
            <ErrorState message={result.error} onRetry={result.retry} />
          </Panel>
        ) : !result.data ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Loading services">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="h-40 animate-pulse rounded-2xl bg-muted motion-reduce:animate-none" />
            ))}
          </div>
        ) : result.data.items.length === 0 ? (
          <Panel>
            <EmptyState icon={LayoutGrid} title="No services match">
              Try a different search, or clear the platform and type filters.
            </EmptyState>
          </Panel>
        ) : (
          <>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {result.data.items.map((s) => {
                const p = PLATFORM_BY_ID.get(s.platform.id);
                return (
                  <li key={s.id}>
                    <Panel className="flex h-full flex-col p-5">
                      <div className="flex items-start gap-3">
                        {p ? <PlatformTile platform={p} size="sm" /> : null}
                        <div className="min-w-0">
                          <p className="font-semibold leading-snug">{s.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {s.platform.name} · {s.categoryLabel}
                          </p>
                        </div>
                      </div>
                      <p className="mt-3 line-clamp-3 flex-1 text-sm text-muted-foreground">{s.description}</p>
                      <div className="mt-4 flex items-center justify-between gap-2 border-t pt-3">
                        {s.price ? (
                          <p className="text-sm">
                            <span className="font-heading font-bold tabular-nums">{usd(s.price.amount)}</span> <span className="text-muted-foreground">{s.price.unit}</span>
                          </p>
                        ) : (
                          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                            <Lock className="size-3" aria-hidden /> Not open for ordering yet
                          </p>
                        )}
                        <span className={cn("rounded-full px-2 py-0.5 text-[0.65rem] font-bold tracking-wider uppercase", s.status === "available" ? "bg-lime text-graphite" : "bg-muted text-muted-foreground")}>
                          {s.status === "available" ? "Available" : "Coming soon"}
                        </span>
                      </div>
                    </Panel>
                  </li>
                );
              })}
            </ul>
            {result.data.pages > 1 ? (
              <Panel className="mt-4 overflow-hidden">
                <Pagination page={pageNo} pageCount={result.data.pages} total={result.data.total} pageSize={pageSize} label="Service pages" onPage={(n) => (setPageNo(n), window.scrollTo({ top: 0 }))} />
              </Panel>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
