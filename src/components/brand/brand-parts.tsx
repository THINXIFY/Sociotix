"use client";

import * as React from "react";
import { X } from "lucide-react";
import { brandLogoUrl, readableOn, type BrandSummary, type BrandView } from "@/lib/brand";
import { cn } from "@/lib/utils";

/* Brand Kit (BR-01): small pieces shared by the Brand Kit workspace and its integrations (library, composer, calendar, AI tools). */

export const brandField =
  "w-full rounded-2xl border bg-background px-3.5 py-2.5 text-[0.92rem] outline-none transition-[border-color,box-shadow] focus-visible:border-primary/40 focus-visible:ring-3 focus-visible:ring-primary/20 disabled:opacity-60";
export const brandLabel = "text-[0.78rem] font-semibold";

type Markable = Pick<BrandSummary, "primaryColor" | "logoMediaId"> & { name: string };

/** The brand's logo, or its initial on its primary color (violet when it has none). Decorative: the name is always shown next to it. */
export function BrandMark({ brand, className }: { brand: Markable; className?: string }) {
  const bg = brand.primaryColor ?? "#7047eb";
  return (
    <span aria-hidden className={cn("relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl border bg-card text-sm font-extrabold", className)} style={brand.logoMediaId ? undefined : { backgroundColor: bg, color: readableOn(bg) }}>
      {brand.logoMediaId ? (
        // Owner-only image from the media library; plain <img> keeps the private, no-store route simple.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={brandLogoUrl(brand.logoMediaId)} alt="" className="size-full object-contain p-0.5" loading="lazy" />
      ) : (
        Array.from(brand.name.trim())[0]?.toUpperCase() ?? "B"
      )}
    </span>
  );
}

/** A compact "brand" label for cards and details. */
export function BrandChip({ brand, className }: { brand: Pick<BrandSummary, "name" | "primaryColor">; className?: string }) {
  return (
    <span className={cn("inline-flex max-w-40 items-center gap-1.5 text-[0.72rem] text-muted-foreground", className)}>
      <span aria-hidden className="size-2.5 shrink-0 rounded-full border border-black/10 dark:border-white/20" style={{ backgroundColor: brand.primaryColor ?? "#7047eb" }} />
      <span className="truncate">{brand.name}</span>
    </span>
  );
}

export function ColorSwatches({ brand, className }: { brand: Pick<BrandView, "primaryColor" | "secondaryColor" | "accentColor">; className?: string }) {
  const colors = [brand.primaryColor, brand.secondaryColor, brand.accentColor].filter((c): c is string => Boolean(c));
  if (!colors.length) return <span className="text-[0.72rem] text-muted-foreground">No colors yet</span>;
  return (
    <span className={cn("inline-flex items-center", className)} role="img" aria-label={`Brand colors: ${colors.join(", ")}`}>
      {colors.map((c, i) => (
        <span key={`${c}-${i}`} aria-hidden className={cn("size-5 rounded-full border-2 border-card shadow-sm", i > 0 && "-ms-1.5")} style={{ backgroundColor: c }} />
      ))}
    </span>
  );
}

/** A select of the customer's brands with an explicit "No brand" choice. */
export function BrandSelect({ brands, value, onChange, id, className, noneLabel = "No brand", disabled, "aria-label": ariaLabel }: { brands: BrandSummary[]; value: string | null; onChange: (id: string | null) => void; id?: string; className?: string; noneLabel?: string; disabled?: boolean; "aria-label"?: string }) {
  return (
    <select id={id} aria-label={ariaLabel} disabled={disabled} value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} className={cn(brandField, className)}>
      <option value="">{noneLabel}</option>
      {brands.map((b) => (
        <option key={b.id} value={b.id}>
          {b.name}
          {b.isDefault ? " (default)" : ""}
        </option>
      ))}
    </select>
  );
}

/** A list of short entries: type one and press Enter (or comma) to add it; each chip has a remove button. */
export function TagInput({ id, label, value, onChange, max, maxEach, placeholder, help, prefix, normalize, error }: { id: string; label: string; value: string[]; onChange: (v: string[]) => void; max: number; maxEach: number; placeholder?: string; help?: string; prefix?: string; normalize?: (s: string) => string; error?: string }) {
  const [draft, setDraft] = React.useState("");
  const [note, setNote] = React.useState("");
  const full = value.length >= max;

  function add(raw: string) {
    const pieces = raw
      .split(/[,\n]/)
      .map((s) => (normalize ? normalize(s) : s.trim()))
      .filter(Boolean);
    if (!pieces.length) return;
    let next = [...value];
    let msg = "";
    for (const p of pieces) {
      if (Array.from(p).length > maxEach) msg = `Each entry can be up to ${maxEach} characters.`;
      else if (next.some((x) => x.toLowerCase() === p.toLowerCase())) msg = `“${p}” is already in the list.`;
      else if (next.length >= max) msg = `You can add up to ${max}.`;
      else next = [...next, p];
    }
    onChange(next);
    setNote(msg);
    setDraft(msg ? raw : "");
  }

  const helpId = `${id}-help`;
  return (
    <div>
      <label htmlFor={id} className={brandLabel}>
        {label} <span className="font-normal text-muted-foreground">({value.length}/{max})</span>
      </label>
      {value.length ? (
        <ul className="mt-1.5 flex flex-wrap gap-1.5" aria-label={label}>
          {value.map((v) => (
            <li key={v} className="inline-flex max-w-full items-center gap-1 rounded-full border bg-muted/50 py-0.5 ps-3 pe-1 text-[0.8rem]">
              <span className="truncate">
                {prefix}
                {v}
              </span>
              <button type="button" onClick={() => onChange(value.filter((x) => x !== v))} aria-label={`Remove ${v}`} className="grid size-6 shrink-0 place-items-center rounded-full text-muted-foreground outline-none hover:bg-background hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40">
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <input
        id={id}
        value={draft}
        disabled={full}
        onChange={(e) => {
          setDraft(e.target.value);
          if (note) setNote("");
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add(draft);
          } else if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={() => draft.trim() && add(draft)}
        placeholder={full ? "List is full" : placeholder}
        aria-describedby={helpId}
        aria-invalid={error ? true : undefined}
        className={cn(brandField, "mt-1.5")}
      />
      <p id={helpId} className={cn("mt-1 text-[0.74rem]", error || note ? "font-medium text-destructive" : "text-muted-foreground")} role={error || note ? "alert" : undefined}>
        {error || note || help || "Press Enter to add."}
      </p>
    </div>
  );
}
