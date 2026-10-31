import { Suspense } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  ChevronDown,
  Clock3,
  Layers3,
  ListChecks,
  MousePointerClick,
  ReceiptText,
  Search,
  Share2,
  ShieldCheck,
  Sparkles,
  Store,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { PlatformTile } from "@/components/brand";
import { Parallax } from "@/components/site/about-parallax";
import { Reveal } from "@/components/site/primitives";
import { viewerFromSession } from "@/components/site/public-header";
import { CATALOG_TOTALS, PLATFORMS, type Platform } from "@/lib/catalog";
import { cn } from "@/lib/utils";

/*
 * About Sociotix. Server-rendered and honest: every product says what works today and what is
 * still awaiting activation. No invented history, team size, statistics or testimonials.
 * Rhythm: light hero → graphite story → light product showcase → dark principles → light FAQ.
 */

export const ABOUT_TITLE = "About Sociotix — AI Social Growth & Marketing Platform";
export const ABOUT_DESCRIPTION =
  "Sociotix brings a social media services marketplace, AI marketing tools, social media management and automation together in one clear, honest platform.";

const wrap = "mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8";
const eyebrow = "text-[0.74rem] font-semibold tracking-[0.16em] uppercase";
const h2 = "font-heading text-[2.1rem] leading-[1.04] font-extrabold tracking-[-0.04em] text-balance sm:text-[2.75rem] lg:text-[3.1rem]";
const primaryCta =
  "group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 text-[0.95rem] font-semibold text-primary-foreground shadow-[0_14px_32px_-16px_rgb(112_71_235/0.9),inset_0_1px_0_rgb(255_255_255/0.2)] transition-[background-color,box-shadow,transform] duration-200 hover:-translate-y-px hover:bg-primary/92 active:translate-y-0 focus-visible:ring-3 focus-visible:ring-primary/35 focus-visible:outline-none motion-reduce:transition-none motion-reduce:hover:translate-y-0";
const arrow = <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden />;
/** Drifts a server-rendered layer with the pointer (see `Parallax`); `depth` is the max offset in px. */
const drift = (depth: number) => ({ translate: `calc(var(--px, 0) * ${depth}px) calc(var(--py, 0) * ${depth}px)` });

const platform = (id: string) => PLATFORMS.find((p) => p.id === id) as Platform;
const listOf = (names: string[]) => (names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`);

/* -------------------------------------------------------------------------- */
/* Session-aware account CTA (guests see the sign-up link in the static HTML). */

function GuestAccountCta({ className }: { className: string }) {
  return (
    <Link href="/register" className={className}>
      Create a free account {arrow}
    </Link>
  );
}

async function AccountCta({ className }: { className: string }) {
  const viewer = await viewerFromSession();
  if (typeof viewer === "object" && viewer.kind === "customer") {
    return (
      <Link href="/dashboard" className={className}>
        Open your dashboard {arrow}
      </Link>
    );
  }
  return <GuestAccountCta className={className} />;
}

function AccountLink({ className }: { className: string }) {
  return (
    <Suspense fallback={<GuestAccountCta className={className} />}>
      <AccountCta className={className} />
    </Suspense>
  );
}

/* -------------------------------------------------------------------------- */
/* 1. Hero: the Sociotix ecosystem as an orbit                                 */

const ORBIT_PLATFORMS = ["instagram", "tiktok", "youtube", "facebook", "x", "linkedin"].map(platform);

/** The four products, pinned to the corners of the orbit and wired to the core. */
const NODES: { name: string; detail: string; href: string; icon: LucideIcon; open: boolean; pos: string; tone: "violet" | "graphite" }[] = [
  { name: "Marketplace", detail: `${CATALOG_TOTALS.services} services`, href: "/#services", icon: Store, open: true, pos: "top-[2%] left-0", tone: "violet" },
  { name: "Sociotix AI", detail: "Marketing tools", href: "/ai-tools", icon: Sparkles, open: false, pos: "top-[2%] right-0", tone: "graphite" },
  { name: "Social workspace", detail: "Drafts & calendar", href: "/social-management", icon: Share2, open: true, pos: "bottom-[2%] left-0", tone: "violet" },
  { name: "Automation", detail: "Planning routines", href: "#what-we-do", icon: Workflow, open: true, pos: "bottom-[2%] right-0", tone: "violet" },
];
const BEAM_ENDS = [
  [92, 60],
  [308, 60],
  [92, 340],
  [308, 340],
];

function EcosystemOrbit() {
  return (
    <Parallax className="about-orbit relative mx-auto aspect-square w-full max-w-[21rem] min-[400px]:max-w-[24rem] sm:max-w-[30rem] lg:max-w-[34rem]">
      {/* Rings, orbiting platforms and the core: one gently drifting layer. */}
      <div className="absolute inset-0 transition-[translate] duration-700 ease-out" style={drift(6)} aria-hidden>
        <div className="absolute inset-[18%] rounded-full bg-[radial-gradient(closest-side,rgb(112_71_235/0.16),transparent)] dark:bg-[radial-gradient(closest-side,rgb(112_71_235/0.3),transparent)]" />
        <div className="absolute inset-[5%] rounded-full border border-dashed border-foreground/[0.09]" />
        <div className="absolute inset-[19%] rounded-full border border-foreground/[0.08] bg-card/30 dark:bg-white/[0.015]" />
        <div className="absolute inset-[31%] rounded-full border border-primary/20" />

        {/* Outer signals travel slowly the other way. */}
        <div className="about-orbit-slow absolute inset-[5%]">
          <span className="absolute top-0 left-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-lime shadow-[0_0_0_4px_rgb(200_255_82/0.18)]" />
          <span className="absolute bottom-0 left-1/2 size-2 -translate-x-1/2 translate-y-1/2 rounded-full bg-primary shadow-[0_0_0_4px_rgb(112_71_235/0.18)]" />
        </div>

        {/* Platforms orbit the core and stay upright. */}
        <div className="about-orbit-spin absolute inset-[19%]">
          {ORBIT_PLATFORMS.map((p, i) => {
            const angle = i * (360 / ORBIT_PLATFORMS.length);
            return (
              <div key={p.id} className="absolute inset-0" style={{ transform: `rotate(${angle}deg)` }}>
                <div className="absolute top-0 left-1/2" style={{ transform: `translate(-50%, -50%) rotate(${-angle}deg)` }}>
                  <div className="about-orbit-counter">
                    <PlatformTile platform={p} size="sm" className="shadow-[0_10px_22px_-12px_rgb(32_33_39/0.6)] sm:size-10 sm:rounded-xl sm:[&_svg]:size-5" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <svg viewBox="0 0 400 400" className="absolute inset-0 size-full text-primary">
          {BEAM_ENDS.map(([x, y], i) => (
            <line key={i} data-beam={i} x1="200" y1="200" x2={x} y2={y} stroke="currentColor" strokeOpacity="0.35" strokeWidth="1" strokeDasharray="4 6" className="about-dash transition-[stroke-opacity,stroke-width] duration-200" />
          ))}
        </svg>

        {/* The core. */}
        <div className="about-pulse absolute inset-[39%] rounded-[30%] border-2 border-primary/40" />
        <div className="absolute inset-[39%] grid place-items-center rounded-[30%] bg-graphite shadow-[0_24px_50px_-18px_rgb(32_33_39/0.85),inset_0_1px_0_rgb(255_255_255/0.12)] ring-4 ring-background dark:bg-[#202127] dark:ring-white/10">
          <svg viewBox="0 0 32 32" className="w-[46%]">
            <path d="M20.6 10.4c-1.1-1-2.7-1.6-4.5-1.6-2.9 0-4.9 1.5-4.9 3.7 0 4.6 8.6 3 8.6 6.3 0 1.1-1.2 1.9-3 1.9-1.6 0-3-.6-4-1.6" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
            <circle cx="23" cy="22.5" r="2.6" fill="#C8FF52" />
          </svg>
        </div>
      </div>

      {/* Product nodes and their connections drift a little further (depth). */}
      <div className="absolute inset-0 transition-[translate] duration-700 ease-out" style={drift(14)}>
        <nav aria-label="Sociotix products">
          <ul>
            {NODES.map((n, i) => (
              <li key={n.name} className={cn("absolute", n.pos)}>
                <Link
                  href={n.href}
                  data-node={i}
                  className="group/node flex items-center gap-2 rounded-2xl border bg-card/90 p-1.5 pe-3 shadow-[0_18px_40px_-26px_rgb(32_33_39/0.55)] backdrop-blur-md transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_22px_44px_-24px_rgb(112_71_235/0.55)] focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:gap-2.5 sm:p-2 sm:pe-3.5 dark:bg-[#16171c]/90"
                >
                  <span className={cn("grid size-7 shrink-0 place-items-center rounded-xl sm:size-9", n.tone === "graphite" ? "bg-graphite text-lime dark:bg-white/10" : "bg-primary/[0.09] text-primary dark:bg-primary/20 dark:text-[#b9a6ff]")}>
                    <n.icon className="size-3.5 sm:size-[1.05rem]" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 text-[0.74rem] leading-tight font-semibold whitespace-nowrap sm:text-[0.86rem]">
                      {n.name}
                      <span className={cn("size-1.5 shrink-0 rounded-full", n.open ? "bg-lime ring-2 ring-lime/30" : "bg-muted-foreground/45")} aria-hidden />
                      <span className="sr-only">{n.open ? "(available now)" : "(coming soon)"}</span>
                    </span>
                    <span className="hidden text-[0.72rem] leading-tight text-muted-foreground sm:block">{n.detail}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </Parallax>
  );
}

function Hero() {
  return (
    <section id="top" className="relative isolate overflow-hidden" aria-labelledby="about-title">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgb(32_33_39/0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgb(32_33_39/0.045)_1px,transparent_1px)] mask-[radial-gradient(65%_60%_at_70%_40%,black,transparent)] bg-size-[48px_48px] dark:bg-[linear-gradient(to_right,rgb(255_255_255/0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.045)_1px,transparent_1px)]" aria-hidden />
      <div className={cn(wrap, "grid grid-cols-1 items-center gap-12 pt-12 pb-16 sm:pt-16 sm:pb-20 lg:grid-cols-[1.15fr_0.85fr] lg:gap-10 lg:pt-20 lg:pb-24")}>
        <div className="max-w-xl lg:max-w-none">
          <p className={cn(eyebrow, "inline-flex items-center gap-2 rounded-full border bg-card/70 py-1.5 ps-2 pe-3 text-[0.68rem] text-foreground/75 backdrop-blur")}>
            <span className="grid size-4 place-items-center rounded-full bg-primary text-primary-foreground">
              <span className="size-1.5 rounded-full bg-lime" />
            </span>
            About Sociotix
          </p>
          <h1 id="about-title" className="mt-6 font-heading text-[2.85rem] leading-[0.98] font-extrabold tracking-[-0.05em] min-[400px]:text-[3.3rem] sm:text-[4.3rem] lg:text-[3.1rem] xl:text-[4rem]">
            Where social growth <br className="hidden sm:block" />
            <span className="relative inline-block text-primary dark:text-[#a993ff]">
              comes together.
              <svg viewBox="0 0 300 14" preserveAspectRatio="none" className="absolute -bottom-1.5 left-0 h-3 w-full text-lime sm:-bottom-2" aria-hidden>
                <path d="M3 9c60-6 140-8 294-3" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
              </svg>
            </span>
          </h1>
          <p className="mt-7 max-w-xl text-[1.08rem] leading-relaxed text-muted-foreground sm:text-lg">
            Sociotix is an AI-powered social growth and marketing platform. Services, AI marketing tools, social media management and automation live in one account, with clear information at every step.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
            <Link href="/" className={primaryCta}>
              Explore the platform {arrow}
            </Link>
            <a href="#who-we-are" className="inline-flex items-center gap-1.5 rounded-md text-sm font-semibold text-foreground/75 transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none">
              Our story <ChevronDown className="size-4" aria-hidden />
            </a>
          </div>
          <dl className="mt-10 grid max-w-md grid-cols-3 divide-x border-t pt-5">
            {[
              [String(CATALOG_TOTALS.services), "services listed"],
              [String(CATALOG_TOTALS.platforms), "platforms"],
              ["4", "products, one account"],
            ].map(([v, l]) => (
              <div key={l} className="px-4 first:ps-0">
                <dt className="sr-only">{l}</dt>
                <dd className="font-heading text-[1.6rem] leading-none font-extrabold tracking-tight tabular-nums">{v}</dd>
                <dd className="mt-1.5 text-[0.76rem] leading-snug text-muted-foreground">{l}</dd>
              </div>
            ))}
          </dl>
        </div>
        <EcosystemOrbit />
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* 2. Who we are: our story and the experience behind the platform             */

/**
 * The disciplines the people behind Sociotix come from, and what each brings to the platform.
 * The 10+ years describes that team's experience, never the company's age; it isn't in structured data.
 */
const EXPERIENCE = [
  { field: "Technology & software development", brings: "A secure, dependable platform" },
  { field: "AI & automation", brings: "Tools that save time, built responsibly" },
  { field: "Digital marketing & social media", brings: "Services shaped by how platforms really work" },
  { field: "Business growth & transformation", brings: "Clear processes that help businesses grow" },
];

function WhoWeAre() {
  return (
    <section id="who-we-are" className="dark relative isolate scroll-mt-16 overflow-hidden bg-[#17181d] py-20 text-foreground sm:py-28" aria-labelledby="who-title">
      <div className="pointer-events-none absolute -top-48 -left-32 -z-10 size-[34rem] rounded-full bg-[radial-gradient(closest-side,rgb(112_71_235/0.28),transparent)]" aria-hidden />
      <div className={wrap}>
        {/* Heading and the experience highlight. */}
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.25fr_0.75fr] lg:items-end lg:gap-16">
          <Reveal>
            <p className={cn(eyebrow, "text-lime")}>Who we are</p>
            <h2 id="who-title" className="mt-5 font-heading text-[2.4rem] leading-[1.02] font-extrabold tracking-[-0.045em] text-white sm:text-[3.5rem] lg:text-[3.1rem] xl:text-[3.8rem]">
              <span className="block">Built on experience.</span> <span className="block text-white/40">Driven by innovation.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.05} className="border-white/10 lg:border-s lg:ps-10">
            <p className="flex items-start font-heading leading-none font-extrabold tracking-[-0.06em] text-white">
              <span className="text-[5.5rem] sm:text-[7rem]">10</span>
              <span className="mt-2 text-[3rem] text-lime sm:text-[4rem]">+</span>
            </p>
            <p className="mt-3 max-w-xs text-[1.02rem] leading-snug font-semibold text-white">Years of experience in technology, marketing &amp; business growth</p>
            <p className="mt-2 max-w-xs text-[0.8rem] leading-relaxed text-white/45">The combined background of the people behind Sociotix, not the age of the company.</p>
          </Reveal>
        </div>

        {/* Why it exists, and the story in plain words. */}
        <div className="mt-14 grid grid-cols-1 gap-10 border-t border-white/10 pt-12 sm:mt-20 sm:pt-16 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
          <Reveal>
            <h3 className="text-[0.72rem] font-semibold tracking-[0.16em] text-white/45 uppercase">Why Sociotix exists</h3>
            <p className="mt-4 font-heading text-[1.7rem] leading-[1.15] font-extrabold tracking-[-0.03em] text-balance text-white sm:text-[2.1rem]">
              Growing on social shouldn&apos;t take <span className="text-white/35 line-through decoration-lime decoration-[0.09em]">ten tabs</span> and a{" "}
              <span className="text-white/35 line-through decoration-lime decoration-[0.09em]">leap of faith.</span>
            </p>
          </Reveal>
          <Reveal delay={0.05} className="space-y-5 text-[1.02rem] leading-relaxed text-white/65">
            <h3 className="text-[0.72rem] font-semibold tracking-[0.16em] text-white/45 uppercase">Our story</h3>
            <p>
              <span className="font-semibold text-white">Sociotix is built by professionals from technology, AI, digital marketing and business growth.</span> Across our work, we kept meeting the same problem: growing online meant juggling scattered tools, vague service listings and dashboards that hid what was happening.
            </p>
            <p>
              So we created one connected platform for it, bringing social media services, AI-powered marketing tools, social media management and marketing automation together in a single account.
            </p>
            <p>
              Our aim is simple: make digital growth clearer and more accessible for creators, small businesses and growing brands, and stay honest about what works today and what&apos;s still on its way.
            </p>
          </Reveal>
        </div>

        {/* The experience that informs the platform, converging on Sociotix. */}
        <Reveal delay={0.05} className="mt-14 sm:mt-20">
          <h3 className="text-[0.72rem] font-semibold tracking-[0.16em] text-white/45 uppercase">The experience behind the platform</h3>
          <ol className="relative mt-8 grid grid-cols-1 gap-7 lg:grid-cols-5 lg:gap-4">
            {/* The connecting line: vertical on phones and tablets, horizontal from 1024px. */}
            <span className="absolute top-2 bottom-12 left-[5px] w-px bg-[linear-gradient(to_bottom,rgb(255_255_255/0.15),rgb(200_255_82/0.6))] lg:top-[5px] lg:right-[10%] lg:bottom-auto lg:left-0 lg:h-px lg:w-auto lg:bg-[linear-gradient(to_right,rgb(255_255_255/0.15),rgb(200_255_82/0.6))]" aria-hidden />
            {EXPERIENCE.map((e) => (
              <li key={e.field} className="relative ps-8 lg:ps-0 lg:pt-8 lg:pe-4">
                <span className="absolute top-1 left-0 size-[11px] rounded-full border-2 border-[#17181d] bg-white/50 ring-1 ring-white/25 lg:top-0" aria-hidden />
                <p className="font-heading text-[1rem] leading-snug font-bold tracking-[-0.01em] text-white">{e.field}</p>
                <p className="mt-1.5 text-[0.86rem] leading-relaxed text-white/50">{e.brings}</p>
              </li>
            ))}
            <li className="relative ps-8 lg:ps-0 lg:pt-8">
              <span className="absolute top-0 -left-[3px] grid size-[17px] place-items-center rounded-full bg-lime shadow-[0_0_0_6px_rgb(200_255_82/0.15)] lg:-top-[3px] lg:left-0" aria-hidden>
                <span className="size-1.5 rounded-full bg-graphite" />
              </span>
              <p className="font-heading text-[1rem] leading-snug font-bold tracking-[-0.01em] text-lime">Sociotix</p>
              <p className="mt-1.5 text-[0.86rem] leading-relaxed text-white/65">One connected platform for social growth</p>
            </li>
          </ol>
        </Reveal>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* 3. What we do: an asymmetric product showcase                               */

function MarketplaceVisual() {
  const rows = [
    { p: platform("instagram"), name: "Instagram Followers" },
    { p: platform("youtube"), name: "YouTube Channel Subscribers" },
    { p: platform("tiktok"), name: "TikTok Video Views" },
  ];
  return (
    <div className="rounded-2xl border bg-background/80 p-2.5 shadow-[0_24px_50px_-34px_rgb(32_33_39/0.5)] transition-transform duration-300 group-hover:-translate-y-1 motion-reduce:transition-none dark:bg-white/[0.03]" aria-hidden>
      <div className="flex items-center gap-2 rounded-xl bg-muted/70 px-3 py-2.5 text-[0.8rem] text-muted-foreground dark:bg-white/[0.05]">
        <Search className="size-3.5" /> Search {CATALOG_TOTALS.services} services…
      </div>
      <ul className="mt-1.5">
        {rows.map((r, i) => (
          <li key={r.name} className={cn("flex items-center gap-2.5 rounded-xl px-2 py-2", i === 0 && "bg-primary/[0.06] dark:bg-primary/15")}>
            <PlatformTile platform={r.p} size="xs" />
            <span className="min-w-0 flex-1 truncate text-[0.8rem] font-medium">{r.name}</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[0.66rem] font-semibold text-muted-foreground dark:bg-white/10">Details</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AiVisual() {
  return (
    <div className="rounded-2xl bg-white/[0.05] p-3 ring-1 ring-white/10 transition-transform duration-300 group-hover:-translate-y-1 motion-reduce:transition-none" aria-hidden>
      <p className="text-[0.64rem] font-semibold tracking-[0.14em] text-white/40 uppercase">Your brief</p>
      <p className="mt-1 text-[0.8rem] text-white/85">Autumn menu launch · Instagram</p>
      <div className="mt-3 rounded-xl bg-white/[0.05] p-3">
        <span className="flex items-center justify-between text-[0.66rem]">
          <span className="text-white/50">Caption draft</span>
          <span className="rounded-full bg-lime/15 px-2 py-0.5 font-semibold text-lime">Coming soon</span>
        </span>
        <span className="mt-2.5 block space-y-1.5">
          {["w-[92%]", "w-[78%]", "w-[54%]"].map((w) => (
            <span key={w} className={cn("block h-1.5 rounded-full bg-white/15", w)} />
          ))}
        </span>
      </div>
    </div>
  );
}

function SocialVisual() {
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  const drafts: Record<number, string> = { 1: platform("instagram").color, 3: platform("linkedin").color, 4: platform("tiktok").color, 6: platform("youtube").color };
  return (
    <div className="rounded-2xl border bg-background/80 p-3 transition-transform duration-300 group-hover:-translate-y-1 motion-reduce:transition-none dark:bg-white/[0.03]" aria-hidden>
      <div className="flex items-center justify-between">
        <span className="flex -space-x-1.5">
          {["instagram", "facebook", "linkedin"].map((id) => (
            <PlatformTile key={id} platform={platform(id)} size="xs" className="ring-2 ring-background" />
          ))}
        </span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[0.64rem] font-semibold text-muted-foreground dark:bg-white/10">Read-only</span>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1">
        {days.map((d, i) => (
          <span key={i} className="flex flex-col items-center gap-1.5 rounded-lg bg-muted/50 py-2 dark:bg-white/[0.04]">
            <span className="text-[0.6rem] font-semibold text-muted-foreground">{d}</span>
            <span className="h-1.5 w-3/5 rounded-full" style={{ backgroundColor: drafts[i] ?? "transparent" }} />
          </span>
        ))}
      </div>
    </div>
  );
}

function AutomationVisual() {
  const steps: { icon: LucideIcon; text: string }[] = [
    { icon: Clock3, text: "Every Monday · 09:00" },
    { icon: ListChecks, text: "Checklist: review this week's drafts" },
    { icon: Bell, text: "Reminder sent to you" },
  ];
  return (
    <div className="rounded-2xl border bg-background/80 p-3 transition-transform duration-300 group-hover:-translate-y-1 motion-reduce:transition-none dark:bg-white/[0.03]" aria-hidden>
      <ol className="space-y-1">
        {steps.map((s, i) => (
          <li key={s.text} className="relative flex items-center gap-2.5 py-1">
            {i < steps.length - 1 ? <span className="absolute top-8 left-[0.95rem] h-3 w-px bg-border" /> : null}
            <span className="grid size-[1.9rem] shrink-0 place-items-center rounded-lg bg-primary/[0.08] text-primary dark:bg-primary/20 dark:text-[#b9a6ff]">
              <s.icon className="size-3.5" />
            </span>
            <span className="truncate text-[0.8rem] font-medium">{s.text}</span>
          </li>
        ))}
      </ol>
      <div className="mt-2 flex items-center justify-between rounded-xl bg-muted/60 px-3 py-2 text-[0.72rem] text-muted-foreground dark:bg-white/[0.05]">
        Runs after you activate it
        <span className="relative h-4 w-7 rounded-full bg-primary">
          <span className="absolute top-0.5 right-0.5 size-3 rounded-full bg-white" />
        </span>
      </div>
    </div>
  );
}

type Pillar = { title: string; body: string; now: string; next: string; href: string; link: string; visual: React.ReactNode; className: string; inner?: string; dark?: boolean };

function pillars(liveSocial: string[]): Pillar[] {
  return [
    {
      title: "Social Media Growth & SMM Marketplace",
      body: "Compare services for every major platform before you order: what's included, how it's delivered and what you provide.",
      now: `Browse and compare ${CATALOG_TOTALS.services} services across ${CATALOG_TOTALS.platforms} platforms.`,
      next: "Ordering and payments open service by service once each is verified.",
      href: "/#services",
      link: "Browse the marketplace",
      visual: <MarketplaceVisual />,
      className: "md:col-span-2 lg:col-span-4",
      inner: "md:grid md:grid-cols-[1fr_1fr] md:items-center md:gap-8",
    },
    {
      title: "AI-Powered Marketing Tools",
      body: "Sociotix AI turns a short brief into captions, hashtags, post ideas and plans, shaped for each platform.",
      now: "A guided page for every tool.",
      next: "Generation opens tool by tool, once each genuinely works.",
      href: "/ai-tools",
      link: "Explore AI tools",
      visual: <AiVisual />,
      className: "lg:col-span-2",
      dark: true,
    },
    {
      title: "Social Media Management",
      body: "One workspace for the accounts you manage, with drafts, per-platform previews and a content calendar.",
      now: liveSocial.length ? `The workspace and calendar, plus connections for ${listOf(liveSocial)}.` : "The workspace, drafts and content calendar.",
      next: "Account connections switch on as each platform approves Sociotix; publishing stays off until then.",
      href: "/social-management",
      link: "See Social Management",
      visual: <SocialVisual />,
      className: "lg:col-span-3",
    },
    {
      title: "Marketing Automation",
      body: "Automation Studio takes the routine off your plate: reminders, checklists, draft reviews and account health checks.",
      now: "Planning routines that run only after you activate them.",
      next: "AI-assisted workflow drafts are coming soon. Automations never publish or spend money.",
      href: "/social-management#faq",
      link: "How automation works",
      visual: <AutomationVisual />,
      className: "md:col-span-2 lg:col-span-3",
      inner: "md:grid md:grid-cols-[1fr_1fr] md:items-center md:gap-8 lg:block",
    },
  ];
}

function PillarTile({ p, index }: { p: Pillar; index: number }) {
  return (
    <Reveal delay={0.04 * index} className={cn("h-full", p.className)}>
      <article
        className={cn(
          "group relative flex h-full flex-col rounded-[1.6rem] p-5 transition-[box-shadow,border-color] duration-300 has-[a:focus-visible]:ring-3 has-[a:focus-visible]:ring-primary/40 sm:p-7",
          p.dark ? "dark bg-graphite bg-[linear-gradient(160deg,rgb(112_71_235/0.22),transparent_55%)] text-foreground ring-1 ring-white/10 hover:shadow-[0_30px_60px_-34px_rgb(112_71_235/0.7)]" : "border bg-card hover:border-primary/30 hover:shadow-[0_30px_60px_-38px_rgb(112_71_235/0.45)]",
        )}
      >
        <div className={cn("flex flex-1 flex-col gap-6", p.inner)}>
          <div className="flex flex-col">
            <span className={cn("font-mono text-xs font-semibold tabular-nums", p.dark ? "text-lime" : "text-primary dark:text-[#b9a6ff]")}>{String(index + 1).padStart(2, "0")}</span>
            <h3 className={cn("mt-3 font-heading text-[1.25rem] leading-snug font-bold tracking-[-0.02em] sm:text-[1.4rem]", p.dark && "text-white")}>{p.title}</h3>
            <p className={cn("mt-2 text-[0.95rem] leading-relaxed", p.dark ? "text-white/60" : "text-muted-foreground")}>{p.body}</p>
            <dl className="mt-5 space-y-2 text-[0.83rem] leading-relaxed">
              <div className="flex gap-2.5">
                <dt className="mt-[0.4rem] size-2 shrink-0 rounded-full bg-lime ring-2 ring-lime/30">
                  <span className="sr-only">Available now:</span>
                </dt>
                <dd className={p.dark ? "text-white/85" : "text-foreground/85"}>{p.now}</dd>
              </div>
              <div className="flex gap-2.5">
                <dt className={cn("mt-[0.4rem] size-2 shrink-0 rounded-full border border-dashed", p.dark ? "border-white/45" : "border-muted-foreground/60")}>
                  <span className="sr-only">Awaiting activation:</span>
                </dt>
                <dd className={p.dark ? "text-white/50" : "text-muted-foreground"}>{p.next}</dd>
              </div>
            </dl>
          </div>
          <div className="mt-auto">{p.visual}</div>
        </div>
        {/* The link covers the whole tile; its text names the destination. */}
        <Link
          href={p.href}
          className={cn(
            "mt-6 inline-flex w-fit items-center gap-1 text-sm font-semibold outline-none after:absolute after:inset-0 after:rounded-[1.6rem]",
            p.dark ? "text-lime" : "text-primary dark:text-[#b9a6ff]",
          )}
        >
          {p.link}
          <ArrowUpRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none" aria-hidden />
        </Link>
      </article>
    </Reveal>
  );
}

function WhatWeDo({ liveSocial }: { liveSocial: string[] }) {
  return (
    <section id="what-we-do" className="scroll-mt-16 py-16 sm:py-24" aria-labelledby="what-title">
      <div className={wrap}>
        <Reveal className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className={cn(eyebrow, "text-primary")}>What we do</p>
            <h2 id="what-title" className={cn(h2, "mt-3")}>
              Four products. <span className="text-muted-foreground">One account.</span>
            </h2>
          </div>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.8rem] text-muted-foreground" aria-hidden>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-lime ring-2 ring-lime/30" /> Available now
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full border border-dashed border-muted-foreground/60" /> Awaiting activation
            </span>
          </p>
        </Reveal>
        <div className="mt-10 grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-6">
          {pillars(liveSocial).map((p, i) => (
            <PillarTile key={p.title} p={p} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* 4. Why Sociotix                                                             */

const WHY: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: MousePointerClick, title: "Simple, intuitive workflows", body: "Pick, configure, review, confirm. Every flow is built to make sense the first time, on desktop or phone." },
  { icon: ReceiptText, title: "Transparent services and tracking", body: "Each service explains what's included and how it's delivered. Order milestones change only when confirmed, with a full activity log." },
  { icon: Clock3, title: "Intelligent tools that save time", body: "Sociotix AI is designed to turn a short brief into platform-ready drafts you review. Nothing is posted or ordered for you." },
  { icon: ShieldCheck, title: "Security-conscious by design", body: "Argon2id password hashing, mandatory two-factor sign-in for staff and read-only platform permissions, with support that sees your full order context." },
];

const FLOW = ["Discover", "Order", "Track", "Plan", "Get support"];

function WhySociotix() {
  return (
    <section id="why" className="dark relative isolate scroll-mt-16 overflow-hidden bg-[#0b0c10] py-16 text-foreground sm:py-24" aria-labelledby="why-title">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgb(200_255_82/0.4),transparent)]" aria-hidden />
      <div className="pointer-events-none absolute -top-40 -right-40 -z-10 size-[34rem] rounded-full bg-[radial-gradient(closest-side,rgb(112_71_235/0.24),transparent)]" aria-hidden />
      <div className={wrap}>
        <Reveal className="max-w-2xl">
          <p className={cn(eyebrow, "text-lime")}>Why Sociotix</p>
          <h2 id="why-title" className={cn(h2, "mt-3 text-white")}>
            Built for clarity, <span className="text-white/40">not noise.</span>
          </h2>
        </Reveal>
        <div className="mt-10 grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3 lg:grid-rows-2">
          <Reveal className="flex flex-col justify-between gap-8 rounded-[1.6rem] bg-[linear-gradient(150deg,rgb(112_71_235/0.3),rgb(112_71_235/0.06)_55%,transparent)] p-6 ring-1 ring-white/10 sm:p-8 md:col-span-2 lg:col-span-1 lg:row-span-2">
            <div>
              <span className="grid size-11 place-items-center rounded-xl bg-white/10 text-lime">
                <Layers3 className="size-5" aria-hidden />
              </span>
              <h3 className="mt-5 font-heading text-[1.45rem] leading-snug font-bold tracking-[-0.02em] text-white sm:text-[1.65rem]">One connected platform</h3>
              <p className="mt-2 max-w-md text-[0.98rem] leading-relaxed text-white/60">Services, AI tools, social management and automation share one Sociotix account, one dashboard and one support history.</p>
            </div>
            <ol className="flex flex-wrap items-center gap-1.5" aria-label="One account, from first search to support">
              {FLOW.map((step, i) => (
                <li key={step} className="flex items-center gap-1.5">
                  <span className="rounded-full bg-white/[0.07] px-3 py-1.5 text-[0.78rem] font-medium text-white/85 ring-1 ring-white/10">{step}</span>
                  {i < FLOW.length - 1 ? <ArrowRight className="size-3.5 text-white/30" aria-hidden /> : null}
                </li>
              ))}
            </ol>
          </Reveal>
          {WHY.map((w, i) => (
            <Reveal key={w.title} delay={0.04 * (i + 1)} className="rounded-[1.6rem] bg-white/[0.03] p-6 ring-1 ring-white/[0.08] transition-[background-color,box-shadow] duration-200 hover:bg-white/[0.05] hover:ring-white/15 sm:p-7">
              <w.icon className="size-5 text-lime/90" aria-hidden />
              <h3 className="mt-4 font-heading text-[1.08rem] font-bold tracking-[-0.01em] text-white">{w.title}</h3>
              <p className="mt-1.5 text-[0.9rem] leading-relaxed text-white/55">{w.body}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* 5. FAQ + final CTA                                                          */

/** FAQ text shared by the page and its FAQPage structured data (word for word). */
export function aboutFaq(liveSocial: string[]) {
  return [
    {
      q: "What is Sociotix?",
      a: "Sociotix is an AI-powered social growth and marketing platform. It brings a marketplace for social media services, AI marketing tools, social media management and marketing automation together in one account. The platform is in development, and each part opens once it genuinely works.",
    },
    {
      q: "What services does Sociotix offer?",
      a: `A catalog of ${CATALOG_TOTALS.services} social media services across ${CATALOG_TOTALS.platforms} platforms, including followers, likes, views, ads, promotion and SEO. You can browse, search and compare them today. Ordering opens service by service once pricing, fulfilment and compliance are verified.`,
    },
    {
      q: "How does Sociotix help businesses grow on social media?",
      a: "By keeping the work in one place. You can compare services with clear details before you order, follow each order through confirmed milestones, plan content in a social workspace and, as they launch, use AI tools for captions, hashtags and strategy. We don't promise followers, reach or guaranteed results, because outcomes depend on each platform.",
    },
    {
      q: "Does Sociotix offer AI marketing tools?",
      a: "Yes. Sociotix AI is a family of tools for captions, hashtags, post ideas, content calendars, growth plans and service recommendations. They're coming soon: none of them generate content today, and each opens only once it genuinely works, with free daily runs planned for signed-in accounts.",
    },
    {
      q: "Can I manage multiple social media accounts with Sociotix?",
      a: liveSocial.length
        ? `Yes. Social Management brings the accounts you manage together in one read-only workspace, with drafts and a content calendar. You can connect ${listOf(liveSocial)} today; other platforms switch on as each one approves Sociotix, and publishing stays off until posting permission is approved.`
        : "That's what Social Management is built for. Its workspace, already open to signed-in customers, brings Instagram, Facebook Pages, TikTok, YouTube, X and LinkedIn accounts together in one read-only view, with drafts and a content calendar. Account connections switch on platform by platform once each platform approves Sociotix, and publishing stays off until posting permission is approved.",
    },
    {
      q: "Is Sociotix free to use?",
      a: "Creating a Sociotix account is free, with no card or subscription. Browsing the marketplace, the Help Center and the social workspace cost nothing, and the AI tools are planned with free daily allowances when they launch. Social media services will be paid per order from your account balance once ordering and payments open.",
    },
  ];
}

const EXPLORE = [
  { label: "Marketplace", href: "/#services" },
  { label: "AI Tools", href: "/ai-tools" },
  { label: "Social Management", href: "/social-management" },
  { label: "Help Center", href: "/help" },
];

function FaqAndCta({ liveSocial }: { liveSocial: string[] }) {
  return (
    <section id="faq" className="scroll-mt-20 py-16 sm:py-24" aria-labelledby="faq-title">
      <div className={cn(wrap, "grid grid-cols-1 gap-10 lg:grid-cols-[0.8fr_1.4fr] lg:gap-16")}>
        <Reveal className="lg:sticky lg:top-28 lg:self-start">
          <p className={cn(eyebrow, "text-primary")}>FAQ</p>
          <h2 id="faq-title" className={cn(h2, "mt-3")}>
            Questions about Sociotix
          </h2>
          <p className="mt-4 max-w-md text-lg leading-relaxed text-muted-foreground">Short, straight answers. The Help Center covers orders, accounts and support in more depth.</p>
          <Link href="/help" className="mt-6 inline-flex items-center gap-1 rounded-md text-sm font-semibold text-primary hover:underline focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none dark:text-[#b9a6ff]">
            Visit the Help Center <ArrowUpRight className="size-4" aria-hidden />
          </Link>
        </Reveal>
        <div className="space-y-3">
          {aboutFaq(liveSocial).map((f, i) => (
            <details
              key={f.q}
              name="about-faq"
              open={i === 0}
              className="group rounded-2xl bg-card ring-1 ring-border transition-[box-shadow] open:shadow-[0_18px_40px_-30px_rgb(112_71_235/0.5)] open:ring-primary/30 hover:ring-foreground/15 open:hover:ring-primary/30 [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="flex cursor-pointer list-none items-center gap-4 rounded-2xl px-5 py-5 focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none sm:px-6">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-[0.75rem] font-bold text-muted-foreground tabular-nums transition-colors group-open:bg-primary group-open:text-primary-foreground" aria-hidden>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="flex-1 font-heading text-[1.02rem] leading-snug font-bold sm:text-[1.1rem]">{f.q}</h3>
                <ChevronDown className="size-5 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180 group-open:text-primary motion-reduce:transition-none" aria-hidden />
              </summary>
              <p className="px-5 pb-6 text-[0.98rem] leading-relaxed text-muted-foreground sm:px-6 sm:pl-[4.5rem]">{f.a}</p>
            </details>
          ))}
        </div>
      </div>

      <div className={cn(wrap, "mt-16 sm:mt-24")}>
        <Reveal className="relative isolate overflow-hidden rounded-[2rem] bg-graphite px-6 py-12 text-center sm:px-12 sm:py-16 dark:bg-[#15161b] dark:ring-1 dark:ring-white/10">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_70%_at_15%_0%,rgb(112_71_235/0.45),transparent_70%),radial-gradient(45%_60%_at_100%_100%,rgb(200_255_82/0.12),transparent_70%)]" aria-hidden />
          <h3 className="mx-auto max-w-2xl font-heading text-[2rem] leading-[1.04] font-extrabold tracking-[-0.04em] text-balance text-white sm:text-[2.8rem]">
            See what Sociotix can do <span className="text-lime">for your social growth.</span>
          </h3>
          <p className="mx-auto mt-4 max-w-xl text-[1.02rem] leading-relaxed text-white/60">Explore the marketplace, preview the AI tools and set up your workspace with one free account.</p>
          <div className="mt-8 flex flex-col justify-center gap-3 min-[440px]:flex-row">
            <AccountLink className={cn(primaryCta, "bg-lime text-graphite shadow-none hover:bg-lime/90 focus-visible:ring-lime/40")} />
            <Link href="/" className="inline-flex h-12 items-center justify-center rounded-full border border-white/15 px-6 text-[0.95rem] font-semibold text-white transition-colors hover:bg-white/5 focus-visible:ring-3 focus-visible:ring-white/25 focus-visible:outline-none">
              Explore the platform
            </Link>
          </div>
          <nav aria-label="Explore Sociotix" className="mt-8">
            <ul className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm">
              {EXPLORE.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="rounded-sm text-white/60 transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:outline-none">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </Reveal>
      </div>
    </section>
  );
}

export function AboutPage({ liveSocial }: { liveSocial: string[] }) {
  return (
    <>
      <Hero />
      <WhoWeAre />
      <WhatWeDo liveSocial={liveSocial} />
      <WhySociotix />
      <FaqAndCta liveSocial={liveSocial} />
    </>
  );
}
