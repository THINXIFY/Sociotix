"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, CircleAlert, Compass, LayoutGrid, PenLine, Settings2, Sparkles, TrendingUp, type LucideIcon } from "lucide-react";
import { PlatformTile } from "@/components/brand";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { PLATFORMS } from "@/lib/catalog";
import { api } from "@/lib/live-account";
import { EMPTY_ONBOARDING, INTERESTS, type InterestId, type OnboardingPrefs, recommend, type Recommendation, cleanChoices } from "@/lib/onboarding";
import { cn } from "@/lib/utils";
import { useLiveAccount } from "./live-account";
import { dashButton, Panel, PanelHeader } from "./shared";

/*
 * Customer onboarding (ON-01). A short, skippable welcome — goals, platforms,
 * then two or three next steps — shown once after a new customer's first
 * sign-in. Live mode keeps the choices on the account (so they follow the
 * customer across devices); demo mode keeps them in this browser only and
 * never opens the flow on its own.
 */

const INTEREST_ICON: Record<InterestId, LucideIcon> = { grow: TrendingUp, content: PenLine, ai: Sparkles, manage: LayoutGrid, services: Compass };
const DEMO_KEY = "sv-demo-onboarding";
const STEPS = ["Your goals", "Your platforms", "Your starting point"] as const;

interface OnboardingContextValue {
  prefs: OnboardingPrefs;
  /** Opens the flow (from Settings or the dashboard) with the saved choices. */
  open: () => void;
}

const OnboardingContext = React.createContext<OnboardingContextValue | null>(null);
export const useOnboarding = () => React.use(OnboardingContext);

const DEMO_EVENT = "sv-demo-onboarding";
let demoCache: { raw: string | null; value: OnboardingPrefs } = { raw: null, value: EMPTY_ONBOARDING };

function readDemo(): OnboardingPrefs {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(DEMO_KEY);
  } catch {}
  if (raw === demoCache.raw) return demoCache.value;
  let value = EMPTY_ONBOARDING;
  try {
    const p = JSON.parse(raw ?? "null") as Partial<OnboardingPrefs> | null;
    if (p) value = { state: p.state === "completed" || p.state === "skipped" ? p.state : null, ...cleanChoices(p) };
  } catch {}
  demoCache = { raw, value };
  return value;
}

function subscribeDemo(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(DEMO_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(DEMO_EVENT, onChange);
  };
}

const useDemoOnboarding = () => React.useSyncExternalStore(subscribeDemo, readDemo, () => EMPTY_ONBOARDING);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const live = useLiveAccount();
  const demoPrefs = useDemoOnboarding();
  const [livePrefs, setLivePrefs] = React.useState<OnboardingPrefs>(() => live?.onboarding ?? EMPTY_ONBOARDING);
  const prefs = live ? livePrefs : demoPrefs;
  // Opens by itself only for a live customer who has never finished or skipped it. Demo mode waits to be asked.
  const [isOpen, setOpen] = React.useState(() => Boolean(live && live.onboarding.state === null));
  // Each opening mounts a fresh flow that starts on step one with the saved choices.
  const [session, setSession] = React.useState(0);

  const save = React.useCallback(
    async (action: "complete" | "skip", choices?: { interests: InterestId[]; platforms: string[] }) => {
      if (live) {
        const next = await api<OnboardingPrefs>("/api/account/onboarding", { method: "PUT", body: JSON.stringify({ action, ...choices }) });
        setLivePrefs(next);
        return;
      }
      const next: OnboardingPrefs = action === "complete" ? { state: "completed", ...cleanChoices(choices ?? {}) } : { ...prefs, state: prefs.state === "completed" ? "completed" : "skipped" };
      try {
        localStorage.setItem(DEMO_KEY, JSON.stringify(next));
      } catch {}
      window.dispatchEvent(new Event(DEMO_EVENT));
    },
    [live, prefs],
  );

  const value = React.useMemo(
    () => ({
      prefs,
      open: () => {
        setSession((n) => n + 1);
        setOpen(true);
      },
    }),
    [prefs],
  );
  return (
    <OnboardingContext value={value}>
      {children}
      <OnboardingDialog key={session} open={isOpen} onClose={() => setOpen(false)} prefs={prefs} save={save} demo={!live} />
    </OnboardingContext>
  );
}

/* -------------------------------------------------------------------------- */
/*  The flow                                                                  */
/* -------------------------------------------------------------------------- */

function OnboardingDialog({
  open,
  onClose,
  prefs,
  save,
  demo,
}: {
  open: boolean;
  onClose: () => void;
  prefs: OnboardingPrefs;
  save: (action: "complete" | "skip", choices?: { interests: InterestId[]; platforms: string[] }) => Promise<void>;
  demo: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = React.useState(0);
  const [interests, setInterests] = React.useState<InterestId[]>(prefs.interests);
  const [platforms, setPlatforms] = React.useState<string[]>(prefs.platforms);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const heading = React.useRef<HTMLHeadingElement>(null);
  const moved = React.useRef(false);
  const firstTime = prefs.state === null;

  // After Back/Continue, the new step's heading takes focus so screen readers announce it.
  React.useEffect(() => {
    if (moved.current) heading.current?.focus();
  }, [step]);

  const go = (n: number) => {
    moved.current = true;
    setStep(n);
  };

  const skip = async () => {
    onClose();
    // Skipping never blocks the dashboard: close first, then record it. If that fails, the flow simply returns next time.
    if (firstTime) await save("skip").catch(() => {});
  };

  const finish = async (href?: string) => {
    setBusy(true);
    setError(null);
    try {
      await save("complete", { interests, platforms });
      onClose();
      if (href) router.push(href);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Your choices weren't saved. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const toggle = <T extends string>(list: T[], id: T) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const recs = recommend({ interests, platforms });

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : void skip())}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "flex max-h-[min(92dvh,46rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[38rem] sm:rounded-[1.5rem]",
          // Phones: a sheet anchored to the bottom edge instead of a floating box.
          "max-sm:top-auto max-sm:bottom-0 max-sm:max-w-full max-sm:translate-y-0 max-sm:rounded-t-[1.5rem] max-sm:rounded-b-none",
          "shadow-[0_1px_0_rgb(255_255_255/0.6)_inset,0_30px_80px_-30px_rgb(32_33_39/0.55)] dark:shadow-[0_30px_80px_-24px_rgb(0_0_0/0.85)]",
        )}
      >
        {/* Header: progress, step count and Skip */}
        <div className="flex items-center gap-3 px-5 pt-5 sm:px-7 sm:pt-6">
          <ol className="flex flex-1 items-center gap-1.5" aria-label="Progress">
            {STEPS.map((label, i) => (
              <li key={label} className="flex-1" aria-current={i === step ? "step" : undefined}>
                <span className={cn("block h-1 rounded-full transition-colors duration-300 motion-reduce:transition-none", i <= step ? "bg-primary" : "bg-muted")} aria-hidden />
                <span className="sr-only">
                  {label}
                  {i < step ? ", done" : i === step ? ", current step" : ""}
                </span>
              </li>
            ))}
          </ol>
          <span className="text-xs font-medium text-muted-foreground tabular-nums">
            {step + 1} of {STEPS.length}
          </span>
          <button type="button" onClick={() => void skip()} className="-me-2 inline-flex h-11 items-center rounded-full px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none sm:h-9">
            {firstTime ? "Skip" : "Close"}
          </button>
        </div>

        <div key={step} className="min-h-0 flex-1 overflow-y-auto px-5 pt-4 pb-5 animate-in fade-in-0 slide-in-from-right-2 duration-300 motion-reduce:animate-none sm:px-7 sm:pt-5">
          {step === 0 ? (
            <>
              <p className="text-[0.7rem] font-semibold tracking-[0.14em] text-primary uppercase dark:text-[#b9a8ff]">{firstTime ? "Welcome to Sociotix" : "Your preferences"}</p>
              <DialogTitle ref={heading} tabIndex={-1} className="mt-1.5 font-heading text-[1.4rem] leading-tight font-extrabold tracking-[-0.02em] outline-none sm:text-[1.6rem]">
                What brings you here?
              </DialogTitle>
              <DialogDescription className="mt-1.5 text-[0.92rem] text-muted-foreground">Pick as many as you like. We&apos;ll suggest where to start.</DialogDescription>
              <fieldset className="mt-5">
                <legend className="sr-only">Your goals</legend>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {INTERESTS.map((it) => {
                    const on = interests.includes(it.id);
                    const Icon = INTEREST_ICON[it.id];
                    return (
                      <label
                        key={it.id}
                        className={cn(
                          "group relative flex min-h-[3.75rem] cursor-pointer items-center gap-3 rounded-2xl border bg-card px-3.5 py-3 transition-[border-color,background-color,box-shadow] duration-150 select-none has-focus-visible:ring-3 has-focus-visible:ring-primary/30 motion-reduce:transition-none",
                          on ? "border-primary/60 bg-primary/[0.06] shadow-[0_0_0_1px_var(--color-primary)] dark:bg-primary/15" : "hover:border-primary/30",
                          it.id === "services" && "sm:col-span-2",
                        )}
                      >
                        <input type="checkbox" className="sr-only" checked={on} onChange={() => setInterests((l) => toggle(l, it.id))} />
                        <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl transition-colors", on ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground dark:bg-primary/15 dark:text-[#d6ccff]")} aria-hidden>
                          <Icon className="size-4.5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[0.92rem] font-semibold">{it.label}</span>
                          <span className="block text-[0.78rem] text-muted-foreground">{it.hint}</span>
                        </span>
                        <span className={cn("grid size-5 shrink-0 place-items-center rounded-full border transition-colors", on ? "border-primary bg-primary text-primary-foreground" : "bg-background")} aria-hidden>
                          {on ? <Check className="size-3" strokeWidth={3} /> : null}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            </>
          ) : step === 1 ? (
            <>
              <DialogTitle ref={heading} tabIndex={-1} className="font-heading text-[1.4rem] leading-tight font-extrabold tracking-[-0.02em] outline-none sm:text-[1.6rem]">
                Where do you post?
              </DialogTitle>
              <DialogDescription className="mt-1.5 text-[0.92rem] text-muted-foreground">Choose your platforms, or skip this step.</DialogDescription>
              <fieldset className="mt-5">
                <legend className="sr-only">Your platforms</legend>
                <div className="grid grid-cols-2 gap-2 min-[400px]:grid-cols-3">
                  {PLATFORMS.map((p) => {
                    const on = platforms.includes(p.id);
                    return (
                      <label
                        key={p.id}
                        className={cn(
                          "relative flex min-h-11 min-w-0 cursor-pointer items-center gap-2.5 rounded-xl border bg-card px-2.5 py-2 transition-[border-color,background-color,box-shadow] duration-150 select-none has-focus-visible:ring-3 has-focus-visible:ring-primary/30 motion-reduce:transition-none",
                          on ? "border-primary/60 bg-primary/[0.06] shadow-[0_0_0_1px_var(--color-primary)] dark:bg-primary/15" : "hover:border-primary/30",
                        )}
                      >
                        <input type="checkbox" className="sr-only" checked={on} onChange={() => setPlatforms((l) => toggle(l, p.id))} />
                        <PlatformTile platform={p} size="xs" />
                        <span className="min-w-0 flex-1 truncate text-[0.85rem] font-semibold">{p.short}</span>
                        {on ? <Check className="size-3.5 shrink-0 text-primary" strokeWidth={3} aria-hidden /> : null}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            </>
          ) : (
            <>
              <DialogTitle ref={heading} tabIndex={-1} className="font-heading text-[1.4rem] leading-tight font-extrabold tracking-[-0.02em] outline-none sm:text-[1.6rem]">
                Your starting point
              </DialogTitle>
              <DialogDescription className="mt-1.5 text-[0.92rem] text-muted-foreground">
                {interests.length ? "Based on what you picked." : "A few good places to begin."} You can change this any time in Settings.
              </DialogDescription>
              <ul className="mt-5 space-y-2.5">
                {recs.map((r) => (
                  <RecommendationCard key={r.id} rec={r} onGo={() => void finish(r.href)} disabled={busy} />
                ))}
              </ul>
              {demo ? <p className="mt-3 text-xs text-muted-foreground">Demo mode: your choices stay in this browser.</p> : null}
            </>
          )}
          {error ? (
            <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/[0.06] px-3 py-2.5 text-sm">
              <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden /> {error}
            </p>
          ) : null}
        </div>

        {/* Footer: Back / Continue / Finish */}
        <div className="flex items-center justify-between gap-2 border-t bg-card/60 px-5 py-3.5 sm:px-7 dark:bg-white/[0.015]">
          {step > 0 ? (
            <button type="button" onClick={() => go(step - 1)} className={cn(dashButton.secondary, "h-11 sm:h-10")}>
              <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden /> Back
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            {step === 1 && !platforms.length ? (
              <button type="button" onClick={() => go(2)} className="inline-flex h-11 items-center rounded-full px-3 text-sm font-semibold text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none sm:h-10">
                Skip step
              </button>
            ) : null}
            {step < 2 ? (
              <button type="button" onClick={() => go(step + 1)} disabled={step === 1 && !platforms.length} className={cn(dashButton.primary, "h-11 px-5 disabled:opacity-50 disabled:hover:translate-y-0 sm:h-10", step === 1 && !platforms.length && "max-[359px]:hidden")}>
                Continue <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden />
              </button>
            ) : (
              <button type="button" onClick={() => void finish()} disabled={busy} aria-busy={busy} className={cn(dashButton.primary, "h-11 px-5 disabled:opacity-60 sm:h-10")}>
                {busy ? "Saving…" : "Go to dashboard"}
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const STATUS: Record<Recommendation["status"], { label: string; className: string }> = {
  available: { label: "Available", className: "bg-lime/50 text-graphite dark:bg-lime/15 dark:text-lime" },
  preview: { label: "Preview", className: "bg-primary/10 text-primary dark:bg-primary/20 dark:text-[#c9bcff]" },
  soon: { label: "Not activated yet", className: "bg-muted text-muted-foreground" },
};

function StatusPill({ status }: { status: Recommendation["status"] }) {
  const s = STATUS[status];
  return <span className={cn("inline-flex h-5 shrink-0 items-center rounded-full px-2 text-[0.68rem] font-semibold", s.className)}>{s.label}</span>;
}

function RecommendationCard({ rec, onGo, disabled }: { rec: Recommendation; onGo: () => void; disabled: boolean }) {
  return (
    <li className="rounded-2xl border bg-card p-4">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <h3 className="font-heading text-[0.98rem] font-bold">{rec.title}</h3>
        <StatusPill status={rec.status} />
      </div>
      <p className="mt-1 text-[0.85rem] leading-relaxed text-muted-foreground">{rec.why}</p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <span className="text-[0.75rem] text-muted-foreground">{rec.note}</span>
        <button type="button" onClick={onGo} disabled={disabled} className={cn(dashButton.secondary, "h-11 sm:h-9")}>
          {rec.cta} <ArrowRight className="size-3.5 rtl:-scale-x-100" aria-hidden />
        </button>
      </div>
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/*  Dashboard: suggestions from the customer's own choices                    */
/* -------------------------------------------------------------------------- */

/** Shown only once the customer has told us their goals or platforms; otherwise the dashboard is unchanged. */
export function ForYouPanel({ className, style }: { className?: string; style?: React.CSSProperties }) {
  const ctx = useOnboarding();
  if (!ctx) return null;
  const { prefs, open } = ctx;
  if (!prefs.interests.length && !prefs.platforms.length) return null;
  const recs = recommend(prefs);
  const goals = INTERESTS.filter((i) => prefs.interests.includes(i.id)).map((i) => i.label);
  return (
    <Panel className={cn("p-4 sm:p-5", className)} style={style} aria-labelledby="for-you-title">
      <PanelHeader
        id="for-you-title"
        title="Suggested for you"
        description={goals.length ? `Based on your goals: ${goals.join(", ")}.` : "Based on the platforms you chose."}
        action={
          <button type="button" onClick={open} className={cn(dashButton.ghost, "h-11 sm:h-8")}>
            <Settings2 className="size-3.5" aria-hidden /> Edit
          </button>
        }
      />
      <ul className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-3">
        {recs.map((r) => (
          <li key={r.id}>
            <Link href={r.href} className="group flex h-full flex-col rounded-xl border bg-background/60 p-3.5 transition-[border-color,box-shadow] duration-150 hover:border-primary/35 hover:shadow-[0_12px_28px_-22px_rgb(112_71_235/0.6)] focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none motion-reduce:transition-none dark:bg-white/[0.02]">
              <span className="flex items-start justify-between gap-2">
                <span className="text-[0.9rem] font-semibold">{r.title}</span>
                <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-[color,translate] group-hover:translate-x-0.5 group-hover:text-primary motion-reduce:transition-none rtl:-scale-x-100" aria-hidden />
              </span>
              <span className="mt-1 flex-1 text-[0.8rem] leading-relaxed text-muted-foreground">{r.why}</span>
              <span className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <StatusPill status={r.status} />
                <span className="text-[0.72rem] text-muted-foreground">{r.note}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/** Settings entry point: reopens the flow with the saved choices. */
export function OnboardingSettingsButton({ className, children }: { className?: string; children: React.ReactNode }) {
  const ctx = useOnboarding();
  if (!ctx) return null;
  return (
    <button type="button" onClick={ctx.open} className={className}>
      {children}
    </button>
  );
}
