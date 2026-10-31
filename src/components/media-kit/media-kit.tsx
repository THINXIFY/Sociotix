import { ArrowDown, ArrowUpRight, Check, Download, Handshake, Mail, Newspaper, Sparkles, X } from "lucide-react";
import { ColorCard, CopyText, LogoPlayground, Mark, TypeTester } from "@/components/media-kit/interactive";
import { Parallax } from "@/components/site/about-parallax";
import { Reveal } from "@/components/site/primitives";
import { BRAND_ASSETS, BRAND_COLORS, MEDIA_CONTACT } from "@/lib/brand-assets";
import { CATALOG_TOTALS } from "@/lib/catalog";
import { cn } from "@/lib/utils";

/*
 * Sociotix Media Kit. Server-rendered, with three small client islands (logo playground, copy
 * buttons, type tester). Motion is CSS-only (3D tilt via pointer variables, float, marquee) and
 * switches off with reduced motion. Every download is a real export of the logo in public/brand.
 */

export const MEDIA_KIT_TITLE = "Sociotix Media Kit — Logo, Colors & Brand Assets";
export const MEDIA_KIT_DESCRIPTION =
  "Download the Sociotix logo and mark, copy brand colors, explore Manrope and Inter, and read the approved company description and logo usage guidelines.";

const wrap = "mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8";
const eyebrow = "text-[0.74rem] font-semibold tracking-[0.16em] uppercase";
const h2 = "font-heading text-[2.3rem] leading-[1] font-extrabold tracking-[-0.045em] text-balance sm:text-[3.2rem] lg:text-[3.8rem]";
const BOILERPLATE =
  "Sociotix is an AI-powered social growth and marketing platform. It brings a marketplace for social media services, AI marketing tools, social media management and marketing automation together in one account, with clear information at every step.";

/* -------------------------------------------------------------------------- */

/** Glass surface shared by the floating hero cards; hover lifts and brightens them. */
const glass =
  "rounded-2xl border border-white/70 bg-white/80 shadow-[0_24px_60px_-30px_rgb(32_33_39/0.45)] backdrop-blur-xl transition-[translate,box-shadow,border-color,background-color] duration-200 hover:-translate-y-1 hover:border-primary/30 hover:bg-white hover:shadow-[0_30px_60px_-28px_rgb(112_71_235/0.45)] motion-reduce:transition-none motion-reduce:hover:translate-y-0 dark:border-white/10 dark:bg-[#17181d]/80 dark:shadow-[0_24px_60px_-30px_rgb(0_0_0/0.9)] dark:hover:bg-[#1c1d23]";

/**
 * One element of the hero scene: drifts with the pointer at its own depth (CSS variables set by
 * Parallax), floats on its own rhythm, and enters with a staggered fade. Reduced motion and touch
 * keep it still.
 */
function Floater({ className, depth, delay, alt, children }: { className: string; depth: number; delay: number; alt?: boolean; children: React.ReactNode }) {
  return (
    <div
      className={cn("absolute animate-in fade-in-0 zoom-in-95 duration-700 motion-reduce:animate-none", className)}
      style={{ translate: `calc(var(--px, 0) * ${depth}px) calc(var(--py, 0) * ${depth}px)`, transition: "translate 700ms cubic-bezier(0.22, 1, 0.36, 1)", animationDelay: `${delay}ms`, animationFillMode: "backwards" }}
    >
      <div className={alt ? "ai-float-delayed" : "ai-float"} style={{ animationDelay: `${delay * 3}ms` }}>
        {children}
      </div>
    </div>
  );
}

function BrandScene() {
  return (
    <Parallax className="relative mx-auto aspect-[1.05] w-full max-w-[21rem] min-[400px]:max-w-[25rem] sm:max-w-[32rem] lg:max-w-[34rem]">
      <div className="absolute inset-0" aria-hidden>
        {/* Halo, orbit ring and travelling signal behind the mark. */}
        <div className="absolute inset-[14%] rounded-full bg-[radial-gradient(closest-side,rgb(112_71_235/0.28),transparent)] dark:bg-[radial-gradient(closest-side,rgb(112_71_235/0.45),transparent)]" />
        <div className="absolute inset-[18%] rounded-full border border-dashed border-foreground/10" style={{ translate: "calc(var(--px, 0) * 4px) calc(var(--py, 0) * 4px)" }} />
        <div className="about-orbit-slow absolute inset-[18%]">
          <span className="absolute top-0 left-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-lime shadow-[0_0_0_5px_rgb(200_255_82/0.2)]" />
        </div>

        {/* Centerpiece: the mark on a glass plate. */}
        <div className="absolute top-1/2 left-1/2 w-[38%] -translate-x-1/2 -translate-y-1/2">
          <div className="animate-in fade-in-0 zoom-in-90 duration-700 motion-reduce:animate-none" style={{ translate: "calc(var(--px, 0) * 8px) calc(var(--py, 0) * 8px)", transition: "translate 700ms cubic-bezier(0.22, 1, 0.36, 1)" }}>
            <div className="ai-float relative">
              <div className="absolute -inset-[16%] rounded-[2.4rem] border border-white/70 bg-white/45 shadow-[0_40px_80px_-40px_rgb(112_71_235/0.6)] backdrop-blur-md dark:border-white/10 dark:bg-white/[0.04]" />
              <div className="about-pulse absolute inset-0 rounded-[28%] border-2 border-primary/40" />
              <Mark className="relative w-full drop-shadow-[0_28px_40px_rgb(112_71_235/0.5)]" />
            </div>
          </div>
        </div>

        {/* Logo variants. */}
        <Floater className="top-[3%] left-0" depth={18} delay={120}>
          <div className={cn(glass, "group/card w-[9.5rem] p-3 sm:w-44 sm:p-3.5")}>
            <p className="text-[0.6rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">Logo</p>
            <div className="mt-2.5 flex items-center gap-2">
              <Mark className="size-6 sm:size-7" />
              <Mark tile="#202127" className="size-6 sm:size-7" />
              <span className="font-heading text-[0.8rem] font-extrabold tracking-tight sm:text-sm">
                Socio<span className="text-primary">tix</span>
              </span>
            </div>
            <p className="grid grid-rows-[0fr] text-[0.68rem] text-muted-foreground transition-[grid-template-rows] duration-200 group-hover/card:grid-rows-[1fr] motion-reduce:transition-none">
              <span className="overflow-hidden">
                <span className="block pt-2">3 variants · SVG + PNG</span>
              </span>
            </p>
          </div>
        </Floater>

        {/* Color chips: hover a chip to reveal its name. */}
        <Floater className="top-[1%] right-0" depth={26} delay={220} alt>
          <div className={cn(glass, "flex flex-col gap-1.5 p-2")}>
            {BRAND_COLORS.map((c) => (
              <span key={c.hex} className="group/chip flex items-center gap-2 rounded-full py-0.5 ps-0.5 pe-2.5 transition-colors duration-200 hover:bg-foreground/[0.05]">
                <span className="size-6 shrink-0 rounded-full ring-1 ring-black/10 transition-transform duration-200 group-hover/chip:scale-110 motion-reduce:transition-none sm:size-7 dark:ring-white/15" style={{ backgroundColor: c.hex }} />
                <span className="font-mono text-[0.62rem] font-semibold sm:text-[0.68rem]">{c.hex}</span>
                <span className="max-w-0 overflow-hidden text-[0.62rem] whitespace-nowrap text-muted-foreground opacity-0 transition-[max-width,opacity] duration-200 group-hover/chip:max-w-24 group-hover/chip:opacity-100 motion-reduce:transition-none">{c.name}</span>
              </span>
            ))}
          </div>
        </Floater>

        {/* Asset snippet (hidden on the smallest screens to keep the scene calm). */}
        <Floater className="top-[46%] right-0 hidden sm:block" depth={12} delay={420}>
          <div className={cn(glass, "group/card flex items-center gap-2.5 py-2 ps-2 pe-3")}>
            <span className="grid size-8 place-items-center rounded-lg bg-primary/[0.09] dark:bg-primary/20">
              <Mark className="size-5" />
            </span>
            <span className="leading-tight">
              <span className="block font-mono text-[0.68rem] font-semibold">sociotix-mark.svg</span>
              <span className="block text-[0.62rem] text-muted-foreground">Vector · SVG</span>
            </span>
            <span className="grid size-6 place-items-center rounded-full bg-primary text-white transition-colors duration-200 group-hover/card:bg-lime group-hover/card:text-graphite">
              <Download className="size-3 group-hover/card:hidden" />
              <Check className="hidden size-3 group-hover/card:block" />
            </span>
          </div>
        </Floater>

        {/* Typography: hover to see the weight shift. */}
        <Floater className="bottom-[14%] left-0 min-[400px]:bottom-[4%] min-[400px]:left-[2%]" depth={22} delay={320} alt>
          <div className={cn(glass, "group/card p-3 sm:p-4")}>
            <p className="font-heading text-[clamp(2rem,6vw,3.2rem)] leading-none font-extrabold tracking-[-0.05em] transition-[font-weight] duration-500 group-hover/card:font-light motion-reduce:transition-none">Aa</p>
            <p className="mt-2 text-[0.6rem] font-semibold tracking-[0.12em] text-muted-foreground uppercase sm:text-[0.66rem]">Manrope · Inter</p>
          </div>
        </Floater>

        {/* Tagline strip. */}
        <Floater className="right-[3%] bottom-[1%]" depth={30} delay={520}>
          <div className="group/card inline-flex items-center gap-2 rounded-full bg-graphite py-2 ps-3 pe-3.5 text-[0.66rem] font-semibold text-white shadow-[0_24px_40px_-20px_rgb(32_33_39/0.8)] transition-[translate,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[0_28px_44px_-18px_rgb(112_71_235/0.6)] motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:text-[0.76rem] dark:bg-white dark:text-graphite">
            <span className="relative grid size-2 place-items-center">
              <span className="absolute size-2 rounded-full bg-lime opacity-0 group-hover/card:animate-ping group-hover/card:opacity-75 motion-reduce:animate-none dark:bg-primary" />
              <span className="size-2 rounded-full bg-lime dark:bg-primary" />
            </span>
            Smarter Social. <span className="text-lime dark:text-primary">Bigger Impact.</span>
          </div>
        </Floater>
      </div>
    </Parallax>
  );
}

const HERO_LINKS = [
  { label: "Logo", href: "#logo-playground" },
  { label: "Colors & type", href: "#brand-dna" },
  { label: "Motion", href: "#brand-in-motion" },
  { label: "Downloads", href: "#resources" },
];

function Hero() {
  return (
    <section id="top" className="relative isolate overflow-hidden" aria-labelledby="mk-title">
      {/* Ambient background: drifting glows and a slowly panning grid. Transform-only; still under reduced motion. */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
        <div className="aurora aurora-a -top-48 -right-32 size-[38rem] bg-[#7047EB]/25 dark:bg-[#7047EB]/40" />
        <div className="aurora aurora-b -bottom-56 left-[18%] size-[26rem] bg-[#C8FF52]/25 dark:bg-[#C8FF52]/10" />
        <div className="absolute inset-0 mask-[radial-gradient(75%_70%_at_65%_40%,black,transparent)]">
          <div className="grid-pan absolute -inset-[44px] bg-[linear-gradient(to_right,rgb(32_33_39/0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgb(32_33_39/0.05)_1px,transparent_1px)] bg-size-[44px_44px] dark:bg-[linear-gradient(to_right,rgb(255_255_255/0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.05)_1px,transparent_1px)]" />
        </div>
        <div className="absolute inset-x-0 bottom-0 h-px bg-[linear-gradient(90deg,transparent,rgb(112_71_235/0.35),rgb(200_255_82/0.35),transparent)]" />
      </div>

      <div className={cn(wrap, "grid grid-cols-1 items-center gap-14 pt-12 pb-16 sm:pt-16 sm:pb-24 lg:grid-cols-[1fr_1fr] lg:gap-10 lg:pt-20")}>
        <div className="max-w-xl">
          <p className={cn(eyebrow, "inline-flex items-center gap-2 rounded-full border bg-card/70 py-1.5 ps-2 pe-3 text-[0.68rem] text-foreground/75 backdrop-blur")}>
            <span className="grid size-5 place-items-center rounded-full bg-primary text-white">
              <Newspaper className="size-3" aria-hidden />
            </span>
            Media Kit
          </p>
          <h1 id="mk-title" className="mt-6 font-heading text-[calc(3.6rem-8px)] leading-[0.9] font-extrabold tracking-[-0.06em] min-[400px]:text-[calc(4.2rem-8px)] sm:text-[calc(5.8rem-8px)] lg:text-[calc(5.4rem-8px)] xl:text-[calc(6.6rem-8px)]">
            The Art of{" "}
            <span className="whitespace-nowrap text-[#7047EB] underline decoration-lime decoration-[0.07em] underline-offset-[0.14em] [text-decoration-skip-ink:none]">Our Brand.</span>
          </h1>
          <p className="mt-8 text-[1.08rem] leading-relaxed text-muted-foreground sm:text-lg">
            The official home of the Sociotix identity: logo files, colors, typography and the words we use about ourselves, ready to download and use.
          </p>
          <div className="mt-9 flex flex-col gap-3 min-[440px]:flex-row min-[440px]:items-center">
            <a
              href="#logo-playground"
              className="group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 text-[0.95rem] font-semibold text-primary-foreground shadow-[0_14px_32px_-16px_rgb(112_71_235/0.9),inset_0_1px_0_rgb(255_255_255/0.2)] transition-[background-color,transform,box-shadow] duration-200 hover:-translate-y-px hover:bg-primary/92 hover:shadow-[0_18px_36px_-16px_rgb(112_71_235/1)] focus-visible:ring-3 focus-visible:ring-primary/35 focus-visible:outline-none motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              Explore Brand Assets <ArrowDown className="size-4 transition-transform group-hover:translate-y-0.5 motion-reduce:transition-none" aria-hidden />
            </a>
            <a
              href="/brand/sociotix-logo.png"
              download
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full border bg-card/80 px-5 text-[0.95rem] font-semibold backdrop-blur transition-[border-color,background-color] duration-200 hover:border-primary/35 hover:bg-card focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none dark:bg-white/[0.04]"
            >
              <Download className="size-4 text-primary dark:text-[#b9a6ff]" aria-hidden /> Download logo
              <span className="sr-only"> (PNG)</span>
            </a>
          </div>
          <nav aria-label="Media kit sections" className="mt-9 border-t pt-5">
            <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm sm:gap-x-1">
              {HERO_LINKS.map((l, i) => (
                <li key={l.href} className="flex items-center">
                  {i > 0 ? <span className="mx-2 hidden size-1 rounded-full bg-border sm:block" aria-hidden /> : null}
                  <a href={l.href} className="rounded-md px-1 font-medium text-foreground/65 transition-colors duration-150 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none dark:hover:text-[#b9a6ff]">
                    {l.label}
                  </a>
                </li>
              ))}
              <li className="ms-auto hidden text-[0.78rem] text-muted-foreground sm:block">{BRAND_ASSETS.length} files · SVG &amp; PNG</li>
            </ul>
          </nav>
        </div>
        <BrandScene />
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */

function Playground() {
  return (
    <section id="logo-playground" className="border-t bg-subtle/50 py-16 sm:py-24 dark:bg-white/[0.015]" aria-labelledby="playground-title">
      <div className={wrap}>
        <Reveal className="max-w-3xl">
          <p className={cn(eyebrow, "text-primary dark:text-[#b9a6ff]")}>Logo playground</p>
          <h2 id="playground-title" className={cn(h2, "mt-3")}>
            One mark. <span className="text-muted-foreground">Every surface.</span>
          </h2>
          <p className="mt-5 max-w-xl text-[1.05rem] leading-relaxed text-muted-foreground">Switch backgrounds and variants to see which version to use, then download that exact file.</p>
        </Reveal>
        <div className="mt-10">
          <LogoPlayground />
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */

const SPACING = [4, 8, 12, 16, 24, 32, 48, 64];

function BrandDna() {
  return (
    <section id="brand-dna" className="py-16 sm:py-24" aria-labelledby="dna-title">
      <div className={wrap}>
        <Reveal className="max-w-3xl">
          <p className={cn(eyebrow, "text-primary dark:text-[#b9a6ff]")}>Brand DNA</p>
          <h2 id="dna-title" className={cn(h2, "mt-3")}>
            Color, type <span className="text-muted-foreground">and space.</span>
          </h2>
        </Reveal>

        <h3 className="mt-12 font-heading text-[1.2rem] font-bold tracking-tight">Colors</h3>
        <p className="mt-1 text-sm text-muted-foreground">Click a color to copy its hex code.</p>
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {BRAND_COLORS.map((c) => (
            <ColorCard key={c.hex} name={c.name} hex={c.hex} role={c.role} ink={c.ink} />
          ))}
        </div>
        <div className="mt-4 flex h-3 overflow-hidden rounded-full" aria-hidden title="Rough proportion of use">
          <span className="w-[22%] bg-[#7047EB]" />
          <span className="w-[4%] bg-[#C8FF52]" />
          <span className="w-[24%] bg-[#202127]" />
          <span className="flex-1 bg-muted" />
        </div>
        <p className="mt-2 text-[0.8rem] text-muted-foreground">Mostly neutral surfaces, violet for emphasis, a touch of lime, graphite for text.</p>

        <h3 className="mt-16 font-heading text-[1.2rem] font-bold tracking-tight">Typography</h3>
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="group rounded-[2rem] border bg-card p-6 transition-colors duration-300 hover:border-primary/30 sm:p-8 dark:bg-white/[0.03]">
            <p className="font-heading text-[6rem] leading-none font-extrabold tracking-[-0.06em] transition-[font-weight] duration-500 group-hover:font-light motion-reduce:transition-none">Aa</p>
            <p className="mt-6 font-heading text-xl font-bold">Manrope</p>
            <p className="text-sm text-muted-foreground">Headings and display. Extrabold, tightly tracked.</p>
            <p className="mt-4 font-heading text-[0.95rem] break-all text-foreground/70">ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789</p>
          </div>
          <div className="group rounded-[2rem] border bg-card p-6 transition-colors duration-300 hover:border-primary/30 sm:p-8 dark:bg-white/[0.03]">
            <p className="text-[6rem] leading-none font-medium tracking-[-0.04em] transition-[font-weight] duration-500 group-hover:font-black motion-reduce:transition-none">Aa</p>
            <p className="mt-6 text-xl font-semibold">Inter</p>
            <p className="text-sm text-muted-foreground">Body text and interface. Regular to semibold.</p>
            <p className="mt-4 text-[0.95rem] break-all text-foreground/70">ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789</p>
          </div>
        </div>
        <div className="mt-4">
          <TypeTester />
        </div>

        <h3 className="mt-16 font-heading text-[1.2rem] font-bold tracking-tight">Spacing</h3>
        <p className="mt-1 text-sm text-muted-foreground">Everything sits on a 4px grid, so layouts stay calm and consistent.</p>
        <ul className="mt-6 flex flex-wrap items-end gap-3 sm:gap-5">
          {SPACING.map((s) => (
            <li key={s} className="flex flex-col items-center gap-2">
              <span className="block w-6 rounded-md bg-primary/80 dark:bg-[#9277f4]" style={{ height: s * 1.5 }} aria-hidden />
              <span className="font-mono text-[0.72rem] text-muted-foreground tabular-nums">{s}px</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */

const STATEMENTS = ["Smarter Social", "Bigger Impact", "Clear before clever", "Honest by default", "One connected platform", "Built for clarity"];

function Marquee({ reverse, outline }: { reverse?: boolean; outline?: boolean }) {
  const row = [...STATEMENTS, ...STATEMENTS];
  return (
    <div className="marquee-wrap overflow-hidden mask-x-from-90% mask-x-to-100%" aria-hidden>
      <div className="marquee flex w-max gap-10 py-2" style={reverse ? { animationDirection: "reverse" } : undefined}>
        {row.map((s, i) => (
          <span key={i} className={cn("flex items-center gap-10 font-heading text-[clamp(2.6rem,8vw,6rem)] leading-none font-extrabold tracking-[-0.05em] whitespace-nowrap", outline ? "text-transparent [-webkit-text-stroke:1.5px_rgb(255_255_255/0.32)]" : "text-white")}>
            {s}
            <span className="size-3 rounded-full bg-lime sm:size-4" />
          </span>
        ))}
      </div>
    </div>
  );
}

function InMotion() {
  return (
    <section id="brand-in-motion" className="dark relative isolate overflow-hidden bg-[#0b0c10] py-16 text-foreground sm:py-24" aria-labelledby="motion-title">
      <div className="pointer-events-none absolute -top-40 -left-40 -z-10 size-[34rem] rounded-full bg-[radial-gradient(closest-side,rgb(112_71_235/0.3),transparent)]" aria-hidden />
      <div className={wrap}>
        <Reveal className="max-w-3xl">
          <p className={cn(eyebrow, "text-lime")}>Brand in motion</p>
          <h2 id="motion-title" className={cn(h2, "mt-3 text-white")}>
            Calm, clear, <span className="text-white/40">always moving forward.</span>
          </h2>
          <p className="mt-5 max-w-xl text-[1.05rem] leading-relaxed text-white/60">Motion at Sociotix is slow and purposeful: it guides attention, never steals it, and stops completely for anyone who prefers reduced motion.</p>
        </Reveal>
      </div>
      <div className="mt-12 space-y-2 sm:mt-16">
        <Marquee />
        <Marquee reverse outline />
      </div>
      <div className={cn(wrap, "mt-14 sm:mt-20")}>
        <p className="mb-4 text-[0.72rem] font-semibold tracking-[0.14em] text-white/45 uppercase">Interface style · illustrative</p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3" aria-hidden>
          <div className="ai-float rounded-[1.6rem] bg-white/[0.04] p-5 ring-1 ring-white/10">
            <p className="text-[0.72rem] font-semibold tracking-[0.12em] text-white/45 uppercase">Order tracking</p>
            <div className="mt-4 space-y-3">
              {["Placed", "Paid", "Verified", "In delivery"].map((s, i) => (
                <div key={s} className="flex items-center gap-3">
                  <span className={cn("grid size-6 place-items-center rounded-full", i < 3 ? "bg-primary text-white" : "border-2 border-dashed border-white/30")}>{i < 3 ? <Check className="size-3.5" /> : null}</span>
                  <span className={cn("text-sm", i < 3 ? "text-white" : "text-white/50")}>{s}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="ai-float-delayed rounded-[1.6rem] bg-white/[0.04] p-5 ring-1 ring-white/10">
            <p className="text-[0.72rem] font-semibold tracking-[0.12em] text-white/45 uppercase">Marketplace</p>
            <p className="mt-4 font-heading text-lg font-bold text-white">Instagram Followers</p>
            <p className="text-sm text-white/55">Instagram · Followers &amp; members</p>
            <div className="mt-5 flex items-center justify-between">
              <span className="text-[0.8rem] text-white/55">Pricing on activation</span>
              <span className="rounded-full bg-white/10 px-2.5 py-1 text-[0.72rem] font-semibold text-white">View service</span>
            </div>
          </div>
          <div className="ai-float rounded-[1.6rem] bg-[linear-gradient(160deg,rgb(112_71_235/0.35),rgb(112_71_235/0.06))] p-5 ring-1 ring-white/10">
            <p className="flex items-center justify-between text-[0.72rem] font-semibold tracking-[0.12em] text-white/60 uppercase">
              Sociotix AI <span className="rounded-full bg-lime/15 px-2 py-0.5 tracking-normal text-lime normal-case">Coming soon</span>
            </p>
            <p className="mt-4 text-sm text-white/80">Brief: autumn menu launch · Instagram</p>
            <div className="mt-4 space-y-2">
              {["w-[92%]", "w-[74%]", "w-[52%]"].map((w) => (
                <span key={w} className={cn("block h-2 rounded-full bg-white/20", w)} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */

const ECOSYSTEM = [
  { name: "Social media services marketplace", status: `Browse ${CATALOG_TOTALS.services} services across ${CATALOG_TOTALS.platforms} platforms now; ordering opens service by service`, live: true },
  { name: "AI marketing tools", status: "Coming soon; nothing is generated today", live: false },
  { name: "Social media management", status: "Workspace, drafts and calendar available; account connections switch on per platform", live: true },
  { name: "Marketing automation", status: "Planning routines available; AI-assisted drafts coming soon", live: true },
];

function GuideTile({ ok, title, children }: { ok: boolean; title: string; children: React.ReactNode }) {
  return (
    <li className="overflow-hidden rounded-2xl border bg-card dark:bg-white/[0.03]">
      <div className="grid h-32 place-items-center bg-subtle/60 dark:bg-white/[0.03]">{children}</div>
      <p className="flex items-center gap-2 px-4 py-3 text-[0.88rem] font-medium">
        <span className={cn("grid size-5 shrink-0 place-items-center rounded-full", ok ? "bg-lime text-graphite" : "bg-destructive/15 text-destructive")}>{ok ? <Check className="size-3" aria-hidden /> : <X className="size-3" aria-hidden />}</span>
        <span>
          <span className="sr-only">{ok ? "Do: " : "Don't: "}</span>
          {title}
        </span>
      </p>
    </li>
  );
}

function Resources() {
  return (
    <section id="resources" className="border-t py-16 sm:py-24" aria-labelledby="resources-title">
      <div className={wrap}>
        <Reveal className="max-w-3xl">
          <p className={cn(eyebrow, "text-primary dark:text-[#b9a6ff]")}>About &amp; resources</p>
          <h2 id="resources-title" className={cn(h2, "mt-3")}>
            How to talk <span className="text-muted-foreground">about Sociotix.</span>
          </h2>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          <div>
            <h3 className="text-[0.72rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">Tagline</h3>
            <p className="mt-2 font-heading text-[2rem] leading-tight font-extrabold tracking-[-0.03em] sm:text-[2.4rem]">
              Smarter Social. <span className="text-primary dark:text-[#a993ff]">Bigger Impact.</span>
            </p>
            <h3 className="mt-8 text-[0.72rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">Company description</h3>
            <p className="mt-2 text-[1.05rem] leading-relaxed text-foreground/85">{BOILERPLATE}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <CopyText text={BOILERPLATE} label="Copy description" />
              <CopyText text="Smarter Social. Bigger Impact." label="Copy tagline" />
            </div>
          </div>
          <div>
            <h3 className="text-[0.72rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">What Sociotix includes</h3>
            <ul className="mt-3 divide-y border-y">
              {ECOSYSTEM.map((e) => (
                <li key={e.name} className="flex gap-3 py-4">
                  <span className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", e.live ? "bg-lime ring-2 ring-lime/30" : "border border-dashed border-muted-foreground")} aria-hidden />
                  <span>
                    <span className="block font-semibold">{e.name}</span>
                    <span className="block text-sm text-muted-foreground">
                      <span className="sr-only">{e.live ? "Available now: " : "Coming soon: "}</span>
                      {e.status}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <h3 className="mt-16 font-heading text-[1.2rem] font-bold tracking-tight">Downloads</h3>
        <ul className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {BRAND_ASSETS.map((a) => {
            const dark = a.id === "logo-reversed";
            return (
              <li key={a.id} className="group overflow-hidden rounded-2xl border bg-card transition-colors duration-200 hover:border-primary/30 dark:bg-white/[0.03]">
                <div className={cn("grid h-36 place-items-center p-6", dark ? "bg-[#0e0f13]" : "bg-[repeating-conic-gradient(rgb(128_128_128/0.08)_0%_25%,transparent_0%_50%)] bg-size-[18px_18px]")}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- small static brand previews, shown as-is */}
                  <img src={a.file} alt={`${a.label} preview`} width={a.id.startsWith("logo") ? 220 : 72} height={72} className={cn("max-h-20 w-auto object-contain transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none", a.id.startsWith("logo") ? "max-w-[85%]" : "")} loading="lazy" />
                </div>
                <div className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {a.label} <span className="ms-1 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.68rem] text-muted-foreground">{a.format}</span>
                    </p>
                    <p className="truncate text-[0.8rem] text-muted-foreground">
                      {a.size} · {a.use}
                    </p>
                  </div>
                  <a
                    href={a.file}
                    download
                    className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-primary text-primary-foreground transition-colors duration-150 hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2 focus-visible:outline-none"
                  >
                    <Download className="size-4" aria-hidden />
                    <span className="sr-only">
                      Download {a.label} ({a.format})
                    </span>
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-sm text-muted-foreground">
          Need product screenshots or a different format? Email{" "}
          <a href={`mailto:${MEDIA_CONTACT}?subject=${encodeURIComponent("Media kit request")}`} className="font-medium text-primary underline decoration-primary/30 underline-offset-[3px] hover:decoration-primary dark:text-[#b9a6ff]">
            {MEDIA_CONTACT}
          </a>
          .
        </p>

        <h3 className="mt-16 font-heading text-[1.2rem] font-bold tracking-tight">Logo usage</h3>
        <ul className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <GuideTile ok title="Give it room to breathe">
            <span className="relative p-4">
              <span className="absolute inset-0 rounded-lg border-2 border-dashed border-primary/40" aria-hidden />
              <Mark className="size-12" />
            </span>
          </GuideTile>
          <GuideTile ok title="Use the graphite mark on violet">
            <span className="grid size-24 place-items-center rounded-xl bg-[#7047EB]">
              <Mark tile="#202127" className="size-12" />
            </span>
          </GuideTile>
          <GuideTile ok={false} title="Don't stretch or squash it">
            <Mark className="size-12 scale-x-[1.7] scale-y-[0.8]" />
          </GuideTile>
          <GuideTile ok={false} title="Don't recolor or rotate it">
            <Mark tile="#e2483d" className="size-12 rotate-12" />
          </GuideTile>
        </ul>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */

function Closing() {
  const contacts = [
    { icon: Newspaper, title: "Media & press", body: "Interviews, quotes and brand questions.", subject: "Media enquiry" },
    { icon: Handshake, title: "Partnerships", body: "Collaborations and integrations.", subject: "Partnership enquiry" },
  ];
  return (
    <section className="px-4 pb-16 sm:px-6 sm:pb-24 lg:px-8" aria-labelledby="closing-title">
      <Reveal className="relative isolate mx-auto max-w-7xl overflow-hidden rounded-[2.5rem] bg-[#15161b] px-6 py-16 text-white sm:px-12 sm:py-24">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_80%_at_10%_0%,rgb(112_71_235/0.55),transparent_70%),radial-gradient(40%_60%_at_100%_100%,rgb(200_255_82/0.14),transparent_70%)]" aria-hidden />
        <div className="pointer-events-none absolute -right-16 -bottom-20 -z-10 hidden w-[24rem] rotate-12 opacity-90 lg:block xl:-right-8" aria-hidden>
          <div className="ai-float">
            <Mark tile="#7047EB" className="w-full drop-shadow-[0_40px_60px_rgb(112_71_235/0.5)]" />
          </div>
        </div>
        <Sparkles className="size-6 text-lime" aria-hidden />
        <h2 id="closing-title" className="mt-6 max-w-4xl font-heading text-[2.5rem] leading-[0.98] font-extrabold tracking-[-0.05em] text-balance sm:text-[4rem] lg:text-[4.8rem]">
          Let&apos;s Make Something <span className="text-lime">Worth Talking About.</span>
        </h2>
        <ul className="mt-12 grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2">
          {contacts.map((c) => (
            <li key={c.title}>
              <a
                href={`mailto:${MEDIA_CONTACT}?subject=${encodeURIComponent(c.subject)}`}
                className="group flex h-full items-start gap-4 rounded-2xl bg-white/[0.06] p-5 ring-1 ring-white/10 transition-[background-color,transform] duration-200 hover:-translate-y-0.5 hover:bg-white/[0.1] focus-visible:ring-2 focus-visible:ring-lime/60 focus-visible:outline-none motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/10 text-lime">
                  <c.icon className="size-5" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 font-heading text-lg font-bold">
                    {c.title} <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none" aria-hidden />
                  </span>
                  <span className="block text-sm text-white/60">{c.body}</span>
                  <span className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-white/85">
                    <Mail className="size-3.5" aria-hidden /> {MEDIA_CONTACT}
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </Reveal>
    </section>
  );
}

export function MediaKit() {
  return (
    <>
      <Hero />
      <Playground />
      <BrandDna />
      <InMotion />
      <Resources />
      <Closing />
    </>
  );
}
