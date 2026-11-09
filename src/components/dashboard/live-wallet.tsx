"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, CalendarRange, CircleAlert, Clock, Download, Plus, ReceiptText, Wallet, X } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { usd } from "@/lib/demo-account";
import { formatDateTime, useDisplay } from "@/lib/i18n";
import { api } from "@/lib/live-account";
import { cn } from "@/lib/utils";
import { useLiveAccount } from "./live-account";
import { DepositRequests } from "./live-views";
import {
  CloseButton,
  CopyIdButton,
  DetailList,
  OrdersMessage,
  OrdersSkeleton,
  PanelActions,
  panelSecondary,
  QuickFilters,
  RetryButton,
  SearchBox,
  SectionTitle,
  ToolbarSelect,
} from "./orders-ui";
import { splitAmount, WalletCard } from "./overview-parts";
import { dashButton, enter, ordersHref, Pagination, Panel, ROUTES, supportHref } from "./shared";

/*
 * Live wallet (DEMO_MODE off). Every figure comes from the server: the balance
 * from the ledger summary, totals and entries from the customer's own wallet
 * history. Nothing is added up in the browser and nothing here can move money.
 */

interface Entry {
  id: string;
  at: string;
  label: string;
  kind: string;
  amountCents: number;
  orderRef: string | null;
}

interface EntriesPage {
  items: Entry[];
  total: number;
  pages: number;
  totals: { inCents: number; outCents: number };
}

const PAGE_SIZE = 15;
const cents = (n: number) => usd(n / 100);
const signed = (n: number) => `${n > 0 ? "+" : "−"}${cents(Math.abs(n))}`;
const shortRef = (id: string) => id.slice(0, 8).toUpperCase();

const KINDS: { value: string; label: string; explain: string }[] = [
  { value: "deposit_credit", label: "Deposit", explain: "Money added to your balance after a deposit was verified." },
  { value: "order_debit", label: "Order payment", explain: "Taken from your balance when you placed an order." },
  { value: "order_cancel", label: "Order cancelled — returned", explain: "The full order amount returned to your balance after the order was cancelled or couldn't start." },
  { value: "refund", label: "Refund", explain: "Money returned to your balance after a refund was approved." },
  { value: "reward_credit", label: "Referral reward", explain: "A referral reward added to your balance." },
  { value: "adjustment", label: "Adjustment", explain: "A correction to your balance recorded by our team." },
  { value: "reversal", label: "Correction", explain: "Reverses an earlier entry that was recorded in error." },
];
const KIND_BY_VALUE = Object.fromEntries(KINDS.map((k) => [k.value, k]));

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const FILTER_KEYS = ["kind", "direction", "from", "to", "q", "sort"] as const;

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

/** Builds a CSV of the filtered history from the API, a page at a time. */
async function exportCsv(filters: URLSearchParams) {
  const rows: Entry[] = [];
  for (let page = 1; page <= 200; page++) {
    const qs = new URLSearchParams(filters);
    qs.set("page", String(page));
    qs.set("pageSize", "50");
    const res = await api<EntriesPage>(`/api/account/wallet/transactions?${qs}`);
    rows.push(...res.items);
    if (page >= res.pages) break;
  }
  const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = [
    ["Date (UTC)", "Type", "Direction", "Amount (USD)", "Reference", "Order"].join(","),
    ...rows.map((r) => [r.at, r.label, r.amountCents > 0 ? "In" : "Out", (r.amountCents / 100).toFixed(2), r.id, r.orderRef ?? ""].map(cell).join(",")),
  ];
  const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: `sociotix-wallet-${new Date().toISOString().slice(0, 10)}.csv` });
  a.click();
  URL.revokeObjectURL(url);
  return rows.length;
}

export function LiveWallet() {
  useDisplay();
  const live = useLiveAccount()!;
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const kind = KIND_BY_VALUE[params.get("kind") ?? ""] ? params.get("kind")! : "";
  const direction = params.get("direction") === "in" || params.get("direction") === "out" ? params.get("direction")! : "";
  const from = DAY.test(params.get("from") ?? "") ? params.get("from")! : "";
  const to = DAY.test(params.get("to") ?? "") ? params.get("to")! : "";
  const sort = params.get("sort") === "oldest" ? "oldest" : "newest";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const openId = params.get("tx");
  const query = params.get("q") ?? "";
  const [q, setQ] = React.useState(query);
  const [exporting, setExporting] = React.useState<"idle" | "busy" | "failed" | number>("idle");

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
  const setView = (patch: Record<string, string | null>) => router.replace(href({ page: null, ...patch }), { scroll: false });

  React.useEffect(() => {
    const next = q.trim();
    if (next === query) return;
    const t = window.setTimeout(() => router.replace(href({ q: next || null, page: null }), { scroll: false }), 250);
    return () => window.clearTimeout(t);
  }, [q, query, href, router]);

  const filters = new URLSearchParams();
  if (kind) filters.set("kind", kind);
  if (direction) filters.set("direction", direction);
  if (from) filters.set("from", from);
  if (to) filters.set("to", to);
  if (query) filters.set("q", query);
  if (sort === "oldest") filters.set("sort", "oldest");
  const listQs = new URLSearchParams(filters);
  listQs.set("page", String(page));
  listQs.set("pageSize", String(PAGE_SIZE));
  const list = useJson<EntriesPage>(`/api/account/wallet/transactions?${listQs}`);
  // All-time totals for the overview, independent of the filters below.
  const overall = useJson<EntriesPage>("/api/account/wallet/transactions?page=1&pageSize=1");
  const filtered = FILTER_KEYS.some((k) => params.get(k));
  const dateError = from && to && from > to ? "The start date is after the end date." : null;
  const open = list.data?.items.find((t) => t.id === openId) ?? null;
  const { whole, rest } = splitAmount(cents(live.wallet.availableCents));
  const e = [0, 1, 2, 3].map(enter);

  const runExport = async () => {
    setExporting("busy");
    try {
      setExporting(await exportCsv(filters));
    } catch {
      setExporting("failed");
    }
  };

  return (
    <div className="mx-auto max-w-[90rem] px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
      <header className={cn("flex flex-wrap items-end justify-between gap-x-6 gap-y-3", e[0].className)} style={e[0].style}>
        <div className="min-w-0">
          <h1 className="font-heading text-[1.6rem] leading-tight font-extrabold tracking-tight sm:text-[1.9rem]">Wallet &amp; transactions</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground sm:text-[0.95rem]">Your balance, every entry that changed it and your deposit requests.</p>
        </div>
      </header>

      <div className={cn("mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]", e[1].className)} style={e[1].style}>
        <WalletCard
          whole={whole}
          rest={rest}
          stats={[
            { label: "Pending deposits", value: cents(live.wallet.pendingCents) },
            { label: "Ledger entries", value: overall.data ? String(overall.data.total) : "—" },
          ]}
          note="Your balance comes straight from the ledger. Pending deposits aren't spendable until they're verified."
          actions={
            <>
              <Link
                href={ROUTES["add-funds"]}
                className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full bg-lime text-sm font-semibold text-graphite transition-transform hover:-translate-y-px focus-visible:ring-3 focus-visible:ring-lime/50 focus-visible:outline-none motion-reduce:hover:translate-y-0"
              >
                <Plus className="size-4" strokeWidth={2.6} aria-hidden /> Add Funds
              </Link>
              <a
                href="#deposit-requests"
                className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full bg-white/10 text-sm font-semibold text-white transition-colors hover:bg-white/15 focus-visible:ring-3 focus-visible:ring-white/30 focus-visible:outline-none"
              >
                <Clock className="size-4" aria-hidden /> Deposits
              </a>
            </>
          }
        />

        <Panel className="flex flex-col p-4 sm:p-5" aria-labelledby="overview-title">
          <SectionTitle id="overview-title" aside="All time · from your ledger">
            Overview
          </SectionTitle>
          {overall.error ? (
            <div className="mt-3 flex flex-1 flex-col items-start justify-center gap-2 text-sm">
              <p className="flex items-center gap-2 text-muted-foreground">
                <CircleAlert className="size-4 text-destructive" aria-hidden /> {overall.error}
              </p>
              <RetryButton onClick={overall.retry} />
            </div>
          ) : (
            <div className="my-auto grid grid-cols-3 gap-2 py-3">
              {[
                { label: "Money in", value: overall.data ? cents(overall.data.totals.inCents) : null, Icon: ArrowDownLeft, tone: "bg-ok-soft text-ok" },
                { label: "Money out", value: overall.data ? cents(overall.data.totals.outCents) : null, Icon: ArrowUpRight, tone: "bg-muted text-foreground/75" },
                { label: "Entries", value: overall.data ? String(overall.data.total) : null, Icon: ReceiptText, tone: "bg-secondary text-secondary-foreground" },
              ].map((s) => (
                <div key={s.label} className="flex min-w-0 items-center gap-3 rounded-xl border bg-muted/20 p-2.5 sm:p-3">
                  <span className={cn("hidden size-9 shrink-0 place-items-center rounded-xl sm:grid", s.tone)} aria-hidden>
                    <s.Icon className="size-4" />
                  </span>
                  <dl className="min-w-0">
                    <dt className="text-xs text-muted-foreground">{s.label}</dt>
                    <dd className="truncate font-heading text-base leading-tight font-extrabold tabular-nums sm:text-lg">
                      {s.value ?? <span className="inline-block h-5 w-16 animate-pulse rounded bg-muted align-middle motion-reduce:animate-none" aria-label="Loading" />}
                    </dd>
                  </dl>
                </div>
              ))}
            </div>
          )}
          <p className="border-t pt-3 text-xs leading-relaxed text-muted-foreground">
            Your balance is used to pay for orders. Cancelled orders return the full amount here. Deposits, withdrawals and refunds aren&apos;t open yet.
          </p>
        </Panel>
      </div>

      <Panel className={cn("mt-4 overflow-hidden", e[2].className)} style={e[2].style} aria-busy={list.loading || undefined} aria-labelledby="history-title">
        <div className="space-y-3 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="history-title" className="font-heading text-[1.05rem] font-bold tracking-tight">
              Transaction history
            </h2>
            <button type="button" onClick={runExport} disabled={exporting === "busy" || !list.data?.total} className={cn(dashButton.secondary, "h-10 px-3.5 disabled:opacity-50")}>
              <Download className="size-4" aria-hidden /> {exporting === "busy" ? "Exporting…" : "Export CSV"}
            </button>
          </div>
          <p className="sr-only" aria-live="polite">
            {typeof exporting === "number" ? `Exported ${exporting} entries.` : exporting === "failed" ? "The export didn't finish. Try again." : ""}
          </p>
          {exporting === "failed" ? <p className="text-xs text-destructive">The export didn&apos;t finish. Try again.</p> : null}

          <div className="grid grid-cols-2 gap-2 md:grid-cols-[minmax(0,1fr)_12rem_10rem] [&>:first-child]:col-span-2 md:[&>:first-child]:col-span-1">
            <SearchBox id="wallet-search" value={q} onChange={setQ} placeholder="Search by type, reference or order ID" />
            <ToolbarSelect
              id="wallet-kind"
              label="Transaction type"
              value={kind}
              onChange={(v) => setView({ kind: v || null })}
              options={[{ value: "", label: "All types" }, ...KINDS.map((k) => ({ value: k.value, label: k.label }))]}
            />
            <ToolbarSelect
              id="wallet-sort"
              label="Sort transactions"
              value={sort}
              onChange={(v) => setView({ sort: v === "oldest" ? v : null })}
              options={[
                { value: "newest", label: "Newest first" },
                { value: "oldest", label: "Oldest first" },
              ]}
            />
          </div>

          <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
            <QuickFilters
              value={direction}
              onChange={(v) => setView({ direction: v || null })}
              options={[
                { value: "", label: "All" },
                { value: "in", label: "Money in" },
                { value: "out", label: "Money out" },
              ]}
            />
            <fieldset className="grid grid-cols-2 items-center gap-2 sm:flex">
              <legend className="sr-only">Date range</legend>
              <CalendarRange className="hidden size-4 text-muted-foreground sm:block" aria-hidden />
              {(
                [
                  ["from", "From", from],
                  ["to", "To", to],
                ] as const
              ).map(([key, label, value]) => (
                <label key={key} className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  {label}
                  <input
                    type="date"
                    value={value}
                    max={key === "from" ? to || undefined : undefined}
                    min={key === "to" ? from || undefined : undefined}
                    onChange={(ev) => setView({ [key]: ev.target.value || null })}
                    aria-invalid={dateError ? true : undefined}
                    className="h-11 w-full min-w-0 rounded-xl border bg-card px-2.5 text-sm text-foreground sm:w-auto shadow-xs outline-none focus-visible:border-primary/50 focus-visible:ring-3 focus-visible:ring-primary/15 aria-invalid:border-destructive sm:h-10"
                  />
                </label>
              ))}
            </fieldset>
          </div>
          {dateError ? (
            <p role="alert" className="text-xs font-medium text-destructive">
              {dateError}
            </p>
          ) : null}

          <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <p aria-live="polite">
              {list.data
                ? `${list.data.total} entr${list.data.total === 1 ? "y" : "ies"}${filtered ? ` · ${cents(list.data.totals.inCents)} in · ${cents(list.data.totals.outCents)} out` : ""}`
                : "Loading…"}
            </p>
            {filtered ? (
              <button
                type="button"
                onClick={() => {
                  setQ("");
                  router.replace(href(Object.fromEntries([...FILTER_KEYS, "page"].map((k) => [k, null]))), { scroll: false });
                }}
                className={cn(dashButton.ghost, "h-9 gap-1 text-xs")}
              >
                <X className="size-3.5" aria-hidden /> Clear filters
              </button>
            ) : null}
          </div>
        </div>

        {list.error ? (
          <OrdersMessage role="alert" icon={CircleAlert} tone="error" title="Your transactions didn't load" actions={<RetryButton onClick={list.retry} />}>
            {list.error}
          </OrdersMessage>
        ) : !list.data ? (
          <OrdersSkeleton />
        ) : list.data.items.length === 0 ? (
          <OrdersMessage icon={Wallet} title={filtered ? "No transactions match" : "No transactions yet"}>
            {filtered
              ? "Try another type, date range or search."
              : `Verified deposits, order payments and returns appear here once they're recorded. Your balance is ${cents(live.wallet.availableCents)}.`}
          </OrdersMessage>
        ) : (
          <>
            <TxTable items={list.data.items} activeId={openId} onOpen={(id) => router.push(href({ tx: id }), { scroll: false })} />
            {list.data.pages > 1 ? (
              <Pagination
                page={Math.min(page, list.data.pages)}
                pageCount={list.data.pages}
                total={list.data.total}
                pageSize={PAGE_SIZE}
                label="Transaction pages"
                onPage={(n) => router.replace(href({ page: n > 1 ? String(n) : null }), { scroll: false })}
              />
            ) : null}
          </>
        )}
      </Panel>

      <div id="deposit-requests" className={cn("scroll-mt-20", e[3].className)} style={e[3].style}>
        <DepositRequests />
      </div>

      <TxSheet entry={open} missing={Boolean(openId && list.data && !open)} onClose={() => router.push(href({ tx: null }), { scroll: false })} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Table                                                                     */
/* -------------------------------------------------------------------------- */

const COLS = "md:grid md:grid-cols-[minmax(0,1fr)_7rem_9rem_7.5rem] md:items-center md:gap-4";

function TxIcon({ entry }: { entry: Entry }) {
  const isIn = entry.amountCents > 0;
  return (
    <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", isIn ? "bg-ok-soft text-ok" : "bg-muted text-foreground/70")} aria-hidden>
      {isIn ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
    </span>
  );
}

function TxTable({ items, activeId, onOpen }: { items: Entry[]; activeId: string | null; onOpen: (id: string) => void }) {
  return (
    <>
      <div className={cn("hidden border-y bg-muted/40 px-5 py-2.5 text-[0.68rem] font-bold tracking-wider text-muted-foreground uppercase", COLS)} aria-hidden>
        <span>Transaction</span>
        <span>Reference</span>
        <span>Date</span>
        <span className="text-end">Amount</span>
      </div>
      <ul className="divide-y border-t md:border-t-0" aria-label="Transactions">
        {items.map((t) => {
          const isIn = t.amountCents > 0;
          return (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => onOpen(t.id)}
                aria-label={`${t.label}, ${isIn ? "money in" : "money out"} ${cents(Math.abs(t.amountCents))}, ${formatDateTime(t.at)}`}
                className={cn(
                  "group flex w-full items-center gap-3 px-4 py-3 text-start transition-colors hover:bg-muted/50 focus-visible:bg-muted/60 focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none focus-visible:ring-inset sm:px-5",
                  COLS,
                  activeId === t.id && "bg-secondary/40",
                )}
              >
                <span className="flex min-w-0 flex-1 items-center gap-3">
                  <TxIcon entry={t} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{t.label}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      <span className="md:hidden">{formatDateTime(t.at)} · </span>
                      {t.orderRef ? (
                        <>
                          Order <span className="font-mono">{t.orderRef}</span>
                        </>
                      ) : isIn ? (
                        "Money in"
                      ) : (
                        "Money out"
                      )}
                    </span>
                  </span>
                  <span className={cn("shrink-0 font-heading text-[0.95rem] font-bold tabular-nums md:hidden", isIn ? "text-ok" : "text-foreground")}>{signed(t.amountCents)}</span>
                </span>
                <span className="hidden font-mono text-xs text-muted-foreground md:block">{shortRef(t.id)}</span>
                <span className="hidden text-[0.8rem] text-muted-foreground md:block">{formatDateTime(t.at)}</span>
                <span className={cn("hidden text-end font-heading text-[0.95rem] font-bold tabular-nums md:block", isIn ? "text-ok" : "text-foreground")}>{signed(t.amountCents)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  Details                                                                   */
/* -------------------------------------------------------------------------- */

function TxSheet({ entry, missing, onClose }: { entry: Entry | null; missing: boolean; onClose: () => void }) {
  // Keep the last entry rendered while the panel animates closed.
  const [shown, setShown] = React.useState(entry);
  if (entry && entry !== shown) setShown(entry);
  const t = entry ?? shown;
  const isIn = (t?.amountCents ?? 0) > 0;

  return (
    <Sheet open={Boolean(entry) || missing} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" showCloseButton={false} className="w-full gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-[30rem]">
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex items-start gap-3 border-b px-5 pt-5 pb-4">
            {t ? <TxIcon entry={t} /> : null}
            <div className="min-w-0 flex-1">
              <SheetTitle className="font-heading text-lg leading-tight font-bold">{t && !missing ? t.label : "Transaction"}</SheetTitle>
              <SheetDescription className="mt-0.5 text-sm">{t && !missing ? formatDateTime(t.at) : "Not on this page"}</SheetDescription>
            </div>
            <CloseButton onClick={onClose} label="Close transaction details" />
          </div>

          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-5 py-5">
            {missing || !t ? (
              <OrdersMessage icon={ReceiptText} title="We couldn't find this transaction">
                It may be on another page of your history, or not part of your account.
              </OrdersMessage>
            ) : (
              <>
                <div className={cn("rounded-2xl border p-4", isIn ? "border-ok/20 bg-ok-soft/50" : "bg-muted/40")}>
                  <p className="text-xs font-semibold text-muted-foreground">{isIn ? "Added to your balance" : "Taken from your balance"}</p>
                  <p className={cn("mt-1 font-heading text-3xl leading-none font-extrabold tabular-nums", isIn ? "text-ok" : "text-foreground")}>{signed(t.amountCents)}</p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{KIND_BY_VALUE[t.kind]?.explain ?? "A recorded change to your balance."}</p>
                </div>

                <section aria-labelledby="tx-details-title">
                  <SectionTitle id="tx-details-title">Details</SectionTitle>
                  <DetailList
                    rows={[
                      { label: "Type", value: t.label },
                      { label: "Direction", value: isIn ? "Money in" : "Money out" },
                      { label: "Amount", value: `${cents(Math.abs(t.amountCents))} USD` },
                      { label: "Date", value: formatDateTime(t.at) },
                      ...(t.orderRef ? [{ label: "Order", value: t.orderRef, mono: true }] : []),
                      { label: "Reference", value: t.id, mono: true },
                    ]}
                  />
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <CopyIdButton id={t.id} label="transaction reference" display={`Copy ${shortRef(t.id)}…`} />
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">Ledger entries are permanent. They can&apos;t be edited or deleted; corrections are recorded as new entries.</p>
                </section>
              </>
            )}
          </div>

          {t && !missing ? (
            <PanelActions>
              {t.orderRef ? (
                <Link href={ordersHref({ order: t.orderRef })} className={cn(panelSecondary, "col-span-2")}>
                  View order <ArrowUpRight className="size-4" aria-hidden />
                </Link>
              ) : null}
              <Link href={supportHref({ new: true, tx: t.id })} className={cn(panelSecondary, "col-span-2")}>
                Ask about this transaction
              </Link>
            </PanelActions>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
