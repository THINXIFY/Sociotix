"use client";

import Link from "next/link";
import { ArrowUpRight, Package, Share2, Sparkles, type LucideIcon } from "lucide-react";
import { usePreview } from "@/components/providers";
import { Eyebrow, Reveal } from "@/components/site/primitives";

/** Solutions with an overview page link to it; planned ones open a short preview instead. */
type Solution = { icon: LucideIcon; title: string; body: string; status: string; href?: string };

const SOLUTIONS: Solution[] = [
  {
    icon: Sparkles,
    title: "Sociotix AI Tools",
    body: "Captions, hashtags, post ideas and content calendars, shaped for each platform.",
    status: "Coming soon",
    href: "/ai-tools",
  },
  {
    icon: Share2,
    title: "Social Management",
    body: "Connected accounts, a publishing calendar, automations and campaigns in one workspace.",
    status: "Coming soon",
    href: "/social-management",
  },
  {
    icon: Package,
    title: "Digital Products Marketplace",
    body: "Templates, guides and assets for social media work.",
    status: "Planned",
  },
];

const card =
  "group flex h-full w-full flex-col rounded-2xl border bg-card/60 p-4 text-left transition-[background-color,border-color,box-shadow] hover:border-primary/25 hover:bg-card hover:shadow-sm focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none";

function CardBody({ s }: { s: Solution }) {
  return (
    <>
      <span className="flex items-center justify-between">
        <span className="grid size-8 place-items-center rounded-lg bg-primary/[0.07] text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground dark:bg-primary/15">
          <s.icon className="size-4" aria-hidden />
        </span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[0.68rem] font-semibold text-muted-foreground">{s.status}</span>
      </span>
      <span className="mt-4 text-sm font-semibold">{s.title}</span>
      <span className="mt-1 flex-1 text-xs leading-relaxed text-muted-foreground">{s.body}</span>
      <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors group-hover:text-primary">
        {s.href ? "See what's included" : "Preview"}
        <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
      </span>
    </>
  );
}

export function MoreSolutions() {
  const preview = usePreview();
  return (
    <section id="more-solutions" className="border-t py-16 sm:py-20">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="grid grid-cols-1 gap-8 lg:grid-cols-[0.8fr_2fr] lg:items-center">
          <div>
            <Eyebrow>More solutions</Eyebrow>
            <h2 className="mt-3 text-2xl font-bold">More from Sociotix</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              The services marketplace comes first. AI tools and social management are being built alongside it, and each opens once it genuinely works.
            </p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-3">
            {SOLUTIONS.map((s) => (
              <li key={s.title}>
                {s.href ? (
                  <Link href={s.href} className={card}>
                    <CardBody s={s} />
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      preview({
                        title: s.title,
                        description: `${s.body} This is a future Sociotix offering and isn't available yet.`,
                      })
                    }
                    className={card}
                  >
                    <CardBody s={s} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
