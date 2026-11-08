"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Bell, ChevronRight, CircleCheck, Heart, PackageSearch, Plus, TriangleAlert, Wallet } from "lucide-react";
import { PlatformIcon, PlatformTile } from "@/components/brand";
import { PLATFORM_BY_ID } from "@/lib/catalog";
import { count, DEMO_WALLET, type DemoOrder, formatDate, money, ORDER_STATUS_META, orderService } from "@/lib/demo-account";
import { formatMoneyParts, isConverted, t, useDisplay } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { type LocalOrder, useDemoActivity, useDemoOrders, useFavorites, useProfile, whenLabel } from "./demo-store";
import { CardIcon, DigitalProductsCard, FinderCard, HelpCard, useGreeting, WalletCard } from "./overview-parts";
import { TourHelpButton } from "@/components/tour/guided-tour";
import { ForYouPanel } from "./onboarding";
import { dashButton, DemoTag, enter, newOrderHref, ordersHref, OrderStatusBadge, Panel, PanelHeader, ROUTES, useDestinations } from "./shared";
import { ACTIVITY_ICONS } from "./top-bar";

type OrderFilter = "all" | "active" | "attention" | "completed";
type CardProps = { className?: string; style?: React.CSSProperties };

const inFilter = (o: DemoOrder, f: OrderFilter) =>
  f === "all" || (f === "active" && (o.status === "pending" || o.status === "processing")) || o.status === f;

const progressOf = (o: DemoOrder) => Math.round(((o.delivered ?? 0) / o.quantity) * 100);

function useOpenOrder() {
  const go = useDestinations();
  return (o: DemoOrder) => go("orders", { query: { order: o.id } });
}

/* -------------------------------------------------------------------------- */
/*  1 · New order (welcome)                                                   */
/* -------------------------------------------------------------------------- */

const QUICK_PLATFORMS = ["instagram", "tiktok", "youtube", "facebook", "x"];

function StartOrder({ className, style }: CardProps) {
  const greeting = useGreeting();
  const openOrder = useOpenOrder();
  const { recent, summary } = useDemoOrders();
  const { profile } = useProfile();
  const favorites = useFavorites().ids.length;
  const live = recent.find((o) => o.status === "processing");

  return (
    <Panel className={cn("relative isolate overflow-hidden", className)} style={style} aria-labelledby="welcome-title">
      <div className="pointer-events-none absolute -end-24 -top-32 -z-10 size-80 rounded-full bg-primary/[0.08] blur-3xl dark:bg-primary/15" aria-hidden />
      <TourHelpButton tour="dashboard" className="absolute end-3 top-3 sm:end-4 sm:top-4" />

      <div className="p-4 sm:p-6">
        <p className="flex flex-wrap items-center gap-2 text-[0.82rem] font-medium text-muted-foreground">
          {greeting}, {profile.displayName}
          <DemoTag className="text-primary">Demo workspace</DemoTag>
        </p>
        <h1 id="welcome-title" className="mt-1.5 font-heading text-[1.6rem] leading-[1.12] font-extrabold tracking-tight text-balance sm:text-[2rem]">
          What would you like to grow today?
        </h1>
        <p className="mt-1.5 text-[0.9rem] text-muted-foreground">
          {summary.active} {summary.active === 1 ? "order is" : "orders are"} in progress
          {summary.attention ? (
            <>
              {" · "}
              <span className="font-semibold text-soon">
                {summary.attention} {summary.attention === 1 ? "needs" : "need"} your action
              </span>
            </>
          ) : null}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Link href={newOrderHref()} className={cn(dashButton.primary, "h-11 px-5 text-[0.95rem]")}>
            <Plus className="size-[1.1rem]" strokeWidth={2.6} aria-hidden /> New Order
          </Link>
          <Link href={ROUTES["add-funds"]} className={cn(dashButton.secondary, "h-11")}>
            <Wallet className="size-4" aria-hidden /> Add Funds
          </Link>
        </div>

        {/* Shortcuts straight into New Order with a platform chosen */}
        <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-0.5 no-scrollbar" role="group" aria-label="Start an order for a platform">
          <span className="shrink-0 text-xs font-medium text-muted-foreground">Start with</span>
          {QUICK_PLATFORMS.map((id) => {
            const p = PLATFORM_BY_ID[id];
            return (
              <Link
                key={id}
                href={`${ROUTES["new-order"]}?platform=${id}`}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border bg-card ps-1 pe-3 text-[0.8rem] font-semibold transition-colors hover:border-primary/35 hover:bg-secondary/40 focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none"
              >
                <span className="grid size-7 place-items-center rounded-full" style={{ backgroundColor: p.color, color: p.ink }} aria-hidden>
                  <PlatformIcon icon={p.icon} className="size-3.5" />
                </span>
                {p.short}
              </Link>
            );
          })}
          {favorites ? (
            <Link
              href={`${ROUTES["new-order"]}?view=favorites`}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border bg-card px-3 text-[0.8rem] font-semibold transition-colors hover:border-primary/35 hover:bg-secondary/40 focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none"
            >
              <Heart className="size-3.5 fill-current text-primary" aria-hidden /> Favorites
              <span className="text-muted-foreground tabular-nums">{favorites}</span>
            </Link>
          ) : null}
        </div>
      </div>

      {live ? (
        <button
          type="button"
          onClick={() => openOrder(live)}
          className="group grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 border-t bg-muted/40 px-4 py-3 text-start transition-colors hover:bg-muted/70 focus-visible:bg-muted/70 focus-visible:outline-none sm:grid-cols-[auto_minmax(0,15rem)_minmax(0,1fr)_auto] sm:px-6"
          aria-label={`In delivery: ${orderService(live).service.name}, ${progressOf(live)}% delivered. View order ${live.id}`}
        >
          <PlatformTile platform={orderService(live).platform} size="sm" />
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 text-[0.66rem] font-bold tracking-wider text-primary uppercase">
              <span className="relative flex size-1.5" aria-hidden>
                <span className="absolute inset-0 animate-ping rounded-full bg-primary/60 motion-reduce:hidden" />
                <span className="relative size-1.5 rounded-full bg-primary" />
              </span>
              In delivery
            </span>
            <span className="block truncate text-sm font-semibold">
              {orderService(live).service.name} <span className="font-normal text-muted-foreground">· {live.id}</span>
            </span>
          </span>
          <span className="col-span-3 row-start-2 sm:col-span-1 sm:row-start-auto">
            <Progress pct={progressOf(live)} detail={`${count(live.delivered ?? 0)} / ${count(live.quantity)}`} />
          </span>
          <ChevronRight className="col-start-3 row-start-1 size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary sm:col-start-auto sm:row-start-auto rtl:-scale-x-100" aria-hidden />
        </button>
      ) : null}
    </Panel>
  );
}

/* -------------------------------------------------------------------------- */
/*  2 · Needs your action                                                     */
/* -------------------------------------------------------------------------- */

function NeedsAction({ className, style }: CardProps) {
  const openOrder = useOpenOrder();
  const needsAction = useDemoOrders().recent.filter((o) => o.status === "attention");

  if (!needsAction.length) {
    return (
      <Panel className={cn("flex items-center gap-3 px-4 py-3.5 sm:px-5", className)} style={style} aria-labelledby="attention-title">
        <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-ok-soft text-ok" aria-hidden>
          <CircleCheck className="size-4" />
        </span>
        <div className="min-w-0">
          <h2 id="attention-title" className="font-heading text-[0.95rem] font-bold">
            Nothing needs your action
          </h2>
          <p className="text-[0.8rem] text-muted-foreground">Paused orders will show up here. Updates you saved stay in this demo.</p>
        </div>
      </Panel>
    );
  }

  return (
    <Panel className={cn("overflow-hidden", className)} style={style} aria-labelledby="attention-title">
      <div className="flex items-center gap-3 px-4 pt-4 sm:px-5">
        <CardIcon icon={TriangleAlert} tone="amber" />
        <div className="min-w-0 flex-1">
          <h2 id="attention-title" className="flex items-center gap-2 font-heading text-[0.98rem] font-bold tracking-tight">
            Needs your action
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-soon px-1.5 text-[0.7rem] font-bold text-white dark:text-graphite">{needsAction.length}</span>
          </h2>
          <p className="text-[0.82rem] text-muted-foreground">These orders are paused until you step in.</p>
        </div>
      </div>
      <ul className="mt-3 divide-y border-t">
        {needsAction.map((o) => {
          const { service, platform } = orderService(o);
          return (
            <li key={o.id} className="relative flex flex-col gap-2.5 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
              <span className="absolute inset-y-3 start-0 w-[3px] rounded-e-full bg-soon" aria-hidden />
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <PlatformTile platform={platform} size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {service.name} <span className="font-normal text-muted-foreground">· {o.id}</span>
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-[0.8rem] leading-snug text-muted-foreground">{o.attention?.reason}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1 ps-12 sm:ps-0">
                <Link
                  href={ordersHref({ order: o.id })}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full bg-foreground px-3.5 text-xs font-semibold text-background transition-opacity hover:opacity-85 focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none"
                >
                  {o.attention?.action}
                  <ArrowRight className="size-3.5 rtl:-scale-x-100" aria-hidden />
                </Link>
                <button
                  type="button"
                  onClick={() => openOrder(o)}
                  className="inline-flex h-9 items-center rounded-full px-3 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none"
                >
                  Details
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

/* -------------------------------------------------------------------------- */
/*  3 · Orders (active first)                                                 */
/* -------------------------------------------------------------------------- */

const FILTERS: { id: OrderFilter; label: string }[] = [
  { id: "active", label: "In progress" },
  { id: "attention", label: "Needs action" },
  { id: "completed", label: "Completed" },
  { id: "all", label: "All" },
];

const ROW_COLS = "md:grid-cols-[minmax(0,1fr)_5rem_5rem_9rem_1.75rem]";

function ActiveOrders({ className, style }: CardProps) {
  const openOrder = useOpenOrder();
  const { recent, summary } = useDemoOrders();
  const [filter, setFilter] = React.useState<OrderFilter>("active");
  const orders = recent.filter((o) => inFilter(o, filter));
  // Tab counts describe the rows below (recent orders); the bar describes every order.
  const counts = Object.fromEntries(FILTERS.map((f) => [f.id, recent.filter((o) => inFilter(o, f.id)).length])) as Record<OrderFilter, number>;
  // Share of all orders by status: the real totals, drawn as one bar.
  const segments = [
    { id: "attention", label: "Needs action", value: summary.attention, bar: "bg-soon" },
    { id: "active", label: "In progress", value: summary.active, bar: "bg-primary" },
    { id: "completed", label: "Completed", value: summary.completed, bar: "bg-ok" },
    { id: "cancelled", label: "Cancelled", value: summary.cancelled, bar: "bg-muted-foreground/40" },
  ].filter((s) => s.value);

  return (
    <Panel id="recent-orders" className={cn("scroll-mt-24 overflow-hidden", className)} style={style} aria-labelledby="orders-title">
      <div className="p-4 sm:p-5">
        <PanelHeader
          id="orders-title"
          title="Your orders"
          description={`${summary.total} orders in total · demo data`}
          action={
            <Link href={ROUTES.orders} className={dashButton.ghost}>
              View all <ArrowRight className="size-3.5 rtl:-scale-x-100" aria-hidden />
            </Link>
          }
        />

        {summary.total ? (
          <>
            <div className="mt-4 flex h-2 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={segments.map((s) => `${s.value} ${s.label.toLowerCase()}`).join(", ")}>
              {segments.map((s) => (
                <span key={s.id} className={cn("h-full first:rounded-s-full last:rounded-e-full", s.bar)} style={{ flexGrow: s.value }} />
              ))}
            </div>
            <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-hidden>
              {segments.map((s) => (
                <li key={s.id} className="flex items-center gap-1.5">
                  <span className={cn("size-2 rounded-full", s.bar)} />
                  {s.label} <span className="font-semibold text-foreground tabular-nums">{s.value}</span>
                </li>
              ))}
            </ul>
          </>
        ) : null}

        <div className="-mx-1 mt-4 overflow-x-auto px-1 no-scrollbar">
          <div className="inline-flex gap-1 rounded-full bg-muted p-1" role="group" aria-label="Filter orders">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={filter === f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[0.8rem] font-semibold whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none",
                  filter === f.id && "bg-card text-foreground shadow-sm",
                )}
              >
                {f.label}
                <span className={cn("text-[0.7rem] tabular-nums", filter === f.id ? "text-primary" : "text-muted-foreground/80")}>{counts[f.id]}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={cn("hidden gap-4 border-y bg-muted/40 px-5 py-2 text-[0.66rem] font-bold tracking-wider text-muted-foreground uppercase md:grid", ROW_COLS)} aria-hidden>
        <span>Service</span>
        <span className="text-end">Quantity</span>
        <span className="text-end">Price</span>
        <span>Status</span>
        <span />
      </div>

      {orders.length ? (
        <ul className="divide-y border-t md:border-t-0">
          {orders.map((o) => (
            <li key={o.id}>
              <OrderRow order={o} onOpen={() => openOrder(o)} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="border-t px-6 py-10 text-center">
          <span className="mx-auto grid size-11 place-items-center rounded-2xl bg-muted text-muted-foreground">
            <PackageSearch className="size-5" aria-hidden />
          </span>
          <p className="mt-3 font-semibold">No orders here</p>
          <p className="mt-1 text-sm text-muted-foreground">Nothing matches this filter right now.</p>
          <button type="button" className={cn(dashButton.ghost, "mt-2")} onClick={() => setFilter("all")}>
            Show all orders
          </button>
        </div>
      )}

      <p className="border-t bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground sm:px-5">
        Showing {orders.length} of your {recent.length} most recent orders. Prices and orders are illustrative.
      </p>
    </Panel>
  );
}

function OrderRow({ order, onOpen }: { order: LocalOrder; onOpen: () => void }) {
  const { service, platform } = orderService(order);
  const demoTag = order.demoUpdated ? <DemoTag className="text-primary">Demo update</DemoTag> : null;
  const pct = order.status === "processing" ? progressOf(order) : null;
  const flagged = order.status === "attention";

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Order ${order.id}: ${service.name}, ${ORDER_STATUS_META[order.status].label}${order.demoUpdated ? ", updated in this demo only" : ""}`}
      className={cn(
        "group relative flex w-full items-start gap-3 px-4 py-3.5 text-start transition-colors hover:bg-muted/50 focus-visible:bg-muted/60 focus-visible:outline-none sm:px-5 md:grid md:items-center md:gap-4",
        ROW_COLS,
        flagged && "bg-soon-soft/25",
      )}
    >
      {flagged ? <span className="absolute inset-y-3 start-0 w-[3px] rounded-e-full bg-soon" aria-hidden /> : null}

      <span className="flex min-w-0 flex-1 items-start gap-3 md:items-center">
        <PlatformTile platform={platform} size="md" className="size-10 rounded-xl" />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-3">
            <span className="text-[0.92rem] leading-snug font-semibold max-md:line-clamp-1 md:truncate">{service.name}</span>
            <span className="shrink-0 text-sm font-semibold tabular-nums md:hidden">{money(order.price)}</span>
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {order.id}
            <span className="md:hidden"> · {count(order.quantity)}</span> · {formatDate(order.placedAt)}
          </span>
          <span className="mt-2 flex items-center gap-3 md:hidden">
            <OrderStatusBadge status={order.status} />
            {demoTag}
            {pct !== null ? <Progress pct={pct} /> : null}
          </span>
          {pct !== null ? (
            <span className="mt-2 hidden md:flex">
              <Progress pct={pct} className="max-w-48" />
            </span>
          ) : null}
        </span>
      </span>

      <span className="hidden text-end text-sm tabular-nums md:block">{count(order.quantity)}</span>
      <span className="hidden text-end text-sm font-semibold tabular-nums md:block">{money(order.price)}</span>
      <span className="hidden md:flex md:flex-col md:items-start md:gap-1">
        <OrderStatusBadge status={order.status} />
        {demoTag}
      </span>
      <span className="hidden size-7 place-items-center rounded-full text-muted-foreground transition-colors group-hover:bg-card group-hover:text-primary group-hover:shadow-sm md:grid" aria-hidden>
        <ChevronRight className="size-4 rtl:-scale-x-100" />
      </span>
    </button>
  );
}

function Progress({ pct, detail, className }: { pct: number; detail?: string; className?: string }) {
  return (
    <span className={cn("flex min-w-0 flex-1 items-center gap-2", className)}>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-border/70">
        <span className="block h-full rounded-full bg-primary transition-[width] duration-700 motion-reduce:transition-none" style={{ width: `${pct}%` }} />
      </span>
      <span className="shrink-0 text-[0.7rem] font-semibold text-muted-foreground tabular-nums">
        {detail ? <span className="me-1.5 hidden font-normal sm:inline">{detail}</span> : null}
        {pct}%
      </span>
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  6 · Recent activity                                                       */
/* -------------------------------------------------------------------------- */

function RecentActivity({ className, style }: CardProps) {
  const updates = useDemoActivity().activity.filter((a) => a.kind !== "attention").slice(0, 4);
  return (
    <Panel className={cn("p-4 sm:p-5", className)} style={style} aria-labelledby="updates-title">
      <PanelHeader id="updates-title" title="Recent activity" description="Updates about your orders and wallet." />
      {updates.length ? (
        <ol className="relative mt-4 space-y-3.5 before:absolute before:top-2 before:bottom-2 before:start-[0.9375rem] before:w-px before:bg-border">
          {updates.map((a) => {
            const { Icon, className: tone } = ACTIVITY_ICONS[a.kind];
            return (
              <li key={a.id} className="relative flex gap-3">
                <span className={cn("relative grid size-[1.875rem] shrink-0 place-items-center rounded-full ring-4 ring-card", tone)}>
                  <Icon className="size-3.5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-medium">{a.title}</span>
                    <time className="shrink-0 text-[0.7rem] text-muted-foreground">{whenLabel(a.when)}</time>
                  </p>
                  <p className="text-xs text-muted-foreground">{a.detail}</p>
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="mt-4 flex items-center gap-2.5 rounded-xl border border-dashed p-3.5 text-sm text-muted-foreground">
          <Bell className="size-4 shrink-0" aria-hidden /> No activity yet.
        </p>
      )}
    </Panel>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export function Overview() {
  // Re-render when language, currency, time zone or date format change.
  useDisplay();
  const fx = isConverted() ? t("fx.note") : null;
  const { main, rest } = formatMoneyParts(DEMO_WALLET.balance);
  const a = [0, 1, 2, 3, 4, 5, 6, 7].map(enter);

  // Below xl the two columns dissolve (`contents`) into one grid that follows the priority
  // order: new order, needs action, orders, wallet, finder, activity, digital products, help.
  return (
    <div className="mx-auto max-w-[90rem] px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
      <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,23rem)] xl:items-start xl:gap-5">
        <div className="contents xl:flex xl:flex-col xl:gap-5">
          <StartOrder className={cn("order-1 md:col-span-2", a[0].className)} style={a[0].style} />
          <NeedsAction className={cn("order-2 md:col-span-2", a[1].className)} style={a[1].style} />
          <ActiveOrders className={cn("order-3 md:col-span-2", a[2].className)} style={a[2].style} />
          <ForYouPanel className={cn("order-3 md:col-span-2", a[2].className)} style={a[2].style} />
        </div>
        <div className="contents xl:flex xl:flex-col xl:gap-5">
          <WalletCard
            className={cn("order-4", a[3].className)}
            style={a[3].style}
            whole={main}
            rest={rest}
            demo
            stats={[
              { label: `Last top-up · ${formatDate(DEMO_WALLET.lastTopUp.at)}`, value: money(DEMO_WALLET.lastTopUp.amount) },
              { label: "Net spent in October", value: money(DEMO_WALLET.spentThisMonth) },
            ]}
            note={
              <>
                Demo balance for preview only. No real funds are held and payments aren&apos;t enabled yet.
                {fx ? ` ${fx}` : null}
              </>
            }
          />
          <FinderCard className={cn("order-5", a[4].className)} style={a[4].style} />
          <RecentActivity className={cn("order-6", a[5].className)} style={a[5].style} />
          <DigitalProductsCard className={cn("order-7", a[6].className)} style={a[6].style} />
          <HelpCard className={cn("order-8 md:col-span-2 xl:col-span-1", a[7].className)} style={a[7].style} />
        </div>
      </div>
    </div>
  );
}
