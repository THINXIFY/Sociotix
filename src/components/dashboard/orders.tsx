"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowRight, CircleCheck, FlaskConical, PackageSearch, Plus, RefreshCw, RotateCcw, TriangleAlert, X } from "lucide-react";
import { PlatformTile } from "@/components/brand";
import { PLATFORM_BY_ID, PLATFORMS } from "@/lib/catalog";
import { count, deliveryProgress, type DemoOrder, formatDate, money, ORDER_STATUS_META, ORDERS, orderService, type OrderStatus } from "@/lib/demo-account";
import { useDisplay } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { type LocalOrder, resetDemoData, useDemoOrders } from "./demo-store";
import { OrderDetails } from "./order-details";
import { OrderList, OrdersHeader, OrdersMessage, type OrderRowView, QuickFilters, SearchBox, StatusOverview, ToolbarSelect } from "./orders-ui";
import { FxNote } from "./region";
import { dashButton, enter, newOrderHref, OrderStatusBadge, Pagination, Panel, ROUTES } from "./shared";

/* -------------------------------------------------------------------------- */
/*  Filters                                                                   */
/* -------------------------------------------------------------------------- */

/** `active` groups pending and in-progress orders, matching the Overview. */
type StatusFilter = "all" | "active" | OrderStatus;
type SortOrder = "priority" | "newest" | "oldest";

const PAGE_SIZE = 10;

const VALID_STATUS = new Set<string>(["all", "active", "pending", "processing", "attention", "completed", "cancelled"]);
const parseStatus = (v: string | null): StatusFilter => (v && VALID_STATUS.has(v) ? (v as StatusFilter) : "all");
const parsePlatform = (v: string | null) => (v && PLATFORM_BY_ID[v] ? v : "all");
const parseSort = (v: string | null): SortOrder => (v === "newest" || v === "oldest" ? v : "priority");

const matchesStatus = (o: DemoOrder, f: StatusFilter) =>
  f === "all" || (f === "active" ? o.status === "pending" || o.status === "processing" : o.status === f);

function matchesSearch(o: DemoOrder, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const { service, platform } = orderService(o);
  return [o.id, service.name, platform.name, platform.short].some((t) => t.toLowerCase().includes(q));
}

/** Orders that need the customer come first, then live ones, then finished ones; newest first within each. */
const PRIORITY: Record<OrderStatus, number> = { attention: 0, processing: 1, pending: 2, completed: 3, cancelled: 4 };
const SORTERS: Record<SortOrder, (a: DemoOrder, b: DemoOrder) => number> = {
  priority: (a, b) => PRIORITY[a.status] - PRIORITY[b.status] || b.placedAt.localeCompare(a.placedAt),
  newest: (a, b) => b.placedAt.localeCompare(a.placedAt),
  oldest: (a, b) => a.placedAt.localeCompare(b.placedAt),
};

/** Platforms that appear in the customer's orders, in catalog order. */
const ORDER_PLATFORMS = PLATFORMS.filter((p) => ORDERS.some((o) => orderService(o).platform.id === p.id));

function noteOf(o: LocalOrder): OrderRowView["note"] {
  if (o.status === "attention") return { text: o.attention?.title ?? "Action needed", tone: "attention" };
  if (o.status === "pending") return { text: o.demoUpdated ? "Re-check requested (demo)" : "Awaiting target check", tone: "muted" };
  if (o.status === "completed" && o.completedAt) return { text: `Completed ${formatDate(o.completedAt)}`, tone: "muted" };
  if (o.status === "cancelled" && o.cancelReason) return { text: o.cancelReason, tone: "muted" };
  return null;
}

function toRow(o: LocalOrder): OrderRowView {
  const { service, platform } = orderService(o);
  const progress = o.status === "processing" ? deliveryProgress(o) : null;
  const flagged = o.status === "attention";
  return {
    id: o.id,
    service: service.name,
    platform,
    platformName: platform.name,
    date: formatDate(o.placedAt),
    amount: money(o.price),
    quantity: count(o.quantity),
    status: <OrderStatusBadge status={o.status} />,
    progress: progress ? { pct: progress.pct, label: `${count(progress.delivered)} of ${count(progress.total)} delivered` } : null,
    note: noteOf(o),
    flagged,
    dim: o.status === "cancelled",
    label: `Order ${o.id}: ${service.name}, ${ORDER_STATUS_META[o.status].label}${flagged ? `. Action needed: ${o.attention?.title}` : ""}`,
  };
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export function MyOrders() {
  // Re-render when language, currency, time zone or date format change.
  useDisplay();
  const params = useSearchParams();
  const { orders, summary, changes } = useDemoOrders();
  const [status, setStatus] = React.useState<StatusFilter>(() => parseStatus(params.get("status")));
  const [platform, setPlatform] = React.useState(() => parsePlatform(params.get("platform")));
  const [query, setQuery] = React.useState(() => params.get("q") ?? "");
  const [sort, setSort] = React.useState<SortOrder>(() => parseSort(params.get("sort")));
  const [page, setPage] = React.useState(1);
  const [openId, setOpenId] = React.useState<string | null>(() => params.get("order"));
  const [actionFor, setActionFor] = React.useState<string | null>(null);
  const [resetDone, setResetDone] = React.useState(false);
  const lastTrigger = React.useRef<HTMLElement | null>(null);

  // Links can arrive while this page is still mounted (e.g. from the Overview), so follow param changes.
  const orderParam = params.get("order");
  const statusParam = params.get("status");
  const [seen, setSeen] = React.useState({ order: orderParam, status: statusParam });
  if (seen.order !== orderParam || seen.status !== statusParam) {
    setSeen({ order: orderParam, status: statusParam });
    if (orderParam && orderParam !== seen.order) setOpenId(orderParam);
    if (statusParam !== seen.status) setStatus(parseStatus(statusParam));
  }

  // Leaving the page (e.g. Contact Support) closes the drawer, so it isn't still open on return.
  const pathname = usePathname();
  if (pathname !== ROUTES.orders && openId) setOpenId(null);

  // Keep the URL shareable, and Back from another page restores the same view.
  React.useEffect(() => {
    const qs = new URLSearchParams();
    if (status !== "all") qs.set("status", status);
    if (platform !== "all") qs.set("platform", platform);
    if (query.trim()) qs.set("q", query.trim());
    if (sort !== "priority") qs.set("sort", sort);
    if (openId) qs.set("order", openId);
    const next = `${ROUTES.orders}${qs.size ? `?${qs}` : ""}`;
    // Only while this page is showing: closing a drawer on the way to another page mustn't pull the URL back.
    if (window.location.pathname !== ROUTES.orders) return;
    if (window.location.search !== (qs.size ? `?${qs}` : "")) window.history.replaceState(null, "", next);
  }, [status, platform, query, sort, openId]);

  const scoped = orders.filter((o) => (platform === "all" || orderService(o).platform.id === platform) && matchesSearch(o, query));
  const statusCount = (f: StatusFilter) => scoped.filter((o) => matchesStatus(o, f)).length;
  const visible = scoped.filter((o) => matchesStatus(o, status)).sort(SORTERS[sort]);
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const shown = visible.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const needsAction = orders.filter((o) => o.status === "attention");
  const filtered = status !== "all" || platform !== "all" || query.trim() !== "" || sort !== "priority";
  const openOrder = orders.find((o) => o.id === openId) ?? null;
  const missingId = openId && !openOrder ? openId : null;

  // Any change to what's listed starts again from the first page.
  const update = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(1);
  };
  const changeStatus = update(setStatus);

  const clearFilters = () => {
    setStatus("all");
    setPlatform("all");
    setQuery("");
    setSort("priority");
    setPage(1);
  };

  const open = (id: string, withAction = false) => {
    lastTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setActionFor(withAction ? id : null);
    setOpenId(id);
  };

  const close = () => {
    setOpenId(null);
    setActionFor(null);
    // Return focus to whatever opened the drawer.
    requestAnimationFrame(() => lastTrigger.current?.focus({ preventScroll: true }));
  };

  const reset = () => {
    resetDemoData();
    setResetDone(true);
  };

  const quickValue = status === "pending" || status === "processing" ? "active" : status;
  const e = [0, 1, 2, 3].map(enter);

  return (
    <div className="mx-auto max-w-[90rem] px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
      <div className={e[0].className} style={e[0].style}>
        <OrdersHeader demo description="Track delivery, fix anything that needs you and reorder in a click." />
      </div>

      <div className={cn("mt-5", e[1].className)} style={e[1].style}>
        <StatusOverview
          value={quickValue}
          onSelect={(id) => changeStatus(quickValue === id && id !== "all" ? "all" : id)}
          items={[
            { id: "all", label: "All orders", value: summary.total, hint: summary.cancelled ? `${summary.cancelled} cancelled` : "All time", Icon: PackageSearch, tone: "neutral" },
            { id: "active", label: "In progress", value: summary.active, hint: `${summary.pending} pending · ${summary.processing} delivering`, Icon: RefreshCw, tone: "violet" },
            { id: "attention", label: "Needs attention", value: summary.attention, hint: summary.attention ? "Waiting on you" : "All clear", Icon: TriangleAlert, tone: "amber" },
            { id: "completed", label: "Completed", value: summary.completed, hint: "Delivered", Icon: CircleCheck, tone: "green" },
          ]}
        />
      </div>

      {/* Orders waiting on the customer, with the fix one tap away */}
      {needsAction.length && (status === "all" || status === "attention") ? (
        <section aria-labelledby="action-title" className={cn("mt-4 rounded-2xl border border-soon/30 bg-soon-soft/40 p-3 sm:p-3.5", e[2].className)} style={e[2].style}>
          <h2 id="action-title" className="flex items-center gap-2 px-1 text-sm font-bold">
            <TriangleAlert className="size-4 text-soon" aria-hidden />
            {needsAction.length === 1 ? "1 order needs your action" : `${needsAction.length} orders need your action`}
          </h2>
          <ul className="mt-2.5 grid grid-cols-1 gap-2 lg:grid-cols-2">
            {needsAction.map((o) => {
              const { service, platform: p } = orderService(o);
              return (
                <li key={o.id} className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-2.5 sm:flex-nowrap sm:p-3">
                  <PlatformTile platform={p} size="sm" className="size-9 rounded-xl" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{o.attention?.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {service.name} · <span className="font-mono">{o.id}</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => open(o.id, true)}
                    className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-full bg-foreground px-4 text-xs font-semibold text-background transition-opacity hover:opacity-85 focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none max-sm:basis-full sm:h-9 sm:px-3.5"
                  >
                    {o.attention?.action}
                    <ArrowRight className="size-3.5 rtl:-scale-x-100" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {/* Simulated changes, kept in this browser until reset */}
      <div role="status">
        {changes ? (
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-dashed border-primary/40 bg-card px-4 py-3 text-sm">
            <FlaskConical className="size-4 shrink-0 text-primary" aria-hidden />
            <p className="min-w-0 flex-1">
              <span className="font-semibold">{changes === 1 ? "1 demo change" : `${changes} demo changes`} saved in this browser.</span>{" "}
              <span className="text-muted-foreground">Nothing was sent and no real order changed.</span>
            </p>
            <button type="button" onClick={reset} className={cn(dashButton.secondary, "h-9 px-3.5 text-xs")}>
              <RotateCcw className="size-3.5" aria-hidden /> Reset Demo Data
            </button>
          </div>
        ) : resetDone ? (
          <p className="mt-4 flex items-center gap-2 rounded-2xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
            <RotateCcw className="size-4 shrink-0" aria-hidden />
            Demo data reset. Orders are back to the original sample data.
          </p>
        ) : null}
      </div>

      {missingId ? (
        <p role="alert" className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border bg-card px-4 py-3 text-sm">
          <PackageSearch className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          We couldn&apos;t find order <span className="font-semibold">{missingId}</span>. It may belong to another account.
          <button type="button" onClick={() => setOpenId(null)} className={cn(dashButton.ghost, "ms-auto h-9")}>
            Dismiss
          </button>
        </p>
      ) : null}

      {/* List */}
      <Panel className={cn("mt-4 overflow-hidden", e[3].className)} style={e[3].style} aria-labelledby="orders-list-title">
        <h2 id="orders-list-title" className="sr-only">
          Orders
        </h2>
        <div className="space-y-3 p-4 sm:p-5">
          <div className="flex flex-col gap-2 md:flex-row">
            <SearchBox id="orders-search" value={query} onChange={update(setQuery)} placeholder="Search by order ID, service or platform" />
            <div className="grid grid-cols-2 gap-2 md:flex md:w-auto">
              <ToolbarSelect
                id="orders-platform"
                label="Platform"
                value={platform}
                onChange={update(setPlatform)}
                className="md:w-48"
                options={[{ value: "all", label: "All platforms" }, ...ORDER_PLATFORMS.map((p) => ({ value: p.id, label: p.name }))]}
              />
              <ToolbarSelect<SortOrder>
                id="orders-sort"
                label="Sort orders"
                  value={sort}
                onChange={update(setSort)}
                className="md:w-48"
                options={[
                  { value: "priority", label: "Needs you first" },
                  { value: "newest", label: "Newest first" },
                  { value: "oldest", label: "Oldest first" },
                ]}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
            <QuickFilters<StatusFilter>
              value={quickValue}
              onChange={changeStatus}
              options={[
                { value: "all", label: "All", count: statusCount("all") },
                { value: "active", label: "In progress", count: statusCount("active") },
                { value: "attention", label: "Needs attention", count: statusCount("attention"), alert: true },
                { value: "completed", label: "Completed", count: statusCount("completed") },
                { value: "cancelled", label: "Cancelled", count: statusCount("cancelled") },
              ]}
            />
            <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground lg:justify-end">
              <p aria-live="polite">
                {visible.length} order{visible.length === 1 ? "" : "s"}
              </p>
              {filtered ? (
                <button type="button" onClick={clearFilters} className={cn(dashButton.ghost, "h-9 gap-1 text-xs")}>
                  <X className="size-3.5" aria-hidden /> Clear filters
                </button>
              ) : null}
            </div>
          </div>
          <FxNote />
        </div>

        {shown.length ? (
          <>
            <OrderList rows={shown.map(toRow)} activeId={openId} onOpen={(id) => open(id)} />
            {pageCount > 1 ? <Pagination page={current} pageCount={pageCount} total={visible.length} pageSize={PAGE_SIZE} label="Order pages" onPage={setPage} /> : null}
          </>
        ) : status === "attention" && !query.trim() && platform === "all" ? (
          <OrdersMessage icon={CircleCheck} tone="ok" title="Nothing needs your attention">
            Every order is moving along. We&apos;ll let you know if anything needs a quick fix.
          </OrdersMessage>
        ) : (
          <OrdersMessage
            title={filtered ? "No orders match your filters" : "No orders yet"}
            actions={
              <>
                {filtered ? (
                  <button type="button" onClick={clearFilters} className={dashButton.secondary}>
                    Clear filters
                  </button>
                ) : null}
                <Link href={newOrderHref()} className={dashButton.primary}>
                  <Plus className="size-4" aria-hidden /> New Order
                </Link>
              </>
            }
          >
            {filtered ? "Try a different search, status or platform." : "When you place an order, you'll be able to track it here."}
          </OrdersMessage>
        )}
      </Panel>

      <OrderDetails order={openOrder} startWithAction={actionFor === openId} onClose={close} />
    </div>
  );
}
