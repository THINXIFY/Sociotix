"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleAlert,
  CircleCheck,
  Clock3,
  Compass,
  Heart,
  History,
  Lock,
  Pencil,
  Repeat,
  Search,
  SearchX,
  ShieldCheck,
  TriangleAlert,
  X,
} from "lucide-react";
import { PlatformIcon, PlatformTile } from "@/components/brand";
import { TourHelpButton } from "@/components/tour/guided-tour";
import { CATEGORY_ICONS } from "@/components/site/primitives";
import {
  CATALOG_TOTALS,
  CATEGORY_DELIVERY,
  CATEGORY_FIELDS,
  CATEGORY_META,
  CATEGORY_ORDER,
  isQuantityBased,
  matchesQuery,
  type OrderField,
  type Platform,
  PLATFORM_BY_ID,
  PLATFORMS,
  requirementsOf,
  type Service,
  SERVICE_BY_ID,
  SERVICES,
  type ServiceCategory,
} from "@/lib/catalog";
import { count, DEMO_WALLET, money, usd } from "@/lib/demo-account";
import { formatPrice as formatCatalogPrice, useDisplay } from "@/lib/i18n";
import { isForeignHost, parseLink } from "@/lib/links";
import { cn } from "@/lib/utils";
import {
  clearReorderDraft,
  type LocalOrder,
  readReorderDraft,
  saveReorderDraft,
  useDemoOrders,
  useFavorites,
} from "./demo-store";
import { useLiveAccount } from "./live-account";
import { FavoriteButton } from "./favorite-button";
import { FINDER_QUERY_KEY } from "./finder-key";
import { FxNote } from "./region";
import { dashButton, DemoTag, FINDER_ROUTE, ordersHref, Panel, ROUTES, useHydrated } from "./shared";
import { Select } from "@/components/ui/select";

/* -------------------------------------------------------------------------- */
/*  Steps, validation & pricing                                               */
/* -------------------------------------------------------------------------- */

const STEPS = ["Platform", "Service", "Configure", "Review"] as const;
type Step = 0 | 1 | 2 | 3;
type Values = Record<string, string>;

const PASSWORD_HINT = /\b(password|passcode|pwd|login code|2fa code)\b/i;

const parseNumber = (value: string) => Number(value.replace(/[,\s]/g, ""));

function fieldError(field: OrderField, raw: string | undefined, service: Service): string | null {
  const value = (raw ?? "").trim();
  if (!value) {
    if (!field.required) return null;
    if (field.kind === "consent") return "Please confirm to continue.";
    if (field.kind === "select") return `Choose a ${field.label.toLowerCase()}.`;
    return `${field.label} is required.`;
  }
  switch (field.kind) {
    case "link":
      return parseLink(value) ? null : "Enter a full link, like https://…";
    case "quantity": {
      const n = parseNumber(value);
      if (!/^[\d,\s]+$/.test(value) || !Number.isInteger(n) || n <= 0) return "Enter a whole number above zero.";
      const limits = service.limits;
      if (limits && n < limits.min) return `The minimum for this service is ${count(limits.min)}.`;
      if (limits && n > limits.max) return `The maximum for this service is ${count(limits.max)}.`;
      return null;
    }
    case "budget": {
      const n = parseNumber(value);
      if (!/^\d[\d,]*(\.\d{1,2})?$/.test(value) || !(n > 0)) return "Enter an amount above zero, like 250 or 250.00.";
      return null;
    }
    case "text":
    case "textarea":
      return value.length < 3 ? "Add a little more detail." : null;
    default:
      return null;
  }
}

function fieldWarning(field: OrderField, raw: string | undefined, platform: Platform): string | null {
  const value = (raw ?? "").trim();
  if (!value) return null;
  if (PASSWORD_HINT.test(value)) return "Never share passwords or login codes. Sociotix will never ask for them.";
  if (field.kind === "link") {
    const url = parseLink(value);
    if (url && isForeignHost(url, platform.id)) {
      return `This doesn't look like a ${platform.name} link. Double-check it before you continue.`;
    }
  }
  return null;
}

const formErrors = (service: Service, values: Values) =>
  Object.fromEntries(
    CATEGORY_FIELDS[service.category]
      .map((f) => [f.id, fieldError(f, values[f.id], service)] as const)
      .filter(([, e]) => e),
  ) as Record<string, string>;

/** Catalog prices are in USD, so they follow the display currency like every other amount. */
const formatPrice = (amount: number, currency: string) => (currency === "USD" ? money(amount) : formatCatalogPrice(amount, currency));

/** Only computes totals when a real pricing rule exists. Never estimates. */
function pricing(service: Service | null, values: Values) {
  if (!service?.price) return null;
  const { amount, currency, unit } = service.price;
  const qty = parseNumber(values.quantity ?? "");
  const total =
    isQuantityBased(service.category) && unit === "per 1,000" && Number.isInteger(qty) && qty > 0
      ? (amount * qty) / 1000
      : null;
  return { unit: `${formatPrice(amount, currency)} ${unit}`, total: total === null ? null : formatPrice(total, currency) };
}

function displayValue(field: OrderField, raw: string | undefined) {
  const value = (raw ?? "").trim();
  if (!value) return null;
  if (field.kind === "quantity") return count(parseNumber(value));
  if (field.kind === "budget") return money(parseNumber(value));
  if (field.kind === "consent") return "Confirmed";
  return value;
}

/* -------------------------------------------------------------------------- */
/*  Flow                                                                      */
/* -------------------------------------------------------------------------- */

/** A reorder in progress: where it came from and anything the customer needs to fix. */
interface ReorderInfo {
  orderId: string;
  /** Null when the order can't be found. */
  order: LocalOrder | null;
  notice: string | null;
  /** Whether choosing a service or completing the details clears the notice. */
  resolvedBy: "service" | "details";
  /** True when details were copied (or restored) for the original service. */
  copied: boolean;
  restored: boolean;
}

interface InitialState {
  step: Step;
  platformId: string | null;
  serviceId: string | null;
  values: Values;
  touched: Record<string, boolean>;
  reorder: ReorderInfo | null;
  /** Opened from a Smart Order Assistant draft (AI-05): service and quantity pre-filled, nothing else. */
  aiDraft: boolean;
}

type BrowseView = "browse" | "favorites";

const BLANK: InitialState = { step: 0, platformId: null, serviceId: null, values: {}, touched: {}, reorder: null, aiDraft: false };

/** Values copied from a previous order: only the target and amount, never free-text notes. */
function copiedValues(order: LocalOrder, service: Service): Values {
  const values: Values = {};
  for (const f of CATEGORY_FIELDS[service.category]) {
    if (f.kind === "link") values[f.id] = order.link;
    if (f.kind === "quantity") values[f.id] = String(order.quantity);
  }
  return values;
}

const listOf = (labels: string[]) =>
  labels.length < 2 ? labels.join("") : `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;

/** Prepares an editable draft from a previous order, checked against the service's current requirements. */
function reorderState(orderId: string, orders: LocalOrder[]): InitialState {
  const order = orders.find((o) => o.id === orderId) ?? null;
  if (!order) {
    return {
      ...BLANK,
      reorder: { orderId, order: null, restored: false, copied: false, resolvedBy: "service", notice: `We couldn't find order ${orderId}. Choose a service to start a new order.` },
    };
  }
  const draft = readReorderDraft(order.id);
  const service = SERVICE_BY_ID[draft?.serviceId ?? order.serviceId];
  if (!service) {
    return {
      ...BLANK,
      reorder: {
        orderId,
        order,
        restored: false,
        copied: false,
        resolvedBy: "service",
        notice: "The service from this order is no longer available. Choose a service to continue.",
      },
    };
  }

  const fields = CATEGORY_FIELDS[service.category];
  const values = draft ? { ...draft.values } : copiedValues(order, service);
  const errors = formErrors(service, values);
  const invalid = Object.keys(values).filter((id) => errors[id]);
  const missing = fields.filter((f) => errors[f.id] && !values[f.id] && f.kind !== "consent");

  let notice: string | null = null;
  if (!fields.some((f) => f.kind === "quantity") && !draft) {
    notice = "This service no longer uses a quantity. Add the details it needs now.";
  } else if (invalid.length) {
    notice = "Some copied details don't meet this service's current requirements. Update the highlighted fields.";
  } else if (missing.length) {
    notice = `Add ${listOf(missing.map((f) => f.label.toLowerCase()))} to continue. Written details aren't copied from previous orders.`;
  }

  return {
    ...BLANK,
    step: Object.keys(errors).length ? 2 : 3,
    platformId: service.platformId,
    serviceId: service.id,
    values,
    // Show problems with copied values straight away.
    touched: Object.fromEntries(Object.keys(values).map((id) => [id, true])),
    reorder: { orderId, order, notice, restored: Boolean(draft), copied: true, resolvedBy: "details" },
  };
}

function initialState(params: URLSearchParams, orders: LocalOrder[]): InitialState {
  const reorder = params.get("reorder");
  if (reorder) return reorderState(reorder, orders);
  const service = SERVICE_BY_ID[params.get("service") ?? ""];
  if (service) {
    // A Smart Order Assistant draft carries a quantity; it lands on Configure, where the wizard's own checks apply.
    const values: Values = {};
    const quantity = params.get("quantity");
    const field = CATEGORY_FIELDS[service.category].find((f) => f.kind === "quantity");
    if (field && quantity && /^\d{1,9}$/.test(quantity)) values[field.id] = quantity;
    return { ...BLANK, step: 2, platformId: service.platformId, serviceId: service.id, values, touched: Object.fromEntries(Object.keys(values).map((id) => [id, true])), aiDraft: params.get("from") === "ai" };
  }
  const platform = PLATFORM_BY_ID[params.get("platform") ?? ""];
  if (platform) return { ...BLANK, step: 1, platformId: platform.id };
  return BLANK;
}

/** The real balance in live mode (USD, from the ledger); the demo balance otherwise. */
function WalletBalance() {
  const live = useLiveAccount();
  return <>{live ? usd(live.wallet.availableCents / 100) : money(DEMO_WALLET.balance)}</>;
}

export function NewOrderSkeleton() {
  return (
    <div className="mx-auto max-w-[90rem] px-3 pt-4 sm:px-6 sm:pt-7 lg:px-8" aria-busy="true">
      <span className="sr-only">Loading New Order…</span>
      <div className="h-24 animate-pulse rounded-2xl bg-muted motion-reduce:animate-none" />
      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="h-[28rem] animate-pulse rounded-2xl bg-muted motion-reduce:animate-none" />
        <div className="hidden h-96 animate-pulse rounded-2xl bg-muted motion-reduce:animate-none xl:block" />
      </div>
    </div>
  );
}

const noopSubscribe = () => () => {};
/** The Service Finder answers kept for the "back" link (this browser only; empty on the server). */
function readFinderQuery() {
  try {
    return sessionStorage.getItem(FINDER_QUERY_KEY) ?? "";
  } catch {
    return "";
  }
}

export function NewOrder() {
  // Re-render when language, currency, time zone or date format change.
  useDisplay();
  const params = useSearchParams();
  const hydrated = useHydrated();
  const key = ["service", "platform", "reorder", "view", "quantity"].map((k) => params.get(k) ?? "").join("|");
  // A reorder (its past orders and edits) and the Favorites tab are made of data kept in this browser, so only they wait for it.
  // Everything else renders on the server and at first paint; favorites and recent services fill in once the browser's copy is read.
  if ((params.get("reorder") || params.get("view") === "favorites") && !hydrated) return <NewOrderSkeleton />;
  // A new preselection (e.g. picked from the top-bar search) starts a fresh order.
  return <OrderFlow key={key} params={params} />;
}

function OrderFlow({ params }: { params: URLSearchParams }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const { orders } = useDemoOrders();
  const [initial] = React.useState(() => initialState(params, orders));
  const [step, setStep] = React.useState<Step>(initial.step);
  const [platformId, setPlatformId] = React.useState<string | null>(initial.platformId);
  const [serviceId, setServiceId] = React.useState<string | null>(initial.serviceId);
  const [values, setValues] = React.useState<Values>(initial.values);
  const [touched, setTouched] = React.useState<Record<string, boolean>>(initial.touched);
  const [submitted, setSubmitted] = React.useState(false);
  const reorder = initial.reorder;
  // Coming from the Service Finder, link back to the same answers.
  const fromFinder = params.get("from") === "finder";
  const finderQuery = React.useSyncExternalStore(noopSubscribe, readFinderQuery, () => "");
  const backLink = fromFinder ? { href: finderQuery ? `${FINDER_ROUTE}?${finderQuery}` : FINDER_ROUTE, label: "Service Finder" } : { href: ROUTES.overview, label: "Overview" };
  const [initialView] = React.useState<BrowseView>(() => (params.get("view") === "favorites" ? "favorites" : "browse"));
  // Edits to a reorder are kept as a draft so a refresh doesn't lose them.
  const keepDraft = (id: string | null, next: Values) => {
    if (reorder?.order && id) saveReorderDraft(reorder.orderId, id, next);
  };
  const startFresh = () => {
    clearReorderDraft();
    router.replace(ROUTES["new-order"]);
  };
  // Set when the step changes; the next step's heading takes focus once it mounts.
  const focusPending = React.useRef(false);
  const reduceMotion = useReducedMotion();

  const platform = platformId ? PLATFORM_BY_ID[platformId] : null;
  const service = serviceId ? SERVICE_BY_ID[serviceId] : null;
  const errors = React.useMemo(() => (service ? formErrors(service, values) : {}), [service, values]);
  const formValid = Boolean(service) && Object.keys(errors).length === 0;

  const reachable = (s: Step) => s === 0 || (s === 1 && !!platform) || (s === 2 && !!service) || (s === 3 && formValid);

  const choosePlatform = (id: string) => {
    if (id !== platformId && service && service.platformId !== id) setServiceId(null);
    setPlatformId(id);
    changeStep(1);
  };

  const chooseService = (s: Service, advance = false) => {
    setPlatformId(s.platformId);
    setServiceId(s.id);
    if (s.id !== serviceId) keepDraft(s.id, values);
    if (advance) changeStep(2);
  };

  const setValue = (id: string, value: string) => {
    const next = { ...values, [id]: value };
    setValues(next);
    keepDraft(serviceId, next);
  };

  const next = () => {
    if (step === 0 && platform) changeStep(1);
    else if (step === 1 && service) changeStep(2);
    else if (step === 2 && service) {
      if (formValid) changeStep(3);
      else {
        setSubmitted(true);
        const first = CATEGORY_FIELDS[service.category].find((f) => errors[f.id]);
        if (first) document.getElementById(`field-${first.id}`)?.focus();
      }
    }
  };
  const back = () => changeStep(Math.max(0, step - 1) as Step);

  /** True once after a step change, so only the new heading takes focus. */
  const claimFocus = React.useCallback(() => {
    const pending = focusPending.current;
    focusPending.current = false;
    return pending;
  }, []);

  const changeStep = (s: Step) => {
    focusPending.current = true;
    setStep(s);
  };

  const ctx: FlowContext = {
    claimFocus,
    step,
    platform,
    service,
    values,
    errors,
    showError: (id) => Boolean(errors[id] && (submitted || touched[id])),
    setValue,
    touch: (id) => setTouched((t) => ({ ...t, [id]: true })),
    choosePlatform,
    chooseService,
    goTo: (s) => reachable(s) && changeStep(s),
    next,
    back,
    formValid,
    reorder,
    initialView,
  };

  return (
    // The server paints this page before its script has loaded. Until then taps and typing would be lost
    // (nothing is listening yet), so it's inert for that moment; it becomes interactive the instant it's ready.
    <div inert={!hydrated} aria-busy={!hydrated || undefined} className="mx-auto max-w-[90rem] px-3 pt-4 pb-6 sm:px-6 sm:pt-6 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
        <div className="min-w-0">
          <Link
            href={backLink.href}
            className="inline-flex items-center gap-1.5 rounded-full text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none"
          >
            <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden /> {backLink.label}
          </Link>
          <div className="mt-1.5 flex items-center gap-1.5">
            <h1 className="font-heading text-[1.6rem] leading-tight font-extrabold tracking-tight sm:text-[1.9rem]">New Order</h1>
            <TourHelpButton tour="new-order" />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {CATALOG_TOTALS.services} services across {CATALOG_TOTALS.platforms} platforms
        </p>
      </header>

      <Stepper ctx={ctx} reachable={reachable} />

      <div className="mt-4 grid grid-cols-1 items-start gap-5 sm:mt-5 xl:grid-cols-[minmax(0,1fr)_21rem] xl:gap-6">
        <section aria-labelledby="step-title" className="min-w-0">
          {reorder ? <ReorderBanner ctx={ctx} reorder={reorder} onStartFresh={startFresh} /> : null}
          {initial.aiDraft && serviceId === initial.serviceId ? <AiDraftNotice /> : null}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              {step === 0 ? <PlatformStep ctx={ctx} /> : null}
              {step === 1 && platform ? <ServiceStep ctx={ctx} platform={platform} /> : null}
              {step === 2 && service ? <ConfigureStep ctx={ctx} service={service} /> : null}
              {step === 3 && service ? <ReviewStep ctx={ctx} service={service} /> : null}
            </motion.div>
          </AnimatePresence>
        </section>

        <aside className="sticky top-20 hidden xl:block" aria-label="Order summary">
          <SummaryCard ctx={ctx} />
        </aside>
      </div>

      <MobileActionBar ctx={ctx} />
    </div>
  );
}

interface FlowContext {
  claimFocus: () => boolean;
  step: Step;
  platform: Platform | null;
  service: Service | null;
  values: Values;
  errors: Record<string, string>;
  showError: (id: string) => boolean;
  setValue: (id: string, value: string) => void;
  touch: (id: string) => void;
  choosePlatform: (id: string) => void;
  chooseService: (s: Service, advance?: boolean) => void;
  goTo: (s: Step) => void;
  next: () => void;
  back: () => void;
  formValid: boolean;
  reorder: ReorderInfo | null;
  /** Which list the platform step opens on. */
  initialView: BrowseView;
}

type StepProps = { ctx: FlowContext };

/* -------------------------------------------------------------------------- */
/*  Reorder                                                                   */
/* -------------------------------------------------------------------------- */

/** Shown when the order was prepared by the Smart Order Assistant (AI-05). Informational only. */
function AiDraftNotice() {
  return (
    <div role="note" aria-label="Prepared with Smart Order Assistant" className="mb-4 flex items-start gap-3 rounded-2xl border border-primary/25 bg-secondary/40 p-3.5 sm:mb-5 sm:p-4 dark:bg-secondary/25">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground" aria-hidden>
        <ShieldCheck className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Prepared with Smart Order Assistant</p>
        <p className="mt-0.5 text-[0.8rem] leading-relaxed text-muted-foreground">
          The service and quantity are filled in from your draft. Add the remaining details and check everything — nothing is ordered or charged until you confirm on the Review step.
        </p>
      </div>
    </div>
  );
}

function ReorderBanner({ ctx, reorder, onStartFresh }: { ctx: FlowContext; reorder: ReorderInfo; onStartFresh: () => void }) {
  const { order } = reorder;
  const editable = reorder.copied && Boolean(ctx.service);
  const notice = (reorder.resolvedBy === "service" ? !ctx.service : !ctx.formValid) ? reorder.notice : null;
  return (
    <div
      role="region"
      aria-label="Reorder"
      className={cn(
        "mb-4 flex items-start gap-3 rounded-2xl border p-3.5 sm:mb-5 sm:p-4",
        order ? "border-primary/25 bg-secondary/40 dark:bg-secondary/25" : "border-soon/30 bg-soon-soft/50",
      )}
    >
      <span
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-xl",
          order ? "bg-primary text-primary-foreground" : "bg-soon-soft text-soon",
        )}
        aria-hidden
      >
        {order ? <Repeat className="size-4" /> : <TriangleAlert className="size-4" />}
      </span>
      <div className="min-w-0 flex-1">
        {order ? (
          <p className="text-sm font-semibold">
            Reordering from{" "}
            <Link
              href={ordersHref({ order: order.id })}
              className="font-mono text-[0.82rem] text-primary underline-offset-2 hover:underline focus-visible:rounded focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none"
            >
              {order.id}
            </Link>
          </p>
        ) : (
          <p className="text-sm font-semibold">Order not found</p>
        )}
        {editable ? (
          <p className="mt-0.5 text-[0.8rem] leading-relaxed text-muted-foreground">
            {reorder.restored ? "Your draft was restored. " : "Service, link and quantity are copied from that order. "}
            Review or change anything before placing it. Pricing comes from the current catalog, not your previous order.
          </p>
        ) : null}
        {notice ? (
          <p role="status" className={cn("flex items-start gap-1.5 text-[0.8rem] font-medium", order ? "mt-2 text-soon" : "mt-0.5 text-muted-foreground")}>
            {order ? <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden /> : null}
            {notice}
          </p>
        ) : null}
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {editable && ctx.step === 3 ? (
            <button
              type="button"
              onClick={() => ctx.goTo(2)}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border bg-card px-3 text-xs font-semibold transition-colors hover:border-primary/40 hover:text-primary focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none"
            >
              <Pencil className="size-3.5" aria-hidden /> Edit Order Details
            </button>
          ) : null}
          <button
            type="button"
            onClick={onStartFresh}
            className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-muted-foreground transition-colors hover:bg-card hover:text-foreground focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none"
          >
            <X className="size-3.5" aria-hidden /> Start a fresh order
          </button>
        </div>
      </div>
      <DemoTag className="hidden shrink-0 text-muted-foreground sm:inline-flex">Draft</DemoTag>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Stepper                                                                   */
/* -------------------------------------------------------------------------- */

function Stepper({ ctx, reachable }: { ctx: FlowContext; reachable: (s: Step) => boolean }) {
  const detail = [ctx.platform?.name, ctx.service?.name, ctx.formValid ? "Details added" : null, null];
  const stepLabel = (i: number) => {
    const state = i < ctx.step ? ", completed" : i === ctx.step ? ", current step" : "";
    return `Step ${i + 1}: ${STEPS[i]}${state}`;
  };

  return (
    <nav aria-label="Order progress" className="mt-4 sm:mt-5">
      {/* Phones: the current step named above a segmented bar */}
      <div className="rounded-2xl border bg-card px-3.5 pt-3 pb-1.5 shadow-soft sm:hidden">
        <div className="flex items-baseline justify-between gap-3">
          <p className="min-w-0 truncate text-sm">
            <span className="font-semibold">{STEPS[ctx.step]}</span>
            {ctx.step > 0 && detail[ctx.step - 1] ? <span className="text-muted-foreground"> · {detail[ctx.step - 1]}</span> : null}
          </p>
          <p className="shrink-0 text-xs font-medium text-muted-foreground tabular-nums">
            {ctx.step + 1} / {STEPS.length}
          </p>
        </div>
        <ol className="mt-1 grid grid-cols-4 gap-1.5">
          {STEPS.map((label, i) => {
            const s = i as Step;
            const canGo = ctx.step !== s && reachable(s);
            return (
              <li key={label}>
                <button
                  type="button"
                  onClick={() => ctx.goTo(s)}
                  disabled={!canGo}
                  aria-current={ctx.step === s ? "step" : undefined}
                  aria-label={stepLabel(i)}
                  className="block w-full rounded-full py-2.5 focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none disabled:cursor-default"
                >
                  <span className={cn("block h-1.5 rounded-full transition-colors duration-300", i <= ctx.step ? "bg-primary" : "bg-border")} />
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Tablet & desktop: four labelled segments, each showing what was chosen */}
      <ol className="hidden grid-cols-4 gap-1 rounded-2xl border bg-card p-1.5 shadow-soft sm:grid">
        {STEPS.map((label, i) => {
          const s = i as Step;
          const current = ctx.step === s;
          const done = ctx.step > s;
          const canGo = !current && reachable(s);
          const sub = done ? detail[i] : current ? "In progress" : reachable(s) ? "Ready" : "Not started";
          return (
            <li key={label} className="min-w-0">
              <button
                type="button"
                onClick={() => ctx.goTo(s)}
                disabled={!canGo}
                aria-current={current ? "step" : undefined}
                className={cn(
                  "flex w-full min-w-0 items-center gap-2.5 rounded-xl px-2.5 py-2 text-start transition-colors focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none lg:px-3",
                  current && "bg-secondary/70 dark:bg-secondary/40",
                  canGo ? "hover:bg-muted" : "cursor-default",
                )}
              >
                <span
                  className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-full text-[0.78rem] font-bold tabular-nums transition-colors duration-300",
                    current && "bg-primary text-primary-foreground",
                    done && "bg-primary/12 text-primary dark:bg-primary/25",
                    !current && !done && "border bg-card text-muted-foreground",
                  )}
                >
                  {done ? <Check className="size-3.5" strokeWidth={3} aria-hidden /> : i + 1}
                </span>
                <span className="min-w-0">
                  <span className={cn("block text-sm leading-tight font-semibold", !current && !done && "text-muted-foreground")}>{label}</span>
                  <span className="block truncate text-[0.72rem] leading-tight text-muted-foreground">{sub}</span>
                </span>
                {current || done ? <span className="sr-only">{current ? ", current step" : ", completed"}</span> : null}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/* -------------------------------------------------------------------------- */
/*  Shared bits                                                               */
/* -------------------------------------------------------------------------- */

function StepHeading({
  ctx,
  title,
  description,
  action,
}: {
  ctx: FlowContext;
  title: string;
  description: React.ReactNode;
  action?: React.ReactNode;
}) {
  const ref = React.useRef<HTMLHeadingElement>(null);
  const { claimFocus } = ctx;

  // Land keyboard and screen-reader users on the new step.
  React.useEffect(() => {
    if (!claimFocus()) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    ref.current?.focus({ preventScroll: true });
  }, [claimFocus]);

  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        <h2 id="step-title" ref={ref} tabIndex={-1} className="font-heading text-lg font-bold tracking-tight outline-none sm:text-xl">
          {title}
        </h2>
        <div className="mt-0.5 text-sm text-muted-foreground">{description}</div>
      </div>
      {action}
    </div>
  );
}

function SearchField({
  id,
  value,
  onChange,
  placeholder,
  label,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  label: string;
}) {
  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Search className="pointer-events-none absolute top-1/2 start-3.5 size-[1.05rem] -translate-y-1/2 text-muted-foreground" aria-hidden />
      <input
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className="h-11 w-full scroll-mt-24 scroll-mb-36 rounded-xl border bg-card pe-11 ps-10 text-[0.92rem] shadow-xs transition-colors outline-none placeholder:text-muted-foreground hover:border-foreground/20 focus-visible:border-primary/50 focus-visible:ring-3 focus-visible:ring-primary/15 [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute top-1/2 end-1.5 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none"
          aria-label="Clear search"
        >
          <X className="size-4" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

function Empty({ title, hint, onReset, resetLabel = "Clear search" }: { title: string; hint: string; onReset: () => void; resetLabel?: string }) {
  return (
    <div className="rounded-2xl border border-dashed px-6 py-10 text-center">
      <span className="mx-auto grid size-10 place-items-center rounded-xl bg-muted text-muted-foreground">
        <SearchX className="size-5" aria-hidden />
      </span>
      <p className="mt-3 font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
      <button type="button" onClick={onReset} className={cn(dashButton.ghost, "mt-2 h-9")}>
        {resetLabel}
      </button>
    </div>
  );
}

function PricingPending({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1 rounded-full bg-muted px-2.5 text-[0.7rem] font-semibold whitespace-nowrap text-muted-foreground",
        className,
      )}
    >
      <Clock3 className="size-3" strokeWidth={2.5} aria-hidden />
      Pricing pending
    </span>
  );
}

/** A small uppercase label above a group of options. */
function GroupLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("flex items-center gap-1.5 text-[0.7rem] font-bold tracking-wider text-muted-foreground uppercase", className)}>{children}</p>;
}

const chipClass =
  "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border bg-card px-3.5 text-sm font-medium whitespace-nowrap transition-colors hover:border-foreground/25 focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none sm:h-9";
const chipOnClass = "border-foreground bg-foreground text-background hover:border-foreground";

/** Two-way switch (All / Favorites) styled as one segmented control. */
function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: React.ReactNode }[];
  onChange: (v: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex h-11 shrink-0 items-center gap-1 rounded-xl bg-muted p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-semibold whitespace-nowrap transition-colors focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none",
            value === o.value ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Step 1 · Platform                                                         */
/* -------------------------------------------------------------------------- */

const SERVICE_COUNT = Object.fromEntries(PLATFORMS.map((p) => [p.id, SERVICES.filter((s) => s.platformId === p.id).length]));

/** Favorites first, in the order they were when the list opened, so cards don't jump when a heart is toggled. */
function useFavoritesFirst() {
  const favorites = useFavorites();
  const hydrated = useHydrated();
  // Pinned once, the moment this browser's favorites are first known (the server renders without them).
  const [pinned, setPinned] = React.useState<Set<string> | null>(null);
  if (hydrated && pinned === null) setPinned(new Set(favorites.ids));
  return React.useCallback(
    (list: Service[]) => (pinned?.size ? [...list].sort((a, b) => Number(pinned.has(b.id)) - Number(pinned.has(a.id))) : list),
    [pinned],
  );
}

/** Services from this account's own orders, newest first. Empty for accounts without orders. */
function useRecentServices(limit = 4) {
  const { orders } = useDemoOrders();
  return React.useMemo(() => {
    const seen = new Set<string>();
    const list: Service[] = [];
    for (const o of orders) {
      const s = SERVICE_BY_ID[o.serviceId];
      if (!s || seen.has(s.id)) continue;
      seen.add(s.id);
      list.push(s);
      if (list.length === limit) break;
    }
    return list;
  }, [orders, limit]);
}

function FavoritesEmpty({ title, hint, action }: { title: string; hint: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed px-6 py-10 text-center">
      <span className="mx-auto grid size-10 place-items-center rounded-xl bg-secondary text-primary">
        <Heart className="size-5" aria-hidden />
      </span>
      <p className="mt-3 font-semibold">{title}</p>
      <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">{hint}</p>
      {action}
    </div>
  );
}

/** Opens the AI Service Finder: shown beside the step title. */
function FinderLink() {
  return (
    <Link
      href={FINDER_ROUTE}
      className="group inline-flex h-10 items-center gap-2 rounded-full border border-primary/25 bg-secondary/60 ps-1.5 pe-3.5 text-sm font-semibold text-secondary-foreground transition-colors hover:border-primary/45 hover:bg-secondary focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none dark:bg-primary/15"
    >
      <span className="grid size-7 place-items-center rounded-full bg-primary text-primary-foreground" aria-hidden>
        <Compass className="size-3.5 transition-transform duration-300 group-hover:-rotate-[25deg] motion-reduce:transition-none" />
      </span>
      Not sure? Find my service
    </Link>
  );
}

/** One row of quick service shortcuts; scrolls sideways on phones. */
function QuickRow({ label, services, onPick, tag }: { label: React.ReactNode; services: Service[]; onPick: (s: Service) => void; tag?: React.ReactNode }) {
  if (!services.length) return null;
  return (
    <div>
      <GroupLabel>
        {label}
        {tag}
      </GroupLabel>
      <ul className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1 no-scrollbar sm:mx-0 sm:flex-wrap sm:px-0">
        {services.map((s) => {
          const p = PLATFORM_BY_ID[s.platformId];
          return (
            <li key={s.id} className="shrink-0">
              <button
                type="button"
                onClick={() => onPick(s)}
                className="inline-flex h-10 items-center gap-2 rounded-full border bg-card ps-1.5 pe-3.5 text-sm font-medium whitespace-nowrap transition-[border-color,background-color] hover:border-primary/40 hover:bg-secondary/40 focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none sm:h-9"
              >
                <span className="grid size-7 place-items-center rounded-full sm:size-6" style={{ backgroundColor: p.color, color: p.ink }} aria-hidden>
                  <PlatformIcon icon={p.icon} className="size-3.5" />
                </span>
                {s.name}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PlatformStep({ ctx }: StepProps) {
  const [query, setQuery] = React.useState("");
  const [view, setView] = React.useState<BrowseView>(ctx.initialView);
  const favorites = useFavorites();
  const favoritesFirst = useFavoritesFirst();
  const recent = useRecentServices();
  const live = useLiveAccount();
  const q = query.trim().toLowerCase();
  const browsing = view === "browse";
  const platforms = !browsing
    ? []
    : q
      ? PLATFORMS.filter((p) => [p.name, p.short, ...p.aliases].some((t) => t.toLowerCase().includes(q)))
      : PLATFORMS;
  const services = browsing && q ? favoritesFirst(SERVICES.filter((s) => matchesQuery(s, q))) : [];
  const saved = favorites.ids.map((id) => SERVICE_BY_ID[id]).filter((s): s is Service => Boolean(s));
  const savedShown = saved.filter((s) => matchesQuery(s, q));
  const pick = (s: Service) => ctx.chooseService(s, true);

  return (
    <Panel className="@container p-4 sm:p-6">
      <StepHeading ctx={ctx} title="Choose a platform" description="Where would you like to grow? Pick a platform, or search for a service." action={<FinderLink />} />

      <div className="mt-4 flex flex-col gap-2 @lg:flex-row">
        <div className="min-w-0 flex-1">
          <SearchField
            id="platform-search"
            label={browsing ? "Search platforms or services" : "Search your favorites"}
            value={query}
            onChange={setQuery}
            placeholder={browsing ? "Search platforms or services" : "Search your favorites"}
          />
        </div>
        <Segmented<BrowseView>
          label="Show"
          value={view}
          onChange={setView}
          options={[
            { value: "browse", label: "All services" },
            {
              value: "favorites",
              label: (
                <>
                  <Heart className={cn("size-3.5", saved.length && "fill-current text-primary")} aria-hidden />
                  Favorites <span className="text-xs tabular-nums opacity-70">{saved.length}</span>
                </>
              ),
            },
          ]}
        />
      </div>

      {!browsing ? (
        <div className="mt-5">
          {savedShown.length ? (
            <ServiceList label="Favorite services">
              {savedShown.map((s) => (
                <li key={s.id}>
                  <ServiceRow service={s} showPlatform onSelect={() => pick(s)} />
                </li>
              ))}
            </ServiceList>
          ) : saved.length ? (
            <Empty title={`No favorites match “${query.trim()}”`} hint="Try another word." onReset={() => setQuery("")} />
          ) : (
            <FavoritesEmpty
              title="Your favorites will appear here."
              hint="Save services you use often for faster ordering."
              action={
                <button type="button" onClick={() => setView("browse")} className={cn(dashButton.primary, "mt-4 px-4")}>
                  Explore Services <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden />
                </button>
              }
            />
          )}
        </div>
      ) : null}

      {browsing && !q ? (
        <div className="mt-5 space-y-4">
          <QuickRow
            label={<><History className="size-3.5" aria-hidden /> Recently used</>}
            tag={live ? null : <DemoTag className="ms-1 h-4 px-1.5 text-[0.55rem] text-muted-foreground" />}
            services={recent}
            onPick={pick}
          />
          <QuickRow label={<><Heart className="size-3.5" aria-hidden /> Favorites</>} services={saved.slice(0, 4)} onPick={pick} />
        </div>
      ) : null}

      {platforms.length ? (
        <>
          <GroupLabel className={q ? "mt-5" : "mt-6"}>{q ? "Platforms" : `All ${PLATFORMS.length} platforms`}</GroupLabel>
          {/* Columns follow the panel width, so they adapt when the summary or sidebar takes space */}
          <ul className="mt-2 grid grid-cols-3 gap-2 @xl:grid-cols-4 @3xl:grid-cols-5 @3xl:gap-2.5">
            {platforms.map((p) => (
              <li key={p.id}>
                <PlatformCard platform={p} selected={ctx.platform?.id === p.id} onSelect={() => ctx.choosePlatform(p.id)} />
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {q && services.length ? (
        <>
          <GroupLabel className="mt-6">
            Services · {services.length} match{services.length === 1 ? "" : "es"}
          </GroupLabel>
          <ServiceList className="mt-2">
            {services.slice(0, 8).map((s) => (
              <li key={s.id}>
                <ServiceRow service={s} showPlatform onSelect={() => pick(s)} />
              </li>
            ))}
          </ServiceList>
          {services.length > 8 ? <p className="mt-3 text-xs text-muted-foreground">Showing 8 of {services.length}. Add a word to narrow it down.</p> : null}
        </>
      ) : null}

      {browsing && q && !platforms.length && !services.length ? (
        <div className="mt-6">
          <Empty title={`Nothing matches “${query.trim()}”`} hint="Try a platform name or a service like “followers”." onReset={() => setQuery("")} />
        </div>
      ) : null}
    </Panel>
  );
}

function PlatformCard({ platform, selected, onSelect }: { platform: Platform; selected: boolean; onSelect: () => void }) {
  const total = SERVICE_COUNT[platform.id];
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`${platform.name}, ${total} service${total === 1 ? "" : "s"}`}
      className={cn(
        "group relative flex h-full w-full flex-col items-center gap-2 rounded-xl border bg-card px-1.5 pt-3 pb-2.5 text-center transition-[border-color,box-shadow,translate,background-color] duration-200 hover:-translate-y-px hover:border-primary/35 hover:shadow-soft focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none active:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:pt-3.5",
        selected && "border-primary bg-secondary/50 ring-1 ring-primary hover:border-primary dark:bg-secondary/30",
      )}
    >
      <PlatformTile
        platform={platform}
        size="md"
        className="size-10 rounded-xl transition-transform duration-200 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
      />
      <span className="w-full min-w-0" aria-hidden>
        <span className="block truncate text-[0.82rem] leading-tight font-semibold sm:text-sm">{platform.short}</span>
        <span className="mt-0.5 block text-[0.7rem] text-muted-foreground tabular-nums">{total} services</span>
      </span>
      {selected ? (
        <span className="absolute end-1.5 top-1.5 grid size-4.5 place-items-center rounded-full bg-primary text-primary-foreground" aria-hidden>
          <Check className="size-3" strokeWidth={3.5} />
        </span>
      ) : null}
    </button>
  );
}

function ServiceList({ children, label, className }: { children: React.ReactNode; label?: string; className?: string }) {
  return (
    <ul className={cn("divide-y overflow-hidden rounded-xl border", className)} aria-label={label}>
      {children}
    </ul>
  );
}

/**
 * One service as a compact row. With `onConfirm` it's a selectable option (Step 2);
 * otherwise picking it goes straight to the details.
 */
function ServiceRow({
  service,
  selected = false,
  showPlatform,
  onSelect,
  onConfirm,
}: {
  service: Service;
  selected?: boolean;
  showPlatform?: boolean;
  onSelect: () => void;
  onConfirm?: () => void;
}) {
  const p = PLATFORM_BY_ID[service.platformId];
  const Icon = CATEGORY_ICONS[service.category];
  const price = pricing(service, {});
  const option = Boolean(onConfirm);
  // Most services need just a link and a quantity; only list requirements when there's more to it.
  const needs = requirementsOf(service);
  const unusual = needs.some((r) => r !== "Link" && r !== "Quantity");
  return (
    <div className={cn("group/row relative transition-colors", selected ? "bg-secondary/60 dark:bg-secondary/30" : "hover:bg-muted/50")}>
      {selected ? <span className="absolute inset-y-0 start-0 w-0.5 bg-primary" aria-hidden /> : null}
      <button
        type="button"
        aria-pressed={option ? selected : undefined}
        onClick={onSelect}
        onDoubleClick={onConfirm}
        className={cn(
          "flex w-full min-w-0 items-center gap-3 py-3 ps-3 text-start focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none focus-visible:ring-inset sm:ps-4",
          option ? "pe-12" : "pe-3",
          selected && "sm:pe-36",
        )}
      >
        {showPlatform ? (
          <PlatformTile platform={p} size="sm" className="size-9 rounded-lg" />
        ) : (
          <span
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-lg transition-colors",
              selected ? "bg-primary text-primary-foreground" : "bg-muted text-foreground/75",
            )}
            title={CATEGORY_META[service.category].label}
          >
            {selected ? <Check className="size-4" strokeWidth={3} aria-hidden /> : <Icon className="size-4" aria-hidden />}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 text-sm leading-snug font-semibold sm:block sm:truncate">{service.name}</span>
          <span className="mt-0.5 line-clamp-1 text-xs leading-snug text-muted-foreground">
            {showPlatform ? `${p.short} · ${CATEGORY_META[service.category].label}` : service.description}
          </span>
          {option ? (
            <span className={cn("mt-1.5 flex-wrap items-center gap-1", unusual ? "hidden sm:flex" : "sr-only")}>
              <span className="sr-only">You&apos;ll provide:</span>
              {needs.map((r) => (
                <span key={r} className="rounded-md bg-muted px-1.5 py-0.5 text-[0.68rem] font-medium text-muted-foreground">
                  {r}
                </span>
              ))}
            </span>
          ) : null}
        </span>
        {price ? <span className="shrink-0 text-xs font-semibold tabular-nums">{price.unit}</span> : <span className="sr-only">. Pricing pending.</span>}
        {/* Room for the favorite button, which sits over the row */}
        {!option ? <span className="w-8 shrink-0" aria-hidden /> : null}
        {!option ? <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover/row:translate-x-0.5 group-hover/row:text-primary rtl:-scale-x-100" aria-hidden /> : null}
      </button>
      {selected && onConfirm ? (
        <button
          type="button"
          onClick={onConfirm}
          className="absolute top-1/2 end-12 hidden h-8 -translate-y-1/2 items-center gap-1 rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-primary/35 focus-visible:outline-none sm:inline-flex"
        >
          Continue <ArrowRight className="size-3.5 rtl:-scale-x-100" aria-hidden />
        </button>
      ) : null}
      <FavoriteButton service={service} className={cn("absolute top-1/2 -translate-y-1/2", option ? "end-2" : "end-10")} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Step 2 · Service                                                          */
/* -------------------------------------------------------------------------- */

function ServiceStep({ ctx, platform }: StepProps & { platform: Platform }) {
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState<ServiceCategory | "all" | "favorites">("all");
  const favorites = useFavorites();
  const favoritesFirst = useFavoritesFirst();
  const all = React.useMemo(() => favoritesFirst(SERVICES.filter((s) => s.platformId === platform.id)), [platform.id, favoritesFirst]);
  const categories = CATEGORY_ORDER.filter((c) => all.some((s) => s.category === c));
  const favoriteCount = all.filter((s) => favorites.has.has(s.id)).length;
  const inCategory = (s: Service) =>
    category === "all" || (category === "favorites" ? favorites.has.has(s.id) : s.category === category);
  const list = all.filter((s) => inCategory(s) && matchesQuery(s, query));

  return (
    <Panel className="p-4 sm:p-6">
      <StepHeading
        ctx={ctx}
        title="Choose a service"
        description={
          <span className="inline-flex items-center gap-2">
            <PlatformTile platform={platform} size="xs" />
            {all.length} {platform.name} services
          </span>
        }
        action={
          <button type="button" onClick={() => ctx.goTo(0)} className={cn(dashButton.secondary, "h-10 px-4")}>
            Change platform
          </button>
        }
      />

      <div className="mt-4">
        <SearchField
          id="service-search"
          label={`Search ${platform.name} services`}
          value={query}
          onChange={setQuery}
          placeholder={`Search ${platform.name} services`}
        />
      </div>

      {categories.length > 1 ? (
        <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 no-scrollbar sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Filter by type">
          <button type="button" aria-pressed={category === "all"} onClick={() => setCategory("all")} className={cn(chipClass, category === "all" && chipOnClass)}>
            All <span className="text-xs opacity-60">{all.length}</span>
          </button>
          <button
            type="button"
            aria-pressed={category === "favorites"}
            onClick={() => setCategory(category === "favorites" ? "all" : "favorites")}
            className={cn(chipClass, category === "favorites" && chipOnClass)}
          >
            <Heart className={cn("size-3.5", favoriteCount && "fill-current", category !== "favorites" && favoriteCount && "text-primary")} aria-hidden />
            Favorites
            <span className="text-xs opacity-60">{favoriteCount}</span>
          </button>
          {categories.map((c) => {
            const Icon = CATEGORY_ICONS[c];
            const on = category === c;
            return (
              <button key={c} type="button" aria-pressed={on} onClick={() => setCategory(on ? "all" : c)} className={cn(chipClass, on && chipOnClass)}>
                <Icon className="size-3.5" aria-hidden />
                {CATEGORY_META[c].short}
                <span className="text-xs opacity-60">{all.filter((s) => s.category === c).length}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      {list.length && list.every((s) => !s.price) ? (
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Clock3 className="size-3.5 shrink-0" aria-hidden />
          Pricing for these services is pending verification. You can still set up your order.
        </p>
      ) : null}

      {list.length ? (
        <ServiceList className="mt-3" label={`${platform.name} services`}>
          {list.map((s) => (
            <li key={s.id}>
              <ServiceRow service={s} selected={ctx.service?.id === s.id} onSelect={() => ctx.chooseService(s)} onConfirm={() => ctx.chooseService(s, true)} />
            </li>
          ))}
        </ServiceList>
      ) : category === "favorites" && !query.trim() ? (
        <div className="mt-4">
          <FavoritesEmpty
            title={`No ${platform.short} favorites yet`}
            hint="Tap the heart on a service to save it here for faster ordering."
            action={
              <button type="button" onClick={() => setCategory("all")} className={cn(dashButton.ghost, "mt-3 h-9")}>
                Show all services
              </button>
            }
          />
        </div>
      ) : (
        <div className="mt-4">
          <Empty
            title="No services match"
            hint="Try another word or show every type."
            resetLabel="Clear filters"
            onReset={() => {
              setQuery("");
              setCategory("all");
            }}
          />
        </div>
      )}
    </Panel>
  );
}

/* -------------------------------------------------------------------------- */
/*  Step 3 · Configure                                                        */
/* -------------------------------------------------------------------------- */

/** The chosen service as a compact strip, with a way back to change it. */
function ServiceStrip({ ctx, service }: { ctx: FlowContext; service: Service }) {
  const platform = PLATFORM_BY_ID[service.platformId];
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-muted/40 p-2.5 sm:p-3">
      <PlatformTile platform={platform} size="md" className="size-10 rounded-xl" />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm leading-snug font-semibold sm:truncate">{service.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {platform.short} · {CATEGORY_META[service.category].short}
        </p>
      </div>
      <FavoriteButton service={service} />
      <button type="button" onClick={() => ctx.goTo(1)} className={cn(dashButton.ghost, "h-9 shrink-0 px-2.5")}>
        Change
      </button>
    </div>
  );
}

function ConfigureStep({ ctx, service }: StepProps & { service: Service }) {
  const platform = PLATFORM_BY_ID[service.platformId];
  const fields = CATEGORY_FIELDS[service.category];
  const visibleErrors = fields.filter((f) => ctx.showError(f.id));

  return (
    <Panel className="p-4 sm:p-6">
      <StepHeading ctx={ctx} title="Configure your order" description="Only the details this service needs. Required fields are marked." />

      <div className="mt-4">
        <ServiceStrip ctx={ctx} service={service} />
      </div>

      {visibleErrors.length > 1 ? (
        <div role="alert" className="mt-4 flex gap-2.5 rounded-xl border border-destructive/30 bg-destructive/5 p-3.5 text-sm">
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
          <p>
            <span className="font-semibold">Please fix {visibleErrors.length} fields</span>{" "}
            <span className="text-muted-foreground">before reviewing your order.</span>
          </p>
        </div>
      ) : null}

      <form
        noValidate
        className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          ctx.next();
        }}
      >
        {fields.map((f) => (
          <FormField key={f.id} field={f} ctx={ctx} service={service} platform={platform} />
        ))}
        <button type="submit" className="sr-only">
          Review order
        </button>
      </form>

      <section className="mt-6 border-t pt-5" aria-labelledby="notes-title">
        <h3 id="notes-title" className="mb-3 flex items-center gap-2 text-sm font-bold">
          <ShieldCheck className="size-4 text-primary" aria-hidden /> Before you order
        </h3>
        <NotesList service={service} />
      </section>
    </Panel>
  );
}

const QUANTITY_PRESETS = [100, 500, 1000, 5000];

const inputClass =
  "w-full scroll-mt-24 scroll-mb-36 rounded-xl border bg-card px-3.5 text-[0.95rem] shadow-xs transition-colors outline-none placeholder:text-muted-foreground/70 hover:border-foreground/20 focus-visible:border-primary/60 focus-visible:ring-3 focus-visible:ring-primary/15 aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive/15";

function FormField({ field, ctx, service, platform }: { field: OrderField; ctx: FlowContext; service: Service; platform: Platform }) {
  const id = `field-${field.id}`;
  const value = ctx.values[field.id] ?? "";
  const error = ctx.showError(field.id) ? ctx.errors[field.id] : null;
  const warning = error ? null : fieldWarning(field, value, platform);
  const describedBy = [field.help && `${id}-help`, (error || warning) && `${id}-msg`].filter(Boolean).join(" ") || undefined;
  const wide = field.kind === "textarea" || field.kind === "link" || field.kind === "consent" || field.kind === "text";
  const common = {
    id,
    name: field.id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
    "aria-required": field.required || undefined,
    onBlur: () => ctx.touch(field.id),
  } as const;

  if (field.kind === "consent") {
    return (
      <div className="sm:col-span-2">
        <label
          htmlFor={id}
          className={cn(
            "flex cursor-pointer items-start gap-3 rounded-2xl border bg-card p-3.5 text-sm transition-colors hover:border-foreground/20",
            value && "border-primary/50 bg-secondary/30",
            error && "border-destructive",
          )}
        >
          <input
            {...common}
            type="checkbox"
            checked={value === "yes"}
            onChange={(e) => {
              ctx.setValue(field.id, e.target.checked ? "yes" : "");
              ctx.touch(field.id);
            }}
            className="mt-0.5 size-4 shrink-0 scroll-mb-36 accent-[var(--primary)]"
          />
          <span className="leading-relaxed">{field.label}</span>
        </label>
        <FieldMessage id={`${id}-msg`} error={error} warning={null} />
      </div>
    );
  }

  const control = (() => {
    switch (field.kind) {
      case "textarea":
        return (
          <textarea
            {...common}
            rows={3}
            value={value}
            placeholder={field.placeholder}
            onChange={(e) => ctx.setValue(field.id, e.target.value)}
            className={cn(inputClass, "min-h-24 resize-y py-3 leading-relaxed")}
          />
        );
      case "select":
        return (
          <div className="relative">
            <Select
              {...common}
              value={value}
              onChange={(e) => {
                ctx.setValue(field.id, e.target.value);
                ctx.touch(field.id);
              }}
              className={cn(inputClass, "h-12 appearance-none pe-10", !value && "text-muted-foreground")}
            >
              <option value="">Select…</option>
              {field.options?.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </Select>
          </div>
        );
      case "budget":
        return (
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 start-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden>
              $
            </span>
            <input
              {...common}
              type="text"
              inputMode="decimal"
              value={value}
              placeholder={field.placeholder}
              onChange={(e) => ctx.setValue(field.id, e.target.value)}
              className={cn(inputClass, "h-12 ps-7 tabular-nums")}
            />
          </div>
        );
      case "quantity":
        return (
          <input
            {...common}
            type="text"
            inputMode="numeric"
            value={value}
            placeholder={field.placeholder}
            onChange={(e) => ctx.setValue(field.id, e.target.value)}
            className={cn(inputClass, "h-12 tabular-nums")}
          />
        );
      default:
        return (
          <input
            {...common}
            type={field.kind === "link" ? "url" : field.kind === "date" ? "date" : "text"}
            inputMode={field.kind === "link" ? "url" : undefined}
            autoCapitalize={field.kind === "link" ? "none" : undefined}
            spellCheck={field.kind === "link" ? false : undefined}
            value={value}
            placeholder={field.placeholder}
            onChange={(e) => ctx.setValue(field.id, e.target.value)}
            className={cn(inputClass, "h-12")}
          />
        );
    }
  })();

  const limits = field.kind === "quantity" ? service.limits : null;
  // Common amounts as one-tap shortcuts, kept inside the service's own limits when it has them.
  const presets = field.kind === "quantity" ? QUANTITY_PRESETS.filter((n) => !limits || (n >= limits.min && n <= limits.max)) : [];
  const linkOk = field.kind === "link" && !error && !warning && Boolean(parseLink(value.trim()));

  return (
    <div className={cn(wide && "sm:col-span-2")}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-semibold">
          {field.label}
        </label>
        <span className="text-[0.7rem] font-medium text-muted-foreground">{field.required ? "Required" : "Optional"}</span>
      </div>
      {control}
      {presets.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Common quantities">
          {presets.map((n) => {
            const on = parseNumber(value) === n;
            return (
              <button
                key={n}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  ctx.setValue(field.id, String(n));
                  ctx.touch(field.id);
                }}
                className={cn(
                  "inline-flex h-9 items-center rounded-lg border bg-card px-3 text-xs font-semibold tabular-nums transition-colors hover:border-primary/40 focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none",
                  on && "border-primary bg-secondary text-secondary-foreground",
                )}
              >
                {count(n)}
              </button>
            );
          })}
        </div>
      ) : null}
      {linkOk ? (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-ok">
          <CircleCheck className="size-3.5 shrink-0" aria-hidden /> Link looks good
        </p>
      ) : null}
      {field.help || limits ? (
        <p id={`${id}-help`} className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          {limits ? `Between ${count(limits.min)} and ${count(limits.max)}. ` : ""}
          {field.help}
        </p>
      ) : null}
      <FieldMessage id={`${id}-msg`} error={error} warning={warning} />
    </div>
  );
}

function FieldMessage({ id, error, warning }: { id: string; error: string | null; warning: string | null }) {
  if (!error && !warning) return null;
  return (
    <p id={id} role={error ? "alert" : undefined} className={cn("mt-1.5 flex items-start gap-1.5 text-xs font-medium", error ? "text-destructive" : "text-soon")}>
      {error ? <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden /> : <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden />}
      {error ?? warning}
    </p>
  );
}

/** Delivery notes without the pricing line, which the checkout status already covers. */
const deliveryNotes = (s: Service) => CATEGORY_DELIVERY[s.category].filter((n) => !n.startsWith("Ordering opens"));

function NotesList({ service }: { service: Service }) {
  return (
    <ul className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2 sm:gap-x-6">
      {deliveryNotes(service).map((n) => (
        <li key={n} className="flex gap-2.5">
          <span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground/60" aria-hidden />
          {n}
        </li>
      ))}
      <li className="flex gap-2.5">
        <Lock className="mt-0.5 size-3.5 shrink-0 text-foreground/70" aria-hidden />
        <span>
          <span className="font-semibold text-foreground">We never ask for your password.</span> Only share public links.
        </span>
      </li>
    </ul>
  );
}

/** One part of the review, with an Edit action that returns to its step. */
function ReviewSection({
  ctx,
  id,
  title,
  to,
  children,
  className,
}: {
  ctx: FlowContext;
  id: string;
  title: string;
  to: Step;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("border-t px-4 py-3.5 sm:px-6", className)} aria-labelledby={id}>
      <div className="flex items-center justify-between gap-3">
        <h3 id={id} className="text-[0.7rem] font-bold tracking-wider text-muted-foreground uppercase">
          {title}
        </h3>
        <button
          type="button"
          onClick={() => ctx.goTo(to)}
          aria-label={`Edit ${title.toLowerCase()}`}
          className={cn(dashButton.ghost, "-me-2 h-9 gap-1.5")}
        >
          <Pencil className="size-3.5" aria-hidden /> Edit
        </button>
      </div>
      <div className="mt-1.5">{children}</div>
    </section>
  );
}

function ReviewStep({ ctx, service }: StepProps & { service: Service }) {
  const platform = PLATFORM_BY_ID[service.platformId];
  const fields = CATEGORY_FIELDS[service.category];
  const price = pricing(service, ctx.values);

  return (
    <div className="grid grid-cols-1 gap-4 sm:gap-5">
      <Panel className="overflow-hidden">
        <div className="p-4 sm:p-6">
          <StepHeading ctx={ctx} title="Review your order" description="Check everything before you place it. Tap Edit to change any part." />
        </div>

        {/* Platform and service side by side from tablet up */}
        <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <ReviewSection ctx={ctx} id="review-platform" title="Platform" to={0}>
            <div className="flex items-center gap-2.5">
              <PlatformTile platform={platform} size="sm" className="size-8 rounded-lg" />
              <p className="truncate font-semibold">{platform.name}</p>
            </div>
          </ReviewSection>
          <ReviewSection ctx={ctx} id="review-service" title="Service" to={1} className="sm:border-s">
            <p className="truncate font-semibold">{service.name}</p>
            <p className="truncate text-sm text-muted-foreground">{CATEGORY_META[service.category].label}</p>
          </ReviewSection>
        </div>

        <ReviewSection ctx={ctx} id="review-details" title="Details" to={2}>
          <dl className="divide-y">
            {fields.map((f) => {
              const v = displayValue(f, ctx.values[f.id]);
              if (!v && !f.required) return null;
              return (
                <div key={f.id} className="grid grid-cols-1 gap-0.5 py-2.5 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4">
                  <dt className="text-sm text-muted-foreground">{f.kind === "consent" ? "Confirmation" : f.label}</dt>
                  <dd className={cn("text-sm font-medium break-words whitespace-pre-line", f.kind === "link" && "font-mono text-[0.8rem]")}>{v}</dd>
                </div>
              );
            })}
          </dl>
        </ReviewSection>

        <section className="border-t bg-muted/30 px-4 py-4 sm:px-6" aria-labelledby="review-price">
          <h3 id="review-price" className="text-[0.7rem] font-bold tracking-wider text-muted-foreground uppercase">
            Price &amp; balance
          </h3>
          <PriceRows service={service} values={ctx.values} className="mt-2.5" />
        </section>
      </Panel>

      {/* One consolidated notice: checkout status first, then what to know about the service */}
      <Panel className="overflow-hidden" aria-labelledby="before-title">
        <div role="status" className="flex gap-3 border-b border-soon/20 bg-soon-soft/50 p-4 sm:p-5">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-soon-soft text-soon" aria-hidden>
            <Lock className="size-4" />
          </span>
          <div className="text-sm leading-relaxed">
            <p className="font-semibold">{price ? "Checkout isn't open yet" : "Pricing pending — ordering isn't open for this service yet"}</p>
            <p className="mt-0.5 text-muted-foreground">
              {price ? "" : "Pricing, fulfilment and compliance are still being verified. "}
              No order will be created and your balance won&apos;t change.
            </p>
          </div>
        </div>
        <div className="p-4 sm:p-5">
          <h3 id="before-title" className="mb-3 flex items-center gap-2 text-sm font-bold">
            <ShieldCheck className="size-4 text-primary" aria-hidden /> Before you place this order
          </h3>
          <NotesList service={service} />
        </div>
      </Panel>
    </div>
  );
}

function PriceRows({ service, values, className }: { service: Service | null; values: Values; className?: string }) {
  const live = useLiveAccount();
  const price = pricing(service, values);
  const qtyBased = service ? isQuantityBased(service.category) : true;
  const amountLabel = qtyBased ? "Quantity" : "Campaign budget";
  const amountValue = qtyBased
    ? displayValue({ id: "quantity", label: "", kind: "quantity", required: true }, values.quantity)
    : displayValue({ id: "budget", label: "", kind: "budget", required: true }, values.budget);

  return (
    <dl className={cn("space-y-2 text-sm", className)}>
      <div className="flex items-center justify-between gap-3">
        <dt className="text-muted-foreground">{amountLabel}</dt>
        <dd className="font-medium tabular-nums">{amountValue ?? "—"}</dd>
      </div>
      <div className="flex items-center justify-between gap-3">
        <dt className="text-muted-foreground">Unit price</dt>
        <dd>{service ? price ? <span className="font-medium">{price.unit}</span> : <PricingPending /> : "—"}</dd>
      </div>
      <div className="flex items-center justify-between gap-3 border-t pt-2.5">
        <dt className="font-semibold">Total</dt>
        <dd className="font-heading text-base font-extrabold tabular-nums">{service ? price?.total ?? <PricingPending /> : "—"}</dd>
      </div>
      <div className="flex items-center justify-between gap-3">
        <dt className="flex items-center gap-1.5 text-muted-foreground">
          Available balance {live ? null : <DemoTag className="h-4 px-1.5 text-[0.55rem] text-muted-foreground">Demo</DemoTag>}
        </dt>
        <dd className="font-medium tabular-nums">
          <WalletBalance />
        </dd>
      </div>
    </dl>
  );
}

/* -------------------------------------------------------------------------- */
/*  Summary & actions                                                         */
/* -------------------------------------------------------------------------- */

const ACTION_LABEL = ["Continue", "Continue to details", "Review order", "Place order"] as const;
const COMPACT_LABEL = ["Continue", "Continue", "Review", "Place order"] as const;

function actionState(ctx: FlowContext) {
  switch (ctx.step) {
    case 0:
      return { disabled: !ctx.platform, hint: ctx.platform ? null : "Select a platform to continue." };
    case 1:
      return { disabled: !ctx.service, hint: ctx.service ? null : "Select a service to continue." };
    case 2:
      return { disabled: false, hint: null };
    default:
      return {
        disabled: true,
        hint: ctx.service?.price ? "Checkout isn't open yet — nothing is charged." : "Pricing pending — ordering opens once this service is verified.",
      };
  }
}

function PrimaryAction({ ctx, compact, className }: { ctx: FlowContext; compact?: boolean; className?: string }) {
  const { disabled } = actionState(ctx);
  const review = ctx.step === 3;
  return (
    <button
      type="button"
      onClick={ctx.next}
      disabled={disabled}
      aria-disabled={disabled}
      className={cn(
        "inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 text-[0.95rem] font-semibold whitespace-nowrap text-primary-foreground shadow-[0_10px_28px_-14px_rgb(112_71_235/0.8)] transition-[background-color,translate] hover:-translate-y-px hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-primary/35 focus-visible:outline-none active:translate-y-0 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none disabled:hover:translate-y-0 motion-reduce:hover:translate-y-0",
        className,
      )}
    >
      {review ? <Lock className="size-4" aria-hidden /> : null}
      {(compact ? COMPACT_LABEL : ACTION_LABEL)[ctx.step]}
      {review ? null : <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden />}
    </button>
  );
}

function SelectionLine({ ctx }: { ctx: FlowContext }) {
  if (!ctx.platform) {
    return (
      <div className="flex items-center gap-3">
        <span className="size-9 shrink-0 rounded-xl border-2 border-dashed" aria-hidden />
        <p className="text-sm text-muted-foreground">Pick a platform and service to begin.</p>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3">
      <PlatformTile platform={ctx.platform} size="sm" className="size-9 rounded-xl" />
      <div className="min-w-0">
        <p className={cn("truncate text-sm font-semibold", !ctx.service && "text-muted-foreground")}>{ctx.service?.name ?? "Choose a service"}</p>
        <p className="truncate text-xs text-muted-foreground">{ctx.platform.name}</p>
      </div>
    </div>
  );
}

/** Sticky order summary on wide screens: the selection, live price lines and the step actions. */
function SummaryCard({ ctx }: { ctx: FlowContext }) {
  const { hint } = actionState(ctx);
  return (
    <Panel className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b px-5 py-3.5">
        <h2 className="font-heading text-[0.98rem] font-bold tracking-tight">Order summary</h2>
        <span className="text-xs text-muted-foreground tabular-nums">
          Step {ctx.step + 1} of {STEPS.length}
        </span>
      </div>

      <div className="p-5">
        <SelectionLine ctx={ctx} />
        <PriceRows service={ctx.service} values={ctx.values} className="mt-4 border-t pt-4" />

        <div className="mt-5 flex gap-2">
          {ctx.step > 0 ? (
            <button type="button" onClick={ctx.back} className={cn(dashButton.secondary, "h-12 shrink-0 px-4")}>
              Back
            </button>
          ) : null}
          <PrimaryAction ctx={ctx} className="flex-1 px-4" />
        </div>
        {hint ? <p className="mt-2.5 text-center text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
      </div>

      <div className="border-t bg-muted/30 px-5 py-3">
        <p className="flex items-center justify-center gap-1.5 text-[0.7rem] text-muted-foreground">
          <Lock className="size-3" aria-hidden /> No payment is taken in this preview.
        </p>
        <FxNote className="mt-1.5 justify-center" />
      </div>
    </Panel>
  );
}

const FIELD_SELECTOR = "input:not([type=checkbox]):not([type=radio]), textarea, select";

/** True while a text field has focus on a touch device, when the on-screen keyboard is likely open. */
function useEditingOnTouch() {
  const [editing, setEditing] = React.useState(false);
  React.useEffect(() => {
    const coarse = window.matchMedia("(pointer: coarse)");
    const check = () =>
      // Wait a frame so moving between fields doesn't flicker the bar.
      requestAnimationFrame(() => {
        const el = document.activeElement;
        setEditing(coarse.matches && el instanceof HTMLElement && el.matches(FIELD_SELECTOR));
      });
    document.addEventListener("focusin", check);
    document.addEventListener("focusout", check);
    return () => {
      document.removeEventListener("focusin", check);
      document.removeEventListener("focusout", check);
    };
  }, []);
  return editing;
}

function MobileActionBar({ ctx }: { ctx: FlowContext }) {
  const { hint } = actionState(ctx);
  const editing = useEditingOnTouch();
  const total = pricing(ctx.service, ctx.values)?.total;
  const line = ctx.service ? ctx.service.name : ctx.platform ? ctx.platform.name : "Nothing selected yet";
  const sub = hint ?? (total ? `Total ${total}` : ctx.service && !ctx.service.price ? "Pricing pending" : `Step ${ctx.step + 1} of ${STEPS.length}`);
  return (
    <>
      {/* Keeps the last card clear of the fixed bar */}
      <div className="h-24 xl:hidden" aria-hidden />
      <div
        inert={editing}
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-16px_rgb(32_33_39/0.25)] backdrop-blur-xl transition-transform duration-200 motion-reduce:transition-none lg:left-(--sidebar) xl:hidden rtl:lg:left-0! rtl:lg:right-(--sidebar)!",
          editing && "translate-y-full",
        )}
      >
        <div className="mx-auto flex max-w-3xl items-center gap-2.5 px-3 py-2.5 sm:gap-3 sm:px-4">
          {ctx.step > 0 ? (
            <button
              type="button"
              onClick={ctx.back}
              aria-label="Back"
              className="grid size-11 shrink-0 place-items-center rounded-full border bg-card transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none"
            >
              <ArrowLeft className="size-5 rtl:-scale-x-100" aria-hidden />
            </button>
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{line}</p>
            <p className="truncate text-xs text-muted-foreground">{sub}</p>
          </div>
          <PrimaryAction ctx={ctx} compact className="h-11 px-5" />
        </div>
      </div>
    </>
  );
}
