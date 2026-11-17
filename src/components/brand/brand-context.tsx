"use client";

import * as React from "react";
import Link from "next/link";
import { CircleAlert, Hash, Loader2, TriangleAlert } from "lucide-react";
import { brandHref, findAvoided, hasVoice, type BrandView } from "@/lib/brand";
import { SOCIAL_PLATFORM } from "@/lib/social/platforms";
import { cn } from "@/lib/utils";
import { BrandMark } from "./brand-parts";

/* Brand Kit (BR-01): the selected brand's voice and rules, shown next to where content is written. */

type State = { id: string; brand: BrandView | null; failed: boolean };

/** Loads one of the signed-in customer's own brands (private API; nothing is public). */
export function useBrand(id: string | null) {
  const [state, setState] = React.useState<State>({ id: "", brand: null, failed: false });
  React.useEffect(() => {
    if (!id) return;
    let live = true;
    fetch(`/api/brands/${id}`)
      .then(async (r) => (r.ok ? ((await r.json()) as { brand: BrandView }).brand : null))
      .then((brand) => live && setState({ id, brand, failed: !brand }))
      .catch(() => live && setState({ id, brand: null, failed: true }));
    return () => {
      live = false;
    };
  }, [id]);
  if (!id) return { brand: null, loading: false, failed: false };
  const ready = state.id === id;
  return { brand: ready ? state.brand : null, loading: !ready, failed: ready && state.failed };
}

const row = "grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-0.5 text-[0.78rem] leading-relaxed";

/**
 * The brand's tone, audience and word rules beside the editor. It never rewrites anything: it shows the rules, warns
 * about words the brand avoids that are in the text, and can add the brand's hashtags on request.
 */
export function BrandContextCard({ brandId, text, hashtags, onAddHashtags, className }: { brandId: string | null; text: string; hashtags: string[]; onAddHashtags: (tags: string[]) => void; className?: string }) {
  const { brand, loading, failed } = useBrand(brandId);
  if (!brandId) return null;
  if (loading) {
    return (
      <p className={cn("mt-3 flex items-center gap-2 text-[0.78rem] text-muted-foreground", className)} role="status">
        <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden /> Loading brand…
      </p>
    );
  }
  if (failed || !brand) {
    return (
      <p className={cn("mt-3 flex items-start gap-2 text-[0.78rem] text-muted-foreground", className)} role="status">
        <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden /> This brand&apos;s details couldn&apos;t be loaded. Your draft is unaffected.
      </p>
    );
  }
  const avoided = findAvoided(text, brand.avoidWords);
  const missing = brand.hashtags.filter((t) => !hashtags.some((h) => h.toLowerCase() === t.toLowerCase()));
  return (
    <div className={cn("mt-3 rounded-2xl border bg-muted/30 p-3", className)} data-testid="brand-context">
      <div className="flex items-center gap-2.5">
        <BrandMark brand={brand} className="size-8 rounded-lg text-xs" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.84rem] font-bold">{brand.name}</p>
          {brand.industry ? <p className="truncate text-[0.72rem] text-muted-foreground">{brand.industry}</p> : null}
        </div>
        <Link href={brandHref(brand.id)} className="shrink-0 rounded text-[0.74rem] font-semibold text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary/40">
          Edit brand
        </Link>
      </div>
      {avoided.length ? (
        <p className="mt-2.5 flex items-start gap-2 rounded-xl bg-amber-500/10 px-2.5 py-2 text-[0.78rem] font-medium text-amber-800 dark:text-amber-300" role="status">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>This text uses {avoided.length === 1 ? "a word" : "words"} the brand avoids: {avoided.map((w) => `“${w}”`).join(", ")}.</span>
        </p>
      ) : null}
      {hasVoice(brand) || brand.platforms.length ? (
        <dl className={cn(row, "mt-2.5")}>
          {brand.personality.length ? (
            <>
              <dt className="text-muted-foreground">Personality</dt>
              <dd>{brand.personality.join(", ")}</dd>
            </>
          ) : null}
          {brand.toneOfVoice ? (
            <>
              <dt className="text-muted-foreground">Tone</dt>
              <dd className="break-words whitespace-pre-line">{brand.toneOfVoice}</dd>
            </>
          ) : null}
          {brand.audience ? (
            <>
              <dt className="text-muted-foreground">Audience</dt>
              <dd className="break-words">{brand.audience}</dd>
            </>
          ) : null}
          {brand.platforms.length ? (
            <>
              <dt className="text-muted-foreground">Platforms</dt>
              <dd>{brand.platforms.map((p) => SOCIAL_PLATFORM[p].name).join(", ")}</dd>
            </>
          ) : null}
          {brand.preferredPhrases.length ? (
            <>
              <dt className="text-muted-foreground">Use</dt>
              <dd className="break-words">{brand.preferredPhrases.join(" · ")}</dd>
            </>
          ) : null}
          {brand.avoidWords.length ? (
            <>
              <dt className="text-muted-foreground">Avoid</dt>
              <dd className="break-words">{brand.avoidWords.join(" · ")}</dd>
            </>
          ) : null}
          {brand.writingGuidelines ? (
            <>
              <dt className="text-muted-foreground">Guidelines</dt>
              <dd className="break-words whitespace-pre-line">{brand.writingGuidelines}</dd>
            </>
          ) : null}
        </dl>
      ) : (
        <p className="mt-2.5 text-[0.78rem] text-muted-foreground">
          This brand has no voice details yet.{" "}
          <Link href={brandHref(brand.id)} className="font-semibold text-primary hover:underline">
            Add them
          </Link>
          .
        </p>
      )}
      {missing.length ? (
        <button type="button" onClick={() => onAddHashtags(missing)} className="mt-2.5 inline-flex h-9 items-center gap-1.5 rounded-full border bg-card px-3 text-[0.78rem] font-semibold outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-primary/30">
          <Hash className="size-3.5" aria-hidden /> Add brand hashtags ({missing.length})
        </button>
      ) : null}
    </div>
  );
}
