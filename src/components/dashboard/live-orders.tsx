"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Ban, CircleAlert, CircleCheck, Clock3, Compass, LifeBuoy, PackageOpen, PackageSearch, RefreshCw, Repeat, TriangleAlert, X } from "lucide-react";
import { ExplainOrderAction } from "@/components/ai/order-explanation";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { CATEGORY_META, PLATFORM_BY_ID, SERVICE_BY_ID, type ServiceCategory } from "@/lib/catalog";
import { usd } from "@/lib/demo-account";
import { formatDate, formatDateTime, useDisplay } from "@/lib/i18n";
import { api, ApiError } from "@/lib/live-account";
import { type CustomerOrder, ORDER_STATUS_META, type OrderStatus, type OrderTone, PAYMENT_STATUS_META } from "@/lib/orders";
import { cn } from "@/lib/utils";
import { useLiveAccount } from "./live-account";
import {
  CloseButton,
  CopyIdButton,
  DetailList,
  Lifecycle,
  OrderList,
  OrdersHeader,
  OrdersMessage,
  type OrderRowView,
  OrdersSkeleton,
  PanelActions,
  PanelHead,
  panelPrimary,
  panelSecondary,
  QuickFilters,
  RetryButton,
  SearchBox,
  SectionTitle,
  StatusOverview,
  type StepState,
  Timeline,
  ToolbarSelect,
} from "./orders-ui";
import { dashButton, enter, FINDER_ROUTE, newOrderHref, Pagination, Panel, supportHref } from "./shared";

/*
 * Live My Orders (DEMO_MODE off): the customer's own orders only, with
 * recorded activity — no sample orders, no invented progress. Filters, search,
 * sort, page and the open order live in the URL so links, Back and Forward work.
 */

const PAGE_SIZE = 10;
const cents = (n: number) => usd(n / 100);
const TONE: Record<OrderTone, string> = {
  pending: "bg-soon-soft text-soon",
  active: "bg-secondary text-secondary-foreground",
  attention: "bg-destructive/10 text-destructive",
  ok: "bg-lime/25 text-graphite dark:text-lime",
  closed: "bg-muted text-muted-foreground",
  bad: "bg-destructive/10 text-destructive",
};
const TONE_ICON: Record<OrderTone, typeof Clock3> = { pending: Clock3, active: RefreshCw, attention: TriangleAlert, ok: CircleCheck, closed: Ban, bad: CircleAlert };

export function OrderBadge({ status, staff = false }: { status: OrderStatus; staff?: boolean }) {
  const m = ORDER_STATUS_META[status];
  const Icon = TONE_ICON[m.tone];
  return (
    <span className={cn("inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[0.72rem] font-semibold whitespace-nowrap ring-1 ring-current/15 ring-inset", TONE[m.tone])}>
      <Icon className="size-3" strokeWidth={2.5} aria-hidden />
      {staff ? m.label : m.customerLabel}
    </span>
  );
}

interface Page {
  items: CustomerOrder[];
  total: number;
  pages: number;
}

type Filter = "" | "open" | "attention" | "completed" | "closed";
const FILTERS = new Set<string>(["", "open", "attention", "completed", "closed"]);
const parseFilter = (v: string | null): Filter => (v && FILTERS.has(v) ? (v as Filter) : "");

function useJson<T>(url: string | null) {
  const [attempt, setAttempt] = React.useState(0);
  const key = url ? `${url}#${attempt}` : null;
  const [state, setState] = React.useState<{ key?: string; data?: T; error?: string }>({});
  React.useEffect(() => {
    if (!url || !key) return;
    let cancelled = false;
    api<T>(url).then(
      (data) => !cancelled && setState({ key, data }),
      (e: Error) => !cancelled && setState({ key, error: e.message }),
    );
    return () => {
      cancelled = true;
    };
  }, [url, key]);
  const loading = Boolean(key) && state.key !== key;
  return { data: state.data, error: loading ? undefined : state.error, loading, retry: () => setAttempt((n) => n + 1) };
}

/** How many of the customer's orders fall under a filter: one tiny request each, using the list's own total. */
function useCount(filter: Filter, version: number) {
  const qs = new URLSearchParams({ page: "1", pageSize: "1", v: String(version) });
  if (filter) qs.set("status", filter);
  const { data, error } = useJson<Page>(`/api/account/orders?${qs}`);
  return error ? null : data ? data.total : null;
}

const platformOf = (o: CustomerOrder) => PLATFORM_BY_ID[SERVICE_BY_ID[o.service.id]?.platformId ?? ""] ?? null;
const categoryOf = (o: CustomerOrder) => CATEGORY_META[o.service.category as ServiceCategory]?.label ?? null;

function noteOf(o: CustomerOrder): OrderRowView["note"] {
  if (o.status === "needs_customer_action") return { text: o.statusReason ?? "Action needed", tone: "attention" };
  if (o.status === "completed" && o.completedAt) return { text: `Completed ${formatDate(o.completedAt)}`, tone: "muted" };
  if (o.statusReason && ["cancelled", "failed", "rejected", "refunded"].includes(o.status)) return { text: o.statusReason, tone: "muted" };
  return null;
}

function toRow(o: CustomerOrder): OrderRowView {
  const m = ORDER_STATUS_META[o.status];
  const flagged = o.status === "needs_customer_action";
  return {
    id: o.reference,
    service: o.service.name,
    platform: platformOf(o),
    platformName: o.service.platform,
    date: formatDate(o.placedAt),
    amount: cents(o.totalCents),
    quantity: o.quantity.toLocaleString("en-US"),
    status: <OrderBadge status={o.status} />,
    // Live orders carry no delivered count, so no percentage is shown.
    progress: null,
    note: noteOf(o),
    flagged,
    dim: m.tone === "closed",
    label: `Order ${o.reference}: ${o.service.name}, ${m.customerLabel}${flagged ? ". Action needed" : ""}`,
  };
}

export function LiveOrders() {
  useDisplay();
  const live = useLiveAccount()!;
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const status = parseFilter(params.get("status"));
  const sort = params.get("sort") === "oldest" ? "oldest" : "newest";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const openRef = params.get("order");
  const [q, setQ] = React.useState(params.get("q") ?? "");
  const [version, setVersion] = React.useState(0);

  const href = React.useCallback(
    (patch: Record<string, string | null>) => {
      const u = new URLSearchParams(window.location.search);
      for (const [k, v] of Object.entries(patch)) {
        if (v) u.set(k, v);
        else u.delete(k);
      }
      const s = u.toString();
      return s ? `${pathname}?${s}` : pathname;
    },
    [pathname],
  );
  /** Changes to what's listed replace the URL (and go back to page 1); opening an order adds a history entry. */
  const setView = (patch: Record<string, string | null>) => router.replace(href({ page: null, ...patch }), { scroll: false });

  // Search is sent once typing pauses.
  const query = params.get("q") ?? "";
  React.useEffect(() => {
    const next = q.trim();
    if (next === query) return;
    const t = window.setTimeout(() => router.replace(href({ q: next || null, page: null }), { scroll: false }), 250);
    return () => window.clearTimeout(t);
  }, [q, query, href, router]);

  const lp = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE), v: String(version) });
  if (status) lp.set("status", status);
  if (query) lp.set("q", query);
  if (sort === "oldest") lp.set("sort", "oldest");
  const list = useJson<Page>(`/api/account/orders?${lp}`);
  const counts = { "": useCount("", version), open: useCount("open", version), attention: useCount("attention", version), completed: useCount("completed", version), closed: useCount("closed", version) };
  const filtered = Boolean(status || query || sort !== "newest");
  const e = [0, 1, 2].map(enter);

  return (
    <div className="mx-auto max-w-[90rem] px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
      <div className={e[0].className} style={e[0].style}>
        <OrdersHeader description="Every order, its status and what has actually happened so far." />
      </div>

      <div className={cn("mt-5", e[1].className)} style={e[1].style}>
        <StatusOverview<Filter>
          value={status}
          onSelect={(id) => setView({ status: status === id && id ? null : id || null })}
          items={[
            { id: "", label: "All orders", value: counts[""], hint: "All time", Icon: PackageSearch, tone: "neutral" },
            { id: "open", label: "Open", value: counts.open, hint: "Under review or in delivery", Icon: RefreshCw, tone: "violet" },
            { id: "attention", label: "Needs attention", value: counts.attention, hint: counts.attention ? "Waiting on you" : "All clear", Icon: TriangleAlert, tone: "amber" },
            { id: "completed", label: "Completed", value: counts.completed, hint: "Delivered", Icon: CircleCheck, tone: "green" },
          ]}
        />
      </div>

      <Panel className={cn("mt-4 overflow-hidden", e[2].className)} style={e[2].style} aria-busy={list.loading || undefined} aria-labelledby="orders-list-title">
        <h2 id="orders-list-title" className="sr-only">
          Orders
        </h2>
        <div className="space-y-3 p-4 sm:p-5">
          <div className="flex flex-col gap-2 md:flex-row">
            <SearchBox id="orders-search" value={q} onChange={setQ} placeholder="Search by order ID, service or link" />
            <ToolbarSelect
              id="orders-sort"
              label="Sort orders"
              value={sort}
              onChange={(v) => setView({ sort: v === "oldest" ? v : null })}
              className="md:w-48"
              options={[
                { value: "newest", label: "Newest first" },
                { value: "oldest", label: "Oldest first" },
              ]}
            />
          </div>
          <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
            <QuickFilters<Filter>
              value={status}
              onChange={(v) => setView({ status: v || null })}
              options={[
                { value: "", label: "All", count: counts[""] },
                { value: "open", label: "Open", count: counts.open },
                { value: "attention", label: "Needs attention", count: counts.attention, alert: true },
                { value: "completed", label: "Completed", count: counts.completed },
                { value: "closed", label: "Canceled & failed", count: counts.closed },
              ]}
            />
            <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground lg:justify-end">
              <p aria-live="polite">{list.data ? `${list.data.total} order${list.data.total === 1 ? "" : "s"}` : "Loading…"}</p>
              {filtered ? (
                <button
                  type="button"
                  onClick={() => {
                    setQ("");
                    router.replace(href({ status: null, q: null, sort: null, page: null }), { scroll: false });
                  }}
                  className={cn(dashButton.ghost, "h-9 gap-1 text-xs")}
                >
                  <X className="size-3.5" aria-hidden /> Clear filters
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {list.error ? (
          <OrdersMessage role="alert" icon={CircleAlert} tone="error" title="Your orders didn't load" actions={<RetryButton onClick={list.retry} />}>
            {list.error}
          </OrdersMessage>
        ) : !list.data ? (
          <OrdersSkeleton />
        ) : list.data.items.length === 0 ? (
          <OrdersMessage
            icon={PackageOpen}
            title={filtered ? "No orders match" : live.orderCount ? "No orders here" : "No orders yet"}
            actions={
              filtered ? null : (
                <Link href={FINDER_ROUTE} className={dashButton.primary}>
                  <Compass className="size-4" aria-hidden /> Browse services
                </Link>
              )
            }
          >
            {filtered ? "Try another filter or search." : "Ordering isn't open yet. When it is, every order you place appears here with its real progress."}
          </OrdersMessage>
        ) : (
          <>
            <OrderList rows={list.data.items.map(toRow)} activeId={openRef} onOpen={(ref) => router.push(href({ order: ref }), { scroll: false })} />
            {list.data.pages > 1 ? (
              <Pagination
                page={Math.min(page, list.data.pages)}
                pageCount={list.data.pages}
                total={list.data.total}
                pageSize={PAGE_SIZE}
                label="Order pages"
                onPage={(n) => router.replace(href({ page: n > 1 ? String(n) : null }), { scroll: false })}
              />
            ) : null}
          </>
        )}
      </Panel>

      <OrderSheet
        key={openRef ?? "none"}
        reference={openRef}
        onClose={() => router.push(href({ order: null }), { scroll: false })}
        onChanged={() => {
          setVersion((v) => v + 1);
          void live.refreshWallet();
        }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Order panel                                                               */
/* -------------------------------------------------------------------------- */

/** Lifecycle from the order's real status and recorded timestamps. Nothing is estimated. */
function stepsOf(o: CustomerOrder): { label: string; state: StepState; at?: string | null }[] {
  const placed = { label: "Placed", state: "done" as StepState, at: formatDate(o.placedAt) };
  const tone = ORDER_STATUS_META[o.status].tone;
  if (tone === "closed" || tone === "bad") {
    return [placed, { label: ORDER_STATUS_META[o.status].customerLabel, state: "closed", at: o.closedAt ? formatDate(o.closedAt) : null }];
  }
  // 0 placed · 1 review · 2 delivery · 3 completed
  const STAGE: Partial<Record<OrderStatus, number>> = { pending_review: 1, needs_customer_action: 1, queued: 2, in_progress: 2, partial: 2, completed: 4 };
  const current = STAGE[o.status] ?? 1;
  return [
    placed,
    { label: o.status === "needs_customer_action" ? "Needs you" : "Review", state: current > 1 ? "done" : o.status === "needs_customer_action" ? "blocked" : "current" },
    { label: "Delivery", state: current > 2 ? "done" : current === 2 ? "current" : "upcoming", at: o.startedAt ? formatDate(o.startedAt) : null },
    { label: "Completed", state: current > 3 ? "done" : "upcoming", at: o.completedAt ? formatDate(o.completedAt) : null },
  ];
}

const CALLOUT: Record<OrderTone, string> = {
  pending: "border-primary/20 bg-secondary/50",
  active: "border-primary/20 bg-secondary/50",
  attention: "border-soon/35 bg-soon-soft/60",
  ok: "border-ok/20 bg-ok-soft/60",
  closed: "bg-muted/60",
  bad: "border-destructive/25 bg-destructive/5",
};

/** What happens next, in the customer's words, for statuses that need one. */
const NEXT_STEP: Partial<Record<OrderStatus, string>> = {
  needs_customer_action: "Update the details below and the order goes back for review.",
  failed: "Your payment is held for refund review. Contact support if you have questions about this order.",
  rejected: "The full amount was returned to your balance. You can place a new order with different details.",
};

function OrderSheet({ reference, onClose, onChanged }: { reference: string | null; onClose: () => void; onChanged: () => void }) {
  const router = useRouter();
  const detail = useJson<{ order: CustomerOrder }>(reference ? `/api/account/orders/${encodeURIComponent(reference)}` : null);
  const [order, setOrder] = React.useState<CustomerOrder | null>(null);
  const o = order ?? detail.data?.order ?? null;
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<{ message: string; field?: string } | null>(null);
  const [link, setLink] = React.useState<string | null>(null);

  const run = async (path: string, body: object) => {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ order: CustomerOrder }>(`/api/account/orders/${encodeURIComponent(reference!)}/${path}`, { method: "POST", body: JSON.stringify(body) });
      setOrder(res.order);
      setLink(null);
      onChanged();
    } catch (e) {
      setError({ message: e instanceof Error ? e.message : "That didn't work.", field: e instanceof ApiError ? e.field : undefined });
    } finally {
      setBusy(false);
    }
  };

  const m = o ? ORDER_STATUS_META[o.status] : null;
  const platform = o ? platformOf(o) : null;

  return (
    <Sheet open={Boolean(reference)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" showCloseButton={false} className="w-full gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-[34rem]">
        <div className="flex h-full min-h-0 flex-col">
          <PanelHead
            platform={platform}
            title={<SheetTitle className="font-heading text-lg leading-tight font-bold">{o?.service.name ?? "Order"}</SheetTitle>}
            subtitle={
              <SheetDescription className="mt-0.5 text-sm">
                {o ? [o.service.platform, categoryOf(o)].filter(Boolean).join(" · ") : detail.error ? "Unavailable" : "Loading…"}
              </SheetDescription>
            }
            actions={<CloseButton onClick={onClose} />}
            badges={
              reference ? (
                <>
                  {o ? <OrderBadge status={o.status} /> : null}
                  <CopyIdButton id={reference} />
                  {o ? <span className="text-xs text-muted-foreground">Placed {formatDateTime(o.placedAt)}</span> : null}
                </>
              ) : null
            }
          />

          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-5 py-5" aria-busy={detail.loading || undefined}>
            {detail.error ? (
              <OrdersMessage role="alert" icon={PackageSearch} title="We couldn't open this order" actions={<RetryButton onClick={detail.retry} />}>
                {detail.error}
              </OrdersMessage>
            ) : !o || !m ? (
              <div className="space-y-3" aria-label="Loading order">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-20 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />
                ))}
              </div>
            ) : (
              <>
                <section className={cn("rounded-2xl border p-4", CALLOUT[m.tone])} aria-labelledby="status-title">
                  {m.tone === "attention" ? (
                    <p className="mb-1 flex items-center gap-1.5 text-[0.7rem] font-bold tracking-wider text-soon uppercase">
                      <TriangleAlert className="size-3.5" aria-hidden /> Action needed
                    </p>
                  ) : null}
                  <h3 id="status-title" className="font-heading text-base font-bold">
                    {m.customerLabel}
                  </h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">{m.customerExplain}</p>
                  {o.statusReason ? <p className="mt-2.5 rounded-xl bg-card/80 px-3 py-2 text-sm">{o.statusReason}</p> : null}
                  {NEXT_STEP[o.status] ? <p className="mt-2.5 text-sm font-medium">{NEXT_STEP[o.status]}</p> : null}
                  {o.canUpdateDetails ? (
                    <form
                      className="mt-3 space-y-2 rounded-xl border bg-card p-3"
                      onSubmit={(ev) => {
                        ev.preventDefault();
                        void run("details", { link: (link ?? o.link ?? "").trim(), details: o.details });
                      }}
                    >
                      <label className="block text-sm font-semibold" htmlFor="live-fix-link">
                        Target link
                      </label>
                      <input
                        id="live-fix-link"
                        value={link ?? o.link ?? ""}
                        onChange={(ev) => setLink(ev.target.value)}
                        maxLength={500}
                        inputMode="url"
                        autoCapitalize="none"
                        spellCheck={false}
                        aria-invalid={error?.field === "link" || undefined}
                        className="h-11 w-full rounded-xl border bg-card px-3 text-sm outline-none focus-visible:border-primary/50 focus-visible:ring-3 focus-visible:ring-primary/15 aria-invalid:border-destructive"
                      />
                      <button type="submit" disabled={busy} className={cn(dashButton.primary, "disabled:opacity-60")}>
                        {busy ? "Sending…" : "Send updated details"}
                      </button>
                    </form>
                  ) : null}
                  {o.canCancel ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => run("cancel", {})}
                      className="mt-3 inline-flex h-10 items-center gap-2 rounded-full border border-destructive/40 bg-card px-4 text-sm font-semibold text-destructive hover:bg-destructive/5 focus-visible:ring-3 focus-visible:ring-destructive/25 focus-visible:outline-none disabled:opacity-60"
                    >
                      {busy ? "Canceling…" : `Cancel and return ${cents(o.totalCents)}`}
                    </button>
                  ) : null}
                </section>

                {error ? (
                  <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-sm">
                    {error.message}
                  </p>
                ) : null}

                <section aria-labelledby="progress-title">
                  <SectionTitle id="progress-title">Progress</SectionTitle>
                  <div className="mt-3">
                    <Lifecycle steps={stepsOf(o)} />
                  </div>
                </section>

                {/* AI-05: a plain-language explanation from this order's record (read-only, runs only when asked). */}
                <ExplainOrderAction order={o} />

                <section aria-labelledby="details-title">
                  <SectionTitle id="details-title">Order details</SectionTitle>
                  <DetailList
                    rows={[
                      { label: "Order ID", value: o.reference, mono: true },
                      { label: "Target link", value: o.link ?? "—", mono: Boolean(o.link) },
                      { label: "Quantity", value: o.quantity.toLocaleString("en-US") },
                      ...Object.entries(o.details).map(([k, v]) => ({ label: k[0].toUpperCase() + k.slice(1), value: v })),
                      { label: "Total", value: `${cents(o.totalCents)} USD` },
                      { label: "Payment", value: PAYMENT_STATUS_META[o.paymentStatus].label },
                      ...(o.startedAt ? [{ label: "Started", value: formatDateTime(o.startedAt) }] : []),
                      ...(o.completedAt ? [{ label: "Completed", value: formatDateTime(o.completedAt) }] : []),
                      ...(o.closedAt && !o.completedAt ? [{ label: "Closed", value: formatDateTime(o.closedAt) }] : []),
                    ]}
                  />
                  <p className="mt-2 text-xs text-muted-foreground">{PAYMENT_STATUS_META[o.paymentStatus].explain}</p>
                </section>

                <section aria-labelledby="activity-title">
                  <SectionTitle id="activity-title" aside="Newest first">
                    Activity
                  </SectionTitle>
                  <Timeline
                    format={formatDateTime}
                    events={[...o.events].reverse().map((ev) => ({ at: ev.at, title: ev.label, detail: ev.detail, tone: ev.label === "Completed" ? "done" : undefined }))}
                  />
                </section>
              </>
            )}
          </div>

          {o ? (
            <PanelActions>
              {/* Reorder opens New Order with this service and quantity; the link is entered again there. */}
              <Link href={`${newOrderHref(o.service.id)}&quantity=${o.quantity}`} className={panelPrimary}>
                <Repeat className="size-4" aria-hidden /> Reorder
              </Link>
              <button type="button" onClick={() => router.push(supportHref({ new: true, order: o.reference }))} className={cn(panelSecondary, "col-span-2")}>
                <LifeBuoy className="size-4" aria-hidden /> Contact Support
              </button>
            </PanelActions>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
