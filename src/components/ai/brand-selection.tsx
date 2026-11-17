"use client";

import * as React from "react";
import Link from "next/link";
import { Info, Palette } from "lucide-react";
import { BrandSelect } from "@/components/brand/brand-parts";
import { BRAND_ROUTES, brandHref, buildBrandContext, hasVoice, summaryOf, type BrandContext, type BrandSummary, type BrandView } from "@/lib/brand";
import { SOCIAL_PLATFORM } from "@/lib/social/platforms";

/*
 * Brand Kit (BR-01) in the AI tools: an optional brand selector. The chosen brand's voice, audience and guidelines
 * are kept as structured context for when AI generation is switched on; nothing uses them to generate text today,
 * and the page says so. The selection also decides which brand a saved result is filed under.
 */

export interface BrandSelection {
  brandId: string | null;
  /** The structured context for the chosen brand (null until it loads, or when none is chosen). */
  context: BrandContext | null;
}

const NONE: BrandSelection = { brandId: null, context: null };
export const BrandSelectionContext = React.createContext<BrandSelection>(NONE);
export const useBrandSelection = () => React.useContext(BrandSelectionContext);

type Load = { state: "loading" } | { state: "hidden" } | { state: "ready"; brands: BrandView[] };

/** Loads the signed-in customer's brands. Signed-out visitors and failures simply see no brand controls. */
export function useBrands(): Load {
  const [load, setLoad] = React.useState<Load>({ state: "loading" });
  React.useEffect(() => {
    let live = true;
    fetch("/api/brands")
      .then(async (r) => (r.ok ? ((await r.json()) as { brands: BrandView[] }).brands : null))
      .then((brands) => live && setLoad(brands ? { state: "ready", brands } : { state: "hidden" }))
      .catch(() => live && setLoad({ state: "hidden" }));
    return () => {
      live = false;
    };
  }, []);
  return load;
}

/** The selector and a short summary of what the brand provides. Hidden unless the visitor is signed in. */
export function AiBrandPanel({ value, onChange, disabled }: { value: string | null; onChange: (selection: BrandSelection) => void; disabled?: boolean }) {
  const load = useBrands();
  const brands = load.state === "ready" ? load.brands : null;
  const settled = React.useRef(false);

  // Start from the default brand once, unless the customer already chose something.
  React.useEffect(() => {
    if (!brands || settled.current) return;
    settled.current = true;
    const d = value ? brands.find((b) => b.id === value) : brands.find((b) => b.isDefault);
    if (d) onChange({ brandId: d.id, context: buildBrandContext(d) });
  }, [brands, value, onChange]);

  if (!brands) return null;
  if (!brands.length) {
    return (
      <p className="mb-4 flex items-center gap-2 rounded-xl border border-dashed px-3.5 py-2.5 text-[0.82rem] text-muted-foreground">
        <Palette className="size-4 shrink-0" aria-hidden />
        <span>
          Keep your brand&apos;s voice and audience ready for these tools.{" "}
          <Link href={BRAND_ROUTES.create} className="font-semibold text-primary hover:underline">
            Create a brand
          </Link>
        </span>
      </p>
    );
  }
  const chosen = brands.find((b) => b.id === value) ?? null;
  const summaries: BrandSummary[] = brands.map(summaryOf);
  return (
    <div className="mb-4 rounded-2xl border bg-muted/30 p-3.5" data-testid="ai-brand-panel">
      <label htmlFor="ai-brand" className="flex items-center gap-1.5 text-[0.82rem] font-semibold">
        <Palette className="size-4 text-primary" aria-hidden /> Brand <span className="font-normal text-muted-foreground">(optional)</span>
      </label>
      <BrandSelect id="ai-brand" brands={summaries} value={value} disabled={disabled} onChange={(id) => onChange(id ? { brandId: id, context: buildBrandContext(brands.find((b) => b.id === id)!) } : NONE)} className="mt-1.5" />
      {chosen ? (
        <div className="mt-2.5 text-[0.78rem] leading-relaxed text-muted-foreground">
          {hasVoice(chosen) ? (
            <ul className="flex flex-wrap gap-1.5" aria-label={`${chosen.name} context`}>
              {chosen.personality.length ? <li className="rounded-full border bg-card px-2.5 py-0.5">Personality: {chosen.personality.slice(0, 3).join(", ")}</li> : null}
              {chosen.toneOfVoice ? <li className="max-w-full truncate rounded-full border bg-card px-2.5 py-0.5">Tone set</li> : null}
              {chosen.audience ? <li className="rounded-full border bg-card px-2.5 py-0.5">Audience set</li> : null}
              {chosen.platforms.length ? <li className="rounded-full border bg-card px-2.5 py-0.5">{chosen.platforms.map((p) => SOCIAL_PLATFORM[p].name).join(", ")}</li> : null}
              {chosen.avoidWords.length ? <li className="rounded-full border bg-card px-2.5 py-0.5">{chosen.avoidWords.length} words to avoid</li> : null}
            </ul>
          ) : (
            <p>
              This brand has no voice details yet.{" "}
              <Link href={brandHref(chosen.id)} className="font-semibold text-primary hover:underline">
                Add them
              </Link>
            </p>
          )}
          <p className="mt-2 flex items-start gap-1.5">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>Brand context is ready for when AI personalization launches. It isn&apos;t applied to results yet. Saved results are filed under this brand.</span>
          </p>
        </div>
      ) : null}
    </div>
  );
}
