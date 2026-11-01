import Link from "next/link";
import { headingId } from "@/lib/blog";
import { runsText } from "@/lib/blog/rich";
import type { InlineRun, RichBlock } from "@/lib/blog/types";
import { cn } from "@/lib/utils";

/* Renders admin-written rich text as React elements (no innerHTML), matching the file articles' typography. */

const linkClass = "font-medium text-primary underline decoration-primary/30 underline-offset-[3px] transition-colors hover:decoration-primary dark:text-[#b9a6ff]";

function Run({ r }: { r: InlineRun }) {
  let node: React.ReactNode = r.text;
  if (r.u) node = <u className="underline-offset-[3px]">{node}</u>;
  if (r.i) node = <em>{node}</em>;
  if (r.b) node = <strong className="font-semibold text-foreground">{node}</strong>;
  if (!r.href) return <>{node}</>;
  return r.href.startsWith("/") || r.href.startsWith("#") ? (
    <Link href={r.href} className={linkClass}>
      {node}
    </Link>
  ) : (
    <a href={r.href} className={linkClass} rel="noopener noreferrer nofollow" target="_blank">
      {node}
    </a>
  );
}

const Runs = ({ runs }: { runs: InlineRun[] }) => (
  <>
    {runs.map((r, i) => (
      <Run key={i} r={r} />
    ))}
  </>
);

const listClass = {
  ul: "[&>li]:relative [&>li]:ps-6 [&>li]:before:absolute [&>li]:before:top-[0.72em] [&>li]:before:left-1 [&>li]:before:size-1.5 [&>li]:before:rounded-full [&>li]:before:bg-primary",
  ol: "list-none [counter-reset:step] [&>li]:relative [&>li]:ps-10 [&>li]:[counter-increment:step] [&>li]:before:absolute [&>li]:before:top-0.5 [&>li]:before:left-0 [&>li]:before:grid [&>li]:before:size-7 [&>li]:before:place-items-center [&>li]:before:rounded-lg [&>li]:before:bg-primary/[0.09] [&>li]:before:font-mono [&>li]:before:text-[0.78rem] [&>li]:before:font-semibold [&>li]:before:text-primary [&>li]:before:content-[counter(step)] dark:[&>li]:before:bg-primary/20 dark:[&>li]:before:text-[#b9a6ff]",
};

function Block({ b }: { b: RichBlock }) {
  switch (b.type) {
    case "p":
      return (
        <p className="mt-5 text-[1.08rem] leading-[1.8] whitespace-pre-line text-foreground/85">
          <Runs runs={b.runs} />
        </p>
      );
    case "h2":
      return (
        <h2 id={headingId(runsText(b.runs))} className="mt-12 font-heading text-[1.6rem] leading-snug font-extrabold tracking-[-0.025em] sm:text-[1.85rem]">
          <Runs runs={b.runs} />
        </h2>
      );
    case "h3":
      return (
        <h3 className="mt-8 font-heading text-[1.2rem] font-bold tracking-[-0.015em]">
          <Runs runs={b.runs} />
        </h3>
      );
    case "h4":
      return (
        <h4 className="mt-6 font-heading text-[1.05rem] font-bold">
          <Runs runs={b.runs} />
        </h4>
      );
    case "quote":
      return (
        <blockquote className="my-10 border-s-4 border-lime ps-6">
          <p className="font-heading text-[1.45rem] leading-snug font-bold tracking-[-0.015em] text-balance whitespace-pre-line sm:text-[1.65rem]">
            <Runs runs={b.runs} />
          </p>
        </blockquote>
      );
    case "ul":
    case "ol": {
      const L = b.type;
      return (
        <L className={cn("mt-5 space-y-2.5 text-[1.05rem] leading-[1.75] text-foreground/85", listClass[L])}>
          {b.items.map((it, i) => (
            <li key={i}>
              <Runs runs={it} />
            </li>
          ))}
        </L>
      );
    }
    case "img":
      return (
        <figure className="my-10">
          {/* eslint-disable-next-line @next/next/no-img-element -- uploaded images are served from this origin with their real dimensions */}
          <img src={b.src} alt={b.alt} width={b.width} height={b.height} loading="lazy" decoding="async" className="h-auto w-full rounded-2xl ring-1 ring-black/5 dark:ring-white/10" />
          {b.caption ? <figcaption className="mt-3 text-center text-sm text-muted-foreground">{b.caption}</figcaption> : null}
        </figure>
      );
  }
}

export function RichBody({ blocks }: { blocks: RichBlock[] }) {
  return (
    <>
      {blocks.map((b, i) => (
        <Block key={i} b={b} />
      ))}
    </>
  );
}
