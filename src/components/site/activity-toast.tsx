"use client";

import * as React from "react";
import { X } from "lucide-react";
import { PlatformTile } from "@/components/brand";
import { PLATFORM_BY_ID, SERVICES } from "@/lib/catalog";
import { cn } from "@/lib/utils";

/*
 * Homepage illustrative activity: fictional people and real catalog services,
 * always labelled "Illustrative" and never worded as a purchase. Homepage only.
 */

// 80 fictional names: 30 USA · 10 UAE · 10 India/Pakistan · 10 Russia · 20 elsewhere.
const NAMES = [
  "Emily R.", "Jacob M.", "Madison T.", "Ethan W.", "Olivia H.", "Noah B.", "Ava C.", "Liam P.", "Sophia K.", "Mason D.",
  "Isabella G.", "Logan S.", "Mia F.", "Lucas J.", "Harper L.", "Aiden N.", "Abigail V.", "Carter Q.", "Ella Y.", "Jackson Z.",
  "Grace A.", "Wyatt E.", "Chloe O.", "Owen U.", "Lily I.", "Caleb X.", "Zoey R.", "Hunter M.", "Nora T.", "Dylan W.",
  "Omar A.", "Fatima K.", "Khalid M.", "Mariam S.", "Rashid H.", "Noura B.", "Yousef D.", "Layla F.", "Hamdan R.", "Aisha J.",
  "Arjun P.", "Priya S.", "Rohan M.", "Ananya K.", "Vikram R.", "Ayesha K.", "Bilal A.", "Hira S.", "Usman T.", "Zainab M.",
  "Dmitri V.", "Anastasia P.", "Ivan K.", "Ekaterina S.", "Alexei M.", "Olga N.", "Nikolai B.", "Svetlana R.", "Mikhail T.", "Daria L.",
  "Lucas S.", "Camila R.", "Mateo G.", "Sofia M.", "Léa D.", "Hugo B.", "Hannah W.", "Jonas K.", "Giulia C.", "Marco F.",
  "Yuki T.", "Haruto S.", "Min-jun K.", "Seo-yeon P.", "Chloé L.", "Thabo N.", "Amara O.", "Isla M.", "Jack T.", "Ana P.",
];
const VERBS = ["Interested in", "Exploring", "Viewing", "Comparing"];
// Popular catalog services first, so the scenarios stay relevant.
const POOL = SERVICES.filter((s) => s.featured).concat(SERVICES.filter((s) => !s.featured).slice(0, 24));

const FIRST_MS = 5000;
const SHOW_MS = 5000;
const OUT_MS = 300;
const delay = () => 30_000 + Math.random() * 60_000;
/** A random index that differs from the last one, so nothing repeats back to back. */
const pick = (n: number, last: number) => {
  const i = Math.floor(Math.random() * (n - 1));
  return last < 0 ? Math.floor(Math.random() * n) : i >= last ? i + 1 : i;
};

type Item = { name: string; verb: string; serviceId: string };

export function ActivityToast() {
  const [item, setItem] = React.useState<Item | null>(null);
  const [shown, setShown] = React.useState(false);
  const dismissRef = React.useRef<() => void>(() => {});

  React.useEffect(() => {
    let timers: number[] = [];
    let lastName = -1;
    let lastService = -1;
    // The first toast comes 5 s after the page opens; later ones 30–90 s after the previous one leaves.
    let shownOnce = false;
    const later = (fn: () => void, ms: number) => void timers.push(window.setTimeout(fn, ms));
    const clear = () => {
      timers.forEach((t) => window.clearTimeout(t));
      timers = [];
    };
    const hide = () => {
      setShown(false);
      later(() => {
        setItem(null);
        schedule();
      }, OUT_MS);
    };
    function schedule(wait?: number) {
      clear(); // never more than one pending toast
      later(() => {
        // Never over an open dialog: it would pull focus and attention away. Try again shortly.
        if (document.querySelector("[role=dialog]")) return schedule(2_000);
        shownOnce = true;
        lastName = pick(NAMES.length, lastName);
        lastService = pick(POOL.length, lastService);
        setItem({ name: NAMES[lastName], verb: VERBS[Math.floor(Math.random() * VERBS.length)], serviceId: POOL[lastService].id });
        // Next frame, so the enter transition runs.
        requestAnimationFrame(() => setShown(true));
        later(hide, SHOW_MS);
      }, wait ?? (shownOnce ? delay() : FIRST_MS));
    }
    dismissRef.current = () => {
      clear();
      hide();
    };
    // Hidden tabs pause the rotation; coming back starts a fresh wait.
    const onVisibility = () => {
      clear();
      setShown(false);
      setItem(null);
      if (document.visibilityState === "visible") schedule();
    };
    document.addEventListener("visibilitychange", onVisibility);
    if (document.visibilityState === "visible") schedule();
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      clear();
    };
  }, []);

  const service = item ? POOL.find((s) => s.id === item.serviceId) : null;
  const platform = service ? PLATFORM_BY_ID[service.platformId] : null;

  return (
    <div data-activity-toast role="status" aria-live="polite" className="pointer-events-none fixed start-4 bottom-[calc(env(safe-area-inset-bottom)+1rem)] z-40 w-[min(270px,calc(100vw-2rem))]">
      {item && service && platform ? (
        <div
          className={cn(
            "pointer-events-auto flex min-h-14 items-center gap-2.5 rounded-xl border bg-card/95 py-2 ps-2 pe-1 shadow-[0_12px_32px_-16px_rgb(32_33_39/0.45)] backdrop-blur-md transition-[opacity,translate] duration-300 ease-out motion-reduce:translate-y-0 motion-reduce:transition-opacity dark:shadow-[0_12px_32px_-12px_rgb(0_0_0/0.7)]",
            shown ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
          )}
        >
          <PlatformTile platform={platform} size="sm" className="size-8 shrink-0 rounded-lg" />
          <p className="min-w-0 flex-1 leading-tight">
            <span className="flex items-center gap-1.5">
              <span className="truncate text-[0.8rem] font-semibold">{item.name}</span>
              <span className="shrink-0 rounded-full bg-primary/[0.08] px-1.5 text-[0.6rem] font-semibold text-primary dark:bg-primary/20 dark:text-[#c9bcff]">Illustrative</span>
            </span>
            <span className="mt-0.5 block truncate text-[0.74rem] text-muted-foreground">
              {item.verb} <span className="font-medium text-foreground/80">{service.name}</span>
            </span>
          </p>
          <button
            type="button"
            onClick={() => dismissRef.current()}
            aria-label="Dismiss"
            className="relative grid size-7 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors after:absolute after:-inset-2 hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </div>
      ) : null}
    </div>
  );
}
