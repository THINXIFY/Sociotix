"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CircleHelp, LayoutDashboard, type LucideIcon, Search, ShoppingBag, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * Guided tours (UX-02). Short, optional walkthroughs that only ever start when
 * the customer asks (a "?" button or Settings) — never on their own, so they
 * can't collide with onboarding or interrupt a returning customer. Steps point
 * at elements marked `data-tour`; anything hidden or missing on this screen
 * size is skipped. Completed tours are remembered in this browser only.
 */

export type TourId = "dashboard" | "new-order" | "ai" | "search";

interface TourStep {
  /** CSS selector; the first visible match is highlighted. Null shows the card on its own. */
  target: string | null;
  title: string;
  body: React.ReactNode;
}

interface Tour {
  id: TourId;
  name: string;
  summary: string;
  /** Where the tour runs. */
  path: string;
  steps: TourStep[];
  /** Optional last action, e.g. "Try search now". */
  finish?: { label: string; run: () => void };
}

const Kbd = ({ children }: { children: React.ReactNode }) => <kbd className="mx-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded border bg-muted px-1 font-sans text-[0.68rem] font-semibold text-foreground">{children}</kbd>;

const openSearch = () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }));

export const TOURS: Record<TourId, Tour> = {
  dashboard: {
    id: "dashboard",
    name: "Dashboard tour",
    summary: "Navigation, New Order, your wallet, AI tools and notifications.",
    path: "/dashboard",
    steps: [
      { target: '[data-tour="nav"]', title: "Find your way around", body: "Orders, wallet, support and your account live here. On phones, the main pages sit in the bar at the bottom." },
      { target: '[data-tour="new-order"]', title: "Start a new order", body: "Choose a platform and a service, then set it up. Ordering isn't open yet, so you can explore everything without being charged." },
      { target: '[data-tour="wallet"]', title: "Your wallet", body: "Your balance, straight from your account ledger. Adding funds opens together with checkout." },
      { target: '[data-tour="ai"]', title: "Sociotix AI", body: "Your AI and social workspaces. AI generation isn't switched on yet. You can already see how each tool will work." },
      { target: '[data-tour="notifications"]', title: "Notifications", body: "Order updates, support replies and security alerts show up here." },
      { target: '[data-tour="search"]', title: "Search everything", body: <>Find services, tools, pages and help. Press <Kbd>Ctrl</Kbd><Kbd>K</Kbd> (<Kbd>⌘</Kbd><Kbd>K</Kbd> on Mac) from any page.</> },
    ],
  },
  "new-order": {
    id: "new-order",
    name: "New Order tour",
    summary: "The four ordering steps and what's open today.",
    path: "/dashboard/new-order",
    steps: [
      { target: 'nav[aria-label="Order progress"]', title: "Four quick steps", body: "Platform, Service, Configure and Review. You can jump back to any step you've already reached." },
      { target: 'section[aria-labelledby="step-title"]', title: "Choose what you need", body: "Pick a platform first, then a service. Search and filters help you narrow it down." },
      { target: 'aside[aria-label="Order summary"]', title: "Configure and review", body: "Add the link and quantity on the Configure step. Your choices build up here, with what to know before ordering." },
      { target: null, title: "Ordering isn't open yet", body: "Checkout opens once services pass every review. You can set up an order today, and nothing is charged until checkout opens." },
    ],
  },
  ai: {
    id: "ai",
    name: "AI tools tour",
    summary: "The brief, examples, options and where results appear.",
    path: "/ai-tools/hashtag-keyword-finder",
    steps: [
      { target: '[data-tour="ai-composer"]', title: "Describe what you need", body: "A sentence or two about your post or brand is enough. The counter shows how much room you have." },
      { target: '[data-tour="ai-examples"]', title: "Start from an example", body: "Tap an example to fill the form and see what a good brief looks like." },
      { target: '[data-tour="ai-customize"]', title: "Make it yours", body: "Pick platforms, tone and other options. Some tools have more under More options." },
      { target: '[data-tour="ai-generate"]', title: "Generate", body: "AI generation isn't switched on yet, so this button stays disabled. When it opens, each run uses one of your free daily runs." },
      { target: '[data-tour="ai-results"]', title: "Your results", body: "Results appear here, grouped and ready to copy. Nothing is posted or saved for you." },
    ],
  },
  search: {
    id: "search",
    name: "Search tour",
    summary: "Ctrl/⌘ K, searching and keyboard shortcuts.",
    path: "/dashboard",
    steps: [
      { target: '[data-tour="search"]', title: "Search from anywhere", body: <>Click here, or press <Kbd>Ctrl</Kbd><Kbd>K</Kbd> (<Kbd>⌘</Kbd><Kbd>K</Kbd> on Mac) on any dashboard page.</> },
      { target: null, title: "Type anything", body: "A platform (Instagram), a service (followers), an AI tool (captions), a page (wallet) or a question (refunds). Results are grouped as you type." },
      { target: null, title: "Keyboard friendly", body: <>Use <Kbd>↑</Kbd><Kbd>↓</Kbd> to move, <Kbd>Enter</Kbd> to open and <Kbd>Esc</Kbd> to close. Services open New Order with the service already chosen.</> },
    ],
    finish: { label: "Try search now", run: openSearch },
  },
};

/* ── Remembered in this browser ─────────────────────────────────────────── */

const DONE_KEY = "sv-tours-done";
const EVENT = "sv-start-tour";

function readDone(): TourId[] {
  try {
    const v = JSON.parse(localStorage.getItem(DONE_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is TourId => typeof x === "string" && x in TOURS) : [];
  } catch {
    return [];
  }
}
function markDone(id: TourId) {
  try {
    localStorage.setItem(DONE_KEY, JSON.stringify([...new Set([...readDone(), id])]));
  } catch {}
  window.dispatchEvent(new Event(DONE_KEY));
}
const subscribeDone = (cb: () => void) => {
  window.addEventListener(DONE_KEY, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(DONE_KEY, cb);
    window.removeEventListener("storage", cb);
  };
};
let doneCache = { raw: "", value: [] as TourId[] };
function doneSnapshot() {
  let raw = "";
  try {
    raw = localStorage.getItem(DONE_KEY) ?? "";
  } catch {}
  if (raw !== doneCache.raw) doneCache = { raw, value: readDone() };
  return doneCache.value;
}
const NONE: TourId[] = [];
export const useCompletedTours = () => React.useSyncExternalStore(subscribeDone, doneSnapshot, () => NONE);

/** Starts a tour: right here if this is its page, otherwise on its page (`?tour=`). */
export function useStartTour() {
  const router = useRouter();
  return React.useCallback(
    (id: TourId) => {
      const tour = TOURS[id];
      const here = id === "ai" ? location.pathname.startsWith("/ai-tools/") : location.pathname === tour.path;
      if (here) window.dispatchEvent(new CustomEvent(EVENT, { detail: id }));
      else router.push(`${tour.path}?tour=${id}`);
    },
    [router],
  );
}

/* ── The tour itself ────────────────────────────────────────────────────── */

const visible = (el: Element | null): el is HTMLElement => {
  if (!(el instanceof HTMLElement)) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
};
const find = (selector: string) => [...document.querySelectorAll(selector)].find(visible) ?? null;

const TOUR_ICON: Record<TourId, LucideIcon> = { dashboard: LayoutDashboard, "new-order": ShoppingBag, ai: Sparkles, search: Search };

type Side = "top" | "bottom" | "left" | "right";
interface Placement {
  style: React.CSSProperties;
  /** Where the card sits relative to the highlight, for the pointer; null when docked or centred. */
  side: Side | null;
  /** Pointer offset along the card edge, in px. */
  arrow: number;
}

const GAP = 14;
const EDGE = 16;
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

/** Beside the highlight when there's room (below, above, right, left), else the free corner; docked on phones. */
function place(rect: DOMRect | null, vw: number, vh: number, cardW: number, cardH: number, pad: number): Placement {
  if (!rect) return { style: { left: (vw - cardW) / 2, top: Math.max(EDGE, (vh - cardH) / 2), width: cardW }, side: null, arrow: 0 };
  if (vw < 640) {
    // Phones: dock to whichever edge the highlight isn't near.
    const lower = rect.top + rect.height / 2 > vh / 2;
    return { style: lower ? { left: 12, right: 12, top: 12 } : { left: 12, right: 12, bottom: "calc(12px + env(safe-area-inset-bottom))" }, side: null, arrow: 0 };
  }
  const t = { top: rect.top - pad, bottom: rect.bottom + pad, left: rect.left - pad, right: rect.right + pad };
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const hLeft = clamp(cx - cardW / 2, EDGE, vw - cardW - EDGE);
  const vTop = clamp(cy - cardH / 2, EDGE, vh - cardH - EDGE);
  const arrowX = clamp(cx - hLeft, 22, cardW - 22);
  const arrowY = clamp(cy - vTop, 22, cardH - 22);
  if (t.bottom + GAP + cardH <= vh - EDGE) return { style: { left: hLeft, top: t.bottom + GAP, width: cardW }, side: "bottom", arrow: arrowX };
  if (t.top - GAP - cardH >= EDGE) return { style: { left: hLeft, top: t.top - GAP - cardH, width: cardW }, side: "top", arrow: arrowX };
  if (t.right + GAP + cardW <= vw - EDGE) return { style: { left: t.right + GAP, top: vTop, width: cardW }, side: "right", arrow: arrowY };
  if (t.left - GAP - cardW >= EDGE) return { style: { left: t.left - GAP - cardW, top: vTop, width: cardW }, side: "left", arrow: arrowY };
  // A very large highlight (e.g. a whole step panel): the corner furthest from its centre.
  return { style: { bottom: EDGE, width: cardW, ...(cx < vw / 2 ? { right: EDGE } : { left: EDGE }) }, side: null, arrow: 0 };
}

function GuidedTour({ tour, onClose }: { tour: Tour; onClose: () => void }) {
  // Steps whose element isn't on this screen (e.g. the sidebar on a phone) are skipped.
  const [steps] = React.useState(() => tour.steps.filter((s) => !s.target || find(s.target)));
  const [i, setI] = React.useState(0);
  const [rect, setRect] = React.useState<DOMRect | null>(null);
  const [cardH, setCardH] = React.useState(200);
  const [vw, setVw] = React.useState(() => window.innerWidth);
  const [vh, setVh] = React.useState(() => window.innerHeight);
  const card = React.useRef<HTMLDivElement>(null);
  const heading = React.useRef<HTMLHeadingElement>(null);
  const restore = React.useRef<Element | null>(null);
  const step = steps[i];
  const last = i === steps.length - 1;
  const Icon = TOUR_ICON[tour.id];

  React.useEffect(() => {
    restore.current = document.activeElement;
    return () => (restore.current as HTMLElement | null)?.focus?.();
  }, []);

  // Bring the element into view, then follow it (scrolling, resizing, animations) until the step changes.
  React.useEffect(() => {
    const el = step?.target ? find(step.target) : null;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el?.scrollIntoView({ block: "center", inline: "nearest", behavior: reduce ? "auto" : "smooth" });
    let frame = 0;
    let prev = "";
    const tick = () => {
      const r = el && visible(el) ? el.getBoundingClientRect() : null;
      const key = r ? `${r.x},${r.y},${r.width},${r.height}` : "none";
      if (key !== prev) {
        prev = key;
        setRect(r);
      }
      setVw(window.innerWidth);
      setVh(window.innerHeight);
      if (card.current) setCardH(card.current.offsetHeight);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    heading.current?.focus();
    return () => cancelAnimationFrame(frame);
  }, [step]);

  const close = (completed: boolean) => {
    markDone(tour.id);
    onClose();
    if (completed) tour.finish?.run();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close(false);
    } else if (e.key === "ArrowRight" && !last) setI(i + 1);
    else if (e.key === "ArrowLeft" && i > 0) setI(i - 1);
    else if (e.key === "Tab" && card.current) {
      // Keep focus inside the card while the tour is open.
      const f = [...card.current.querySelectorAll<HTMLElement>("button, [tabindex='-1']")].filter((x) => !x.hasAttribute("disabled"));
      const first = f[0];
      const end = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        end.focus();
      } else if (!e.shiftKey && document.activeElement === end) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  if (!step) return null;

  const pad = 6;
  const cardW = Math.min(340, vw - 24);
  const { style, side, arrow } = place(rect, vw, vh, cardW, cardH, pad);
  // The pointer: a small rotated square on the card edge facing the highlight.
  const pointer: React.CSSProperties | null =
    side === "bottom" ? { top: -6, left: arrow - 6 } : side === "top" ? { bottom: -6, left: arrow - 6 } : side === "right" ? { left: -6, top: arrow - 6 } : side === "left" ? { right: -6, top: arrow - 6 } : null;
  const pointerBorder = side === "bottom" ? "border-s border-t" : side === "top" ? "border-e border-b" : side === "right" ? "border-s border-b" : "border-e border-t";

  return createPortal(
    <div className="fixed inset-0 z-[70]" onKeyDown={onKeyDown}>
      {/* Dims the page and rings the highlighted element; clicks outside the card do nothing. */}
      {rect ? (
        <div
          aria-hidden
          className="pointer-events-none fixed rounded-[14px] shadow-[0_0_0_9999px_rgb(32_33_39/0.55),0_0_0_6px_rgb(112_71_235/0.18)] ring-2 ring-primary transition-[left,top,width,height] duration-300 ease-out motion-reduce:transition-none dark:shadow-[0_0_0_9999px_rgb(0_0_0/0.65),0_0_0_6px_rgb(112_71_235/0.28)]"
          style={{ left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }}
        />
      ) : (
        <div aria-hidden className="fixed inset-0 bg-graphite/55 transition-opacity dark:bg-black/65" />
      )}
      <div
        ref={card}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        className="fixed rounded-2xl border bg-popover text-popover-foreground shadow-[0_24px_60px_-18px_rgb(32_33_39/0.55)] transition-[left,top] duration-300 ease-out animate-in fade-in-0 zoom-in-95 motion-reduce:animate-none motion-reduce:transition-none dark:shadow-[0_24px_60px_-14px_rgb(0_0_0/0.85)]"
        style={style}
      >
        {pointer ? <span aria-hidden className={cn("absolute size-3 rotate-45 bg-popover", pointerBorder)} style={pointer} /> : null}
        <div className="relative p-4 sm:p-5">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary dark:bg-primary/20 dark:text-[#c9bcff]" aria-hidden>
              <Icon className="size-4" />
            </span>
            <p className="min-w-0 flex-1 truncate text-[0.72rem] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
              {tour.name} <span className="font-medium tracking-normal normal-case tabular-nums">· {i + 1} of {steps.length}</span>
            </p>
            <button type="button" onClick={() => close(false)} aria-label="Close tour" className="-me-1.5 grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none sm:size-8">
              <X className="size-4" aria-hidden />
            </button>
          </div>

          <div key={i} className="animate-in fade-in-0 slide-in-from-bottom-1 duration-200 motion-reduce:animate-none">
            <h2 id="tour-title" ref={heading} tabIndex={-1} className="mt-3 font-heading text-[1.05rem] leading-snug font-bold outline-none">
              {step.title}
            </h2>
            <p id="tour-body" className="mt-1.5 text-[0.9rem] leading-relaxed text-muted-foreground">
              {step.body}
            </p>
          </div>

          <ol className="mt-4 flex gap-1" aria-hidden>
            {steps.map((s, n) => (
              <li key={s.title} className={cn("h-1 flex-1 rounded-full transition-colors duration-300 motion-reduce:transition-none", n < i ? "bg-lime" : n === i ? "bg-primary" : "bg-muted")} />
            ))}
          </ol>

          <div className="mt-4 flex items-center justify-between gap-2">
            {i > 0 ? (
              <button type="button" onClick={() => setI(i - 1)} className="inline-flex h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-foreground/75 hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none sm:h-9 sm:-ms-2">
                <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden /> Back
              </button>
            ) : (
              <button type="button" onClick={() => close(false)} className="inline-flex h-11 items-center rounded-full px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none sm:h-9 sm:-ms-2">
                Skip tour
              </button>
            )}
            <button
              type="button"
              onClick={() => (last ? close(true) : setI(i + 1))}
              className="inline-flex h-11 items-center gap-1.5 rounded-full bg-primary px-4.5 text-sm font-semibold text-primary-foreground shadow-[0_8px_20px_-10px_rgb(112_71_235/0.9)] hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-primary/35 focus-visible:outline-none sm:h-9"
            >
              {last ? (tour.finish?.label ?? "Finish") : "Next"}
              {last ? null : <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden />}
            </button>
          </div>
          <p className="mt-3 hidden text-center text-[0.68rem] text-muted-foreground/80 sm:block" aria-hidden>
            <Kbd>←</Kbd>
            <Kbd>→</Kbd> to move · <Kbd>Esc</Kbd> to close
          </p>
        </div>
      </div>
      <span className="sr-only" aria-live="polite">{`${tour.name}, step ${i + 1} of ${steps.length}: ${step.title}`}</span>
    </div>,
    document.body,
  );
}

/**
 * Runs tours for this part of the app. Starts only on request: a `?tour=` link (from Settings) or a "?" button.
 * Waits for other dialogs (e.g. onboarding) to close first.
 */
export function TourHost({ tours }: { tours: TourId[] }) {
  const [active, setActive] = React.useState<TourId | null>(null);
  const allowed = React.useRef(tours);
  const pathname = usePathname();

  const start = React.useCallback((id: TourId) => {
    if (!allowed.current.includes(id)) return;
    let tries = 0;
    // Let the page settle and any open dialog close, then begin.
    const attempt = () => {
      tries += 1;
      if (document.querySelector('[role="dialog"]') && tries < 40) return void window.setTimeout(attempt, 250);
      setActive(id);
    };
    window.setTimeout(attempt, 300);
  }, []);

  React.useEffect(() => {
    const onEvent = (e: Event) => start((e as CustomEvent<TourId>).detail);
    window.addEventListener(EVENT, onEvent);
    return () => window.removeEventListener(EVENT, onEvent);
  }, [start]);

  // A `?tour=` link (from Settings) — checked on every page change, since the dashboard shell stays mounted while you move around.
  React.useEffect(() => {
    const url = new URL(location.href);
    const id = url.searchParams.get("tour") as TourId | null;
    if (!id || !(id in TOURS) || !allowed.current.includes(id)) return;
    url.searchParams.delete("tour");
    history.replaceState(history.state, "", url.pathname + url.search + url.hash);
    start(id);
  }, [pathname, start]);

  return active ? <GuidedTour key={active} tour={TOURS[active]} onClose={() => setActive(null)} /> : null;
}

/** A discreet "?" that offers this page's tour. */
export function TourHelpButton({ tour, className }: { tour: TourId; className?: string }) {
  const startTour = useStartTour();
  return (
    <button
      type="button"
      onClick={() => startTour(tour)}
      aria-label={`Take the ${TOURS[tour].name.toLowerCase()}`}
      title={`Take the ${TOURS[tour].name.toLowerCase()}`}
      className={cn("relative grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors after:absolute after:-inset-1.5 hover:bg-muted hover:text-primary focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none", className)}
    >
      <CircleHelp className="size-[1.05rem]" aria-hidden />
    </button>
  );
}
