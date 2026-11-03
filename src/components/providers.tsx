"use client";

import * as React from "react";
import Link from "next/link";
import { ThemeProvider } from "next-themes";
import { MotionConfig } from "motion/react";
import { ArrowRight, Clock3, X } from "lucide-react";
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

/** Marketplace service quick-view: platform, type and real pricing state, with Get Started as the next step. */
function ServiceQuickView({ info, service, onClose }: { info: PreviewInfo; service: NonNullable<PreviewInfo["service"]>; onClose: () => void }) {
  const platform = PLATFORM_BY_ID[service.platformId];
  const priced = Boolean(service.price);
  const rows: [string, React.ReactNode][] = [
    ["Platform", platform?.name ?? "—"],
    ["Type", service.category],
    [
      "Pricing",
      <span key="p" className="inline-flex items-center gap-1.5">
        <span className={priced ? "size-1.5 rounded-full bg-ok" : "size-1.5 rounded-full bg-soon"} aria-hidden />
        {service.price ?? "Being verified"}
      </span>,
    ],
  ];
  return (
    <DialogContent
      showCloseButton={false}
      className="grid-cols-[minmax(0,1fr)] gap-0 overflow-hidden rounded-[1.25rem] border-border/70 p-0 shadow-[0_1px_0_rgb(255_255_255/0.6)_inset,0_24px_64px_-24px_rgb(32_33_39/0.45)] sm:max-w-[25rem] dark:shadow-[0_24px_64px_-20px_rgb(0_0_0/0.8)]"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute end-3.5 top-3.5 grid size-9 place-items-center rounded-full text-muted-foreground/80 transition-colors after:absolute after:-inset-1 hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none"
      >
        <X className="size-4" aria-hidden />
      </button>

      <div className="px-6 pt-6 pb-5">
        {/* Header: the platform mark, then the service name with its platform and type underneath */}
        {platform ? <PlatformTile platform={platform} size="md" className="size-11 rounded-[0.85rem] shadow-[0_6px_16px_-8px_rgb(32_33_39/0.45)]" /> : null}
        <DialogTitle className="mt-4 pe-8 font-heading text-[1.3rem] leading-[1.2] font-extrabold tracking-[-0.02em] text-balance">{info.title}</DialogTitle>
        <p className="mt-1.5 text-[0.82rem] font-medium text-muted-foreground">
          {platform?.name}
          <span className="mx-1.5 text-border" aria-hidden>
            /
          </span>
          {service.category}
        </p>
        <DialogDescription className="mt-4 text-[0.92rem] leading-[1.6] text-foreground/75">{service.description}</DialogDescription>

        {/* Details: quiet label/value rows instead of a boxed grid */}
        <dl className="mt-5 border-t text-[0.85rem]">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-baseline justify-between gap-4 border-b py-2.5">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="min-w-0 truncate text-end font-medium">{value}</dd>
            </div>
          ))}
        </dl>

        <p className="mt-4 rounded-xl bg-secondary/60 px-3.5 py-2.5 text-[0.8rem] leading-relaxed text-secondary-foreground dark:bg-primary/[0.12] dark:text-[#d6ccff]">
          {priced ? "Set it up now — checkout opens soon, and nothing is charged until then." : "Set it up now — ordering opens once pricing is verified. Nothing is charged until then."}
        </p>
      </div>

      <div className="flex items-center justify-end gap-2 px-6 pb-6 max-sm:grid max-sm:grid-cols-[auto_1fr]">
        <Button variant="ghost" className="h-11 rounded-full px-4 text-muted-foreground hover:text-foreground sm:h-10" onClick={onClose}>
          Close
        </Button>
        {info.action ? (
          <Link
            href={info.action.href}
            onClick={onClose}
            className="group inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary ps-5 pe-4 text-sm font-semibold whitespace-nowrap text-primary-foreground shadow-[0_8px_20px_-10px_rgb(112_71_235/0.9)] transition-[background-color,box-shadow,translate] duration-200 hover:-translate-y-px hover:bg-primary/90 hover:shadow-[0_12px_26px_-12px_rgb(112_71_235/0.95)] focus-visible:ring-3 focus-visible:ring-primary/35 focus-visible:outline-none active:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:h-10"
          >
            {info.action.label}
            <span className="grid size-5 place-items-center rounded-full bg-white/15 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none rtl:-scale-x-100" aria-hidden>
              <ArrowRight className="size-3.5" />
            </span>
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
