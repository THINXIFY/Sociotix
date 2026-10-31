"use client";

import * as React from "react";
import { Check, Copy, Download, Ruler } from "lucide-react";
import { cn } from "@/lib/utils";

/* Lightweight client islands for the Media Kit: logo playground, copy-to-clipboard and type tester. */

const S_PATH = "M20.6 10.4c-1.1-1-2.7-1.6-4.5-1.6-2.9 0-4.9 1.5-4.9 3.7 0 4.6 8.6 3 8.6 6.3 0 1.1-1.2 1.9-3 1.9-1.6 0-3-.6-4-1.6";

/** The real Sociotix mark (components/brand.tsx), with an optional graphite tile. */
export function Mark({ tile = "#7047EB", className }: { tile?: string; className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="9" fill={tile} />
      <path d={S_PATH} fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="23" cy="22.5" r="2.6" fill="#C8FF52" />
    </svg>
  );
}

/** Copies text and announces it politely; falls back gracefully if the clipboard is unavailable. */
function useCopy() {
  const [copied, setCopied] = React.useState<string | null>(null);
  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
      window.setTimeout(() => setCopied((c) => (c === value ? null : c)), 1600);
    } catch {
      setCopied(null);
    }
  };
  return { copied, copy };
}

export function ColorCard({ name, hex, role, ink }: { name: string; hex: string; role: string; ink: string }) {
  const { copied, copy } = useCopy();
  const done = copied === hex;
  return (
    <button
      type="button"
      onClick={() => copy(hex)}
      className="group relative flex min-h-56 w-full flex-col justify-between overflow-hidden rounded-[1.75rem] p-6 text-left ring-1 ring-black/[0.06] transition-[transform,box-shadow] duration-300 outline-none hover:-translate-y-1 hover:shadow-[0_30px_60px_-30px_rgb(32_33_39/0.5)] focus-visible:ring-4 focus-visible:ring-primary/40 motion-reduce:transition-none motion-reduce:hover:translate-y-0 dark:ring-white/10"
      style={{ backgroundColor: hex, color: ink }}
      aria-label={`${name}, ${hex}. Copy hex code`}
    >
      <span className="flex items-start justify-between gap-3">
        <span className="font-heading text-[1.35rem] leading-tight font-extrabold tracking-[-0.02em]">{name}</span>
        <span className="grid size-9 place-items-center rounded-full bg-current/10 transition-transform duration-300 group-hover:scale-110 motion-reduce:transition-none" style={{ backgroundColor: ink === "#FFFFFF" ? "rgb(255 255 255 / 0.14)" : "rgb(32 33 39 / 0.1)" }}>
          {done ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
        </span>
      </span>
      <span>
        <span className="block font-mono text-[1.6rem] font-semibold tracking-tight">{hex}</span>
        <span className="mt-1 block text-[0.85rem] opacity-75">{role}</span>
        <span className="mt-3 inline-flex h-6 items-center text-[0.72rem] font-semibold tracking-[0.12em] uppercase opacity-80" aria-hidden>
          {done ? "Copied" : "Click to copy"}
        </span>
      </span>
      <span className="sr-only" aria-live="polite">
        {done ? `${hex} copied to clipboard` : ""}
      </span>
    </button>
  );
}

export function CopyText({ text, label }: { text: string; label: string }) {
  const { copied, copy } = useCopy();
  const done = copied === text;
  return (
    <button
      type="button"
      onClick={() => copy(text)}
      className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border bg-card px-3 text-sm font-medium transition-colors duration-150 hover:border-primary/35 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none dark:bg-white/[0.04]"
    >
      {done ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
      {done ? "Copied" : label}
      <span className="sr-only" aria-live="polite">
        {done ? "Copied to clipboard" : ""}
      </span>
    </button>
  );
}

type Surface = "light" | "dark" | "violet";
type Variant = "logo" | "mark";

const SURFACES: { id: Surface; label: string; bg: string; dot: string }[] = [
  { id: "light", label: "Light", bg: "#F8F9FC", dot: "#F8F9FC" },
  { id: "dark", label: "Dark", bg: "#0E0F13", dot: "#0E0F13" },
  { id: "violet", label: "Violet", bg: "#7047EB", dot: "#7047EB" },
];

/** Which real file matches what's previewed. Violet backgrounds use the graphite mark only. */
function filesFor(surface: Surface, variant: Variant): { label: string; href: string }[] {
  if (surface === "violet") return [{ label: "SVG", href: "/brand/sociotix-mark-graphite.svg" }, { label: "PNG", href: "/brand/sociotix-mark-graphite.png" }];
  if (variant === "mark") return [{ label: "SVG", href: "/brand/sociotix-mark.svg" }, { label: "PNG", href: "/brand/sociotix-mark.png" }];
  return [{ label: "PNG", href: surface === "dark" ? "/brand/sociotix-logo-reversed.png" : "/brand/sociotix-logo.png" }];
}

function Segmented<T extends string>({ name, legend, value, options, onChange }: { name: string; legend: string; value: T; options: { id: T; label: string; disabled?: boolean; swatch?: string }[]; onChange: (v: T) => void }) {
  return (
    <fieldset>
      <legend className="mb-2 text-[0.7rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">{legend}</legend>
      <div className="inline-flex rounded-xl border bg-card p-1 dark:bg-white/[0.04]">
        {options.map((o) => (
          <label
            key={o.id}
            className={cn(
              "relative inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg px-3.5 text-sm font-medium transition-colors duration-200 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/45 motion-reduce:transition-none",
              value === o.id ? "bg-foreground text-background" : "text-foreground/70 hover:text-foreground",
              o.disabled && "cursor-not-allowed opacity-40",
            )}
          >
            <input type="radio" name={name} value={o.id} checked={value === o.id} disabled={o.disabled} onChange={() => onChange(o.id)} className="sr-only" />
            {o.swatch ? <span className="size-3 rounded-full ring-1 ring-black/15 dark:ring-white/25" style={{ backgroundColor: o.swatch }} aria-hidden /> : null}
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function LogoPlayground() {
  const [surface, setSurface] = React.useState<Surface>("light");
  const [variantChoice, setVariant] = React.useState<Variant>("logo");
  const [guides, setGuides] = React.useState(false);
  // The full logo isn't used on violet; the graphite mark is.
  const variant: Variant = surface === "violet" ? "mark" : variantChoice;
  const bg = SURFACES.find((s) => s.id === surface)!.bg;
  const files = filesFor(surface, variant);
  const onDark = surface !== "light";
  const caption =
    surface === "violet" ? "On violet, use the graphite mark so it stays visible." : variant === "logo" ? (surface === "dark" ? "Reversed logo for dark backgrounds." : "Primary logo for light backgrounds.") : "The mark on its own, for small spaces and icons.";

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_20rem] lg:gap-8">
      <figure className="relative overflow-hidden rounded-[2rem] ring-1 ring-black/[0.06] transition-colors duration-500 motion-reduce:transition-none dark:ring-white/10" style={{ backgroundColor: bg }}>
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgb(128_128_128/0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgb(128_128_128/0.08)_1px,transparent_1px)] bg-size-[32px_32px]" aria-hidden />
        <div className="relative grid min-h-[18rem] place-items-center p-8 sm:min-h-[26rem]" data-testid="logo-preview" data-surface={surface} data-variant={variant}>
          <div key={`${surface}-${variant}`} className="relative animate-in fade-in-0 zoom-in-95 duration-500 motion-reduce:animate-none">
            {guides ? (
              <span className="pointer-events-none absolute -inset-[clamp(0.75rem,3vw,1.5rem)] rounded-xl border-2 border-dashed" style={{ borderColor: onDark ? "rgb(200 255 82 / 0.7)" : "rgb(112 71 235 / 0.6)" }} aria-hidden />
            ) : null}
            {variant === "logo" ? (
              <span className="flex items-center gap-[0.32em] text-[clamp(2.4rem,9vw,5.5rem)]">
                <Mark className="size-[1em] shrink-0" />
                <span className="font-heading text-[0.62em] leading-none font-extrabold tracking-tight" style={{ color: onDark ? "#F1F2F6" : "#202127" }}>
                  Socio<span style={{ color: onDark ? "#9277F4" : "#7047EB" }}>tix</span>
                </span>
              </span>
            ) : (
              <Mark tile={surface === "violet" ? "#202127" : "#7047EB"} className="size-[clamp(6rem,22vw,11rem)] drop-shadow-[0_24px_40px_rgb(0_0_0/0.25)]" />
            )}
          </div>
        </div>
        <figcaption className="relative flex items-center justify-between gap-3 border-t px-5 py-3.5 text-[0.85rem]" style={{ borderColor: onDark ? "rgb(255 255 255 / 0.1)" : "rgb(32 33 39 / 0.08)", color: onDark ? "rgb(255 255 255 / 0.75)" : "rgb(32 33 39 / 0.7)" }}>
          <span aria-live="polite">{caption}</span>
          {guides ? <span className="hidden shrink-0 font-mono text-[0.72rem] sm:inline">Clear space</span> : null}
        </figcaption>
      </figure>

      <div className="flex flex-col gap-6">
        <Segmented name="logo-surface" legend="Background" value={surface} onChange={setSurface} options={SURFACES.map((s) => ({ id: s.id, label: s.label, swatch: s.dot }))} />
        <Segmented
          name="logo-variant"
          legend="Variant"
          value={variant}
          onChange={setVariant}
          options={[
            { id: "logo", label: "Full logo", disabled: surface === "violet" },
            { id: "mark", label: "Mark" },
          ]}
        />
        <label className="inline-flex cursor-pointer items-center gap-3 text-sm font-medium has-[:focus-visible]:[&>span:first-of-type]:ring-2 has-[:focus-visible]:[&>span:first-of-type]:ring-primary/45">
          <input type="checkbox" checked={guides} onChange={(e) => setGuides(e.target.checked)} className="peer sr-only" />
          <span className="relative h-6 w-10 rounded-full bg-muted transition-colors duration-200 peer-checked:bg-primary motion-reduce:transition-none dark:bg-white/15" aria-hidden>
            <span className={cn("absolute top-1 left-1 size-4 rounded-full bg-white shadow transition-transform duration-200 motion-reduce:transition-none", guides && "translate-x-4")} />
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Ruler className="size-4 text-muted-foreground" aria-hidden /> Show clear space
          </span>
        </label>
        <div className="mt-auto rounded-2xl border bg-card p-4 dark:bg-white/[0.03]">
          <p className="text-[0.7rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">Download this version</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {files.map((f) => (
              <a
                key={f.href}
                href={f.href}
                download
                className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-[0_8px_20px_-10px_rgb(112_71_235/0.8)] transition-[background-color,transform] duration-150 hover:bg-primary/90 active:translate-y-px focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2 focus-visible:outline-none motion-reduce:active:translate-y-0"
              >
                <Download className="size-4" aria-hidden /> {f.label}
                <span className="sr-only"> of the {variant === "logo" ? "full logo" : "mark"}</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** A live type specimen: drag the weight and both families respond smoothly. */
export function TypeTester() {
  const [weight, setWeight] = React.useState(800);
  return (
    <div className="rounded-[2rem] border bg-card p-6 sm:p-8 dark:bg-white/[0.03]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <label htmlFor="type-weight" className="text-[0.7rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          Weight · <span className="font-mono text-foreground tabular-nums">{weight}</span>
        </label>
        <input id="type-weight" type="range" min={200} max={800} step={100} value={weight} onChange={(e) => setWeight(Number(e.target.value))} className="w-full max-w-xs accent-[#7047EB]" />
      </div>
      <p className="mt-6 font-heading text-[clamp(2.6rem,8vw,5.5rem)] leading-[0.95] tracking-[-0.045em] transition-[font-weight] duration-300 motion-reduce:transition-none" style={{ fontWeight: weight }}>
        Smarter Social.
        <br />
        <span className="text-primary dark:text-[#a993ff]">Bigger Impact.</span>
      </p>
      <p className="mt-6 max-w-xl text-[1.05rem] leading-relaxed text-muted-foreground transition-[font-weight] duration-300 motion-reduce:transition-none" style={{ fontWeight: Math.min(weight, 600) - 100 > 300 ? 500 : 400 }}>
        Inter carries everything you read: clear, neutral and easy on the eyes at any size.
      </p>
    </div>
  );
}
