"use client";

import * as React from "react";
import Link from "next/link";
import { ThemeProvider } from "next-themes";
import { MotionConfig } from "motion/react";
import { ArrowRight, Clock3, Lock, X } from "lucide-react";
import { PlatformTile } from "@/components/brand";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PLATFORM_BY_ID, type ServiceCategory, type ServiceStatus } from "@/lib/catalog";

/** Marketplace service quick-view: platform, type and real pricing state, with Configure order as the next step. */
function ServiceQuickView({ info, service, onClose }: { info: PreviewInfo; service: NonNullable<PreviewInfo["service"]>; onClose: () => void }) {
  const platform = PLATFORM_BY_ID[service.platformId];
  return (
    <DialogContent showCloseButton={false} className="grid-cols-[minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:max-w-[26rem]">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute end-3 top-3 grid size-9 place-items-center rounded-full text-muted-foreground transition-colors after:absolute after:-inset-1 hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none"
      >
        <X className="size-4" aria-hidden />
      </button>
      <div className="p-5 pe-12 sm:p-6 sm:pe-12">
        <div className="flex items-center gap-3.5">
          {platform ? <PlatformTile platform={platform} size="md" className="size-12 shrink-0 rounded-2xl" /> : null}
          <div className="min-w-0">
            <DialogTitle className="font-heading text-[1.15rem] leading-snug font-extrabold tracking-tight">{info.title}</DialogTitle>
            <p className="mt-0.5 truncate text-[0.82rem] text-muted-foreground">
              {platform?.name} · {service.category}
            </p>
          </div>
        </div>
        <DialogDescription className="mt-4 text-[0.92rem] leading-relaxed text-foreground/80">{service.description}</DialogDescription>
        <dl className="mt-4 grid grid-cols-1 divide-y overflow-hidden rounded-xl border bg-muted/30 min-[380px]:grid-cols-3 min-[380px]:divide-x min-[380px]:divide-y-0 min-[380px]:text-center rtl:min-[380px]:divide-x-reverse">
          {[
            ["Platform", platform?.short ?? "—"],
            ["Type", service.category],
            ["Pricing", service.price ?? "Pending"],
          ].map(([k, v]) => (
            <div key={k} className="flex min-w-0 items-baseline justify-between gap-3 px-3 py-2 min-[380px]:block min-[380px]:px-2 min-[380px]:py-2.5">
              <dt className="text-[0.66rem] font-semibold tracking-wider text-muted-foreground uppercase">{k}</dt>
              <dd className={k === "Pricing" && !service.price ? "mt-0.5 truncate text-[0.82rem] font-semibold text-muted-foreground" : "mt-0.5 truncate text-[0.82rem] font-semibold"}>{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3.5 flex items-start gap-2 text-[0.78rem] leading-relaxed text-muted-foreground">
          <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {service.price ? "You can configure the order now. Checkout opens soon — nothing is charged yet." : "You can configure the order now. Ordering opens once verified pricing is available — nothing is charged."}
        </p>
      </div>
      <div className="grid grid-cols-[auto_1fr] gap-2 border-t bg-muted/40 px-5 py-3.5 sm:px-6">
        <Button variant="ghost" className="h-11 rounded-full px-4 sm:h-10 sm:px-5" onClick={onClose}>
          Close
        </Button>
        {info.action ? (
          <Link
            href={info.action.href}
            onClick={onClose}
            className="group inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold whitespace-nowrap sm:px-5 text-primary-foreground shadow-[0_10px_24px_-14px_rgb(112_71_235/0.9)] transition-[background-color,translate] hover:-translate-y-px hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-primary/35 focus-visible:outline-none active:translate-y-0 motion-reduce:hover:translate-y-0 sm:h-10"
          >
            {info.action.label}
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none rtl:-scale-x-100" aria-hidden />
          </Link>
        ) : null}
      </div>
    </DialogContent>
  );
}

/* -------------------------------------------------------------------------- */
/*  Preview dialog — stands in for pages that don't exist yet                 */
/* -------------------------------------------------------------------------- */

export interface PreviewInfo {
  title: string;
  description?: string;
  /** Optional next step that leads to a page that already exists. */
  action?: { label: string; href: string };
  /** A catalog service: shows the service quick-view instead of the generic preview. */
  service?: { platformId: string; category: string; description: string; price: string | null };
}

const PreviewContext = React.createContext<(info: PreviewInfo) => void>(() => {});

export const usePreview = () => React.useContext(PreviewContext);

function PreviewProvider({ children }: { children: React.ReactNode }) {
  const [info, setInfo] = React.useState<PreviewInfo | null>(null);
  const [open, setOpen] = React.useState(false);

  const show = React.useCallback((next: PreviewInfo) => {
    setInfo(next);
    setOpen(true);
  }, []);

  return (
    <PreviewContext.Provider value={show}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        {info?.service ? (
          <ServiceQuickView info={info} service={info.service} onClose={() => setOpen(false)} />
        ) : (
        <DialogContent className="gap-5 p-6 sm:max-w-md">
          <DialogHeader className="gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-secondary text-secondary-foreground">
              <Clock3 className="size-5" aria-hidden />
            </span>
            <DialogTitle className="text-lg font-semibold">{info?.title}</DialogTitle>
            <DialogDescription className="leading-relaxed">
              {info?.description ??
                "This part of Sociotix isn't available yet."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="-mx-6 -mb-6 rounded-b-xl px-6">
            {info?.action ? (
              <>
                <Button variant="ghost" className="h-9 rounded-full px-4" onClick={() => setOpen(false)}>
                  Close
                </Button>
                <Link
                  href={info.action.href}
                  onClick={() => setOpen(false)}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  {info.action.label}
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </>
            ) : (
              <Button className="h-9 rounded-full px-4" onClick={() => setOpen(false)}>
                Got it
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
        )}
      </Dialog>
    </PreviewContext.Provider>
  );
}

/* -------------------------------------------------------------------------- */
/*  Marketplace filters — shared so other sections can deep-link into them    */
/* -------------------------------------------------------------------------- */

export type CategoryFilter = ServiceCategory | "all";
export type StatusFilter = ServiceStatus | "all";

interface CatalogFilters {
  platform: string;
  category: CategoryFilter;
  status: StatusFilter;
  query: string;
}

interface CatalogFilterContextValue extends CatalogFilters {
  update: (patch: Partial<CatalogFilters>) => void;
  reset: () => void;
  /** Apply filters, then scroll the marketplace into view. */
  explore: (patch?: Partial<CatalogFilters>) => void;
}

const DEFAULT_FILTERS: CatalogFilters = {
  platform: "all",
  category: "all",
  status: "all",
  query: "",
};

const CatalogFilterContext = React.createContext<CatalogFilterContextValue | null>(null);

export function useCatalogFilters() {
  const ctx = React.useContext(CatalogFilterContext);
  if (!ctx) throw new Error("useCatalogFilters must be used inside <Providers>");
  return ctx;
}

function CatalogFilterProvider({ children }: { children: React.ReactNode }) {
  const [filters, setFilters] = React.useState<CatalogFilters>(DEFAULT_FILTERS);

  const value = React.useMemo<CatalogFilterContextValue>(
    () => ({
      ...filters,
      update: (patch) => setFilters((f) => ({ ...f, ...patch })),
      reset: () => setFilters(DEFAULT_FILTERS),
      explore: (patch) => {
        setFilters({ ...DEFAULT_FILTERS, ...patch });
        requestAnimationFrame(() =>
          document.getElementById("services")?.scrollIntoView({ block: "start" }),
        );
      },
    }),
    [filters],
  );

  return <CatalogFilterContext.Provider value={value}>{children}</CatalogFilterContext.Provider>;
}

/* -------------------------------------------------------------------------- */

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      <MotionConfig reducedMotion="user">
        <PreviewProvider>
          <CatalogFilterProvider>{children}</CatalogFilterProvider>
        </PreviewProvider>
      </MotionConfig>
    </ThemeProvider>
  );
}
