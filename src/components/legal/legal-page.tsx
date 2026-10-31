import { ArrowUpRight, ChevronDown, FileText, Hash, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * Shared building blocks for Sociotix legal pages (Privacy Policy, Terms of Service).
 * Server components only: a hero, an optional "at a glance" summary, a sticky contents list on
 * desktop (an expandable index below 1024px), numbered sections with "In short" answers.
 */

const wrap = "mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8";
export const legalLink =
  "font-medium text-primary underline decoration-primary/30 underline-offset-[3px] transition-colors hover:decoration-primary focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none dark:text-[#b9a6ff]";

/** A detail only the owner can confirm. Clearly marked, never invented. */
export function Pending({ children }: { children: React.ReactNode }) {
  return (
    <mark className="rounded-md bg-amber-500/10 px-1.5 py-0.5 font-medium text-amber-800 ring-1 ring-amber-500/30 ring-inset dark:text-amber-300">
      <span className="text-[0.72em] font-bold tracking-wide uppercase">Requires owner approval</span> · {children}
    </mark>
  );
}
export const val = (v: string | number | null, label: string) => (v != null && v !== "" ? <>{v}</> : <Pending>{label}</Pending>);

export function External({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className={legalLink} rel="noopener noreferrer" target="_blank">
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

export function Status({ live, children }: { live: boolean; children: React.ReactNode }) {
  return (
    <span className={cn("me-1.5 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 align-middle text-[0.72rem] font-semibold", live ? "bg-lime/25 text-foreground dark:bg-lime/15" : "bg-muted text-muted-foreground")}>
      <span className={cn("size-1.5 rounded-full", live ? "bg-[#5d8a00] dark:bg-lime" : "border border-dashed border-muted-foreground")} aria-hidden />
      {children}
    </span>
  );
}

export const P = ({ children }: { children: React.ReactNode }) => <p className="mt-4 text-[1.02rem] leading-[1.75] text-foreground/80">{children}</p>;
export const UL = ({ children }: { children: React.ReactNode }) => (
  <ul className="mt-4 space-y-2.5 text-[1.02rem] leading-[1.7] text-foreground/80 [&>li]:relative [&>li]:ps-5 [&>li]:before:absolute [&>li]:before:top-[0.7em] [&>li]:before:left-0 [&>li]:before:size-1.5 [&>li]:before:rounded-full [&>li]:before:bg-primary/60">
    {children}
  </ul>
);
export const H3 = ({ id, children }: { id?: string; children: React.ReactNode }) => (
  <h3 id={id} className="mt-9 font-heading text-[1.1rem] font-bold tracking-[-0.01em]">
    {children}
  </h3>
);
export const B = ({ children }: { children: React.ReactNode }) => <strong className="font-semibold text-foreground">{children}</strong>;

export type LegalSection = { id: string; title: string; short: string; body: React.ReactNode };
export type GlanceItem = { icon: LucideIcon; text: string; href: string };

function Contents({ items }: { items: LegalSection[] }) {
  return (
    <ol className="space-y-0.5">
      {items.map((s, i) => (
        <li key={s.id}>
          <a
            href={`#${s.id}`}
            className="group flex gap-3 rounded-lg px-3 py-1.5 text-[0.86rem] leading-snug text-foreground/65 transition-colors duration-150 hover:bg-foreground/[0.045] hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none dark:hover:bg-white/[0.05]"
          >
            <span className="w-5 shrink-0 font-mono text-[0.72rem] text-muted-foreground tabular-nums transition-colors group-hover:text-primary">{String(i + 1).padStart(2, "0")}</span>
            {s.title}
          </a>
        </li>
      ))}
    </ol>
  );
}

function Glance({ title, items }: { title: string; items: GlanceItem[] }) {
  return (
    <section aria-labelledby="glance-title" className="mb-14 rounded-2xl border bg-card p-5 sm:p-7 dark:bg-white/[0.03]">
      <h2 id="glance-title" className="font-heading text-[1.2rem] font-extrabold tracking-[-0.02em]">
        {title}
      </h2>
      <ul className="mt-4 grid gap-1 sm:grid-cols-2 sm:gap-x-4">
        {items.map((g) => (
          <li key={g.href}>
            <a href={g.href} className="group flex items-start gap-3 rounded-xl p-2.5 text-[0.95rem] leading-snug text-foreground/85 transition-colors duration-150 hover:bg-foreground/[0.04] focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none dark:hover:bg-white/[0.05]">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/[0.08] text-primary dark:bg-primary/20 dark:text-[#b9a6ff]">
                <g.icon className="size-4" aria-hidden />
              </span>
              <span className="pt-1">
                {g.text}
                <span className="sr-only"> Read more.</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The full legal page: hero, review banner (while unpublished), glance summary, contents and sections. */
export function LegalDocument({
  label,
  icon: Icon,
  title,
  accent,
  intro,
  lastUpdated,
  published,
  reviewNote,
  contentsLabel,
  glance,
  sections,
}: {
  label: string;
  icon: LucideIcon;
  title: string;
  accent: string;
  intro: string;
  lastUpdated: string | null;
  published: boolean;
  reviewNote: string;
  contentsLabel: string;
  glance: { title: string; items: GlanceItem[] };
  sections: LegalSection[];
}) {
  const updated = lastUpdated ? new Date(`${lastUpdated}T00:00:00Z`) : null;
  return (
    <>
      <section id="top" className="relative isolate overflow-hidden border-b" aria-labelledby="legal-title">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_80%_at_85%_0%,rgb(112_71_235/0.09),transparent_70%)] dark:bg-[radial-gradient(60%_80%_at_85%_0%,rgb(112_71_235/0.2),transparent_70%)]" aria-hidden />
        <div className={cn(wrap, "pt-12 pb-12 sm:pt-16 sm:pb-14")}>
          <p className="inline-flex items-center gap-2 rounded-full border bg-card/70 py-1.5 ps-2 pe-3 text-[0.7rem] font-semibold tracking-[0.14em] text-foreground/75 uppercase">
            <Icon className="size-4 text-primary dark:text-[#b9a6ff]" aria-hidden />
            {label}
          </p>
          <h1 id="legal-title" className="mt-6 font-heading text-[2.6rem] leading-[1.02] font-extrabold tracking-[-0.045em] sm:text-[3.6rem]">
            {title} <span className="text-primary dark:text-[#a993ff]">{accent}</span>
          </h1>
          <p className="mt-5 max-w-2xl text-[1.08rem] leading-relaxed text-muted-foreground">{intro}</p>
          <dl className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-sm">
            <div>
              <dt className="text-[0.72rem] font-semibold tracking-[0.1em] text-muted-foreground uppercase">Last updated</dt>
              <dd className="mt-1 font-medium">
                {updated ? <time dateTime={lastUpdated!}>{updated.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}</time> : <span className="text-amber-700 dark:text-amber-300">In review, not yet published</span>}
              </dd>
            </div>
            <div>
              <dt className="text-[0.72rem] font-semibold tracking-[0.1em] text-muted-foreground uppercase">Applies to</dt>
              <dd className="mt-1 font-medium">Sociotix website and dashboard</dd>
            </div>
            <div>
              <dt className="text-[0.72rem] font-semibold tracking-[0.1em] text-muted-foreground uppercase">Questions</dt>
              <dd className="mt-1">
                <a href="#contact" className={legalLink}>
                  Contact us
                </a>
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <div className={cn(wrap, "grid grid-cols-1 gap-10 py-12 sm:py-16 lg:grid-cols-[15.5rem_minmax(0,1fr)] lg:gap-16")}>
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <nav aria-label={`${contentsLabel} contents`} className="hidden lg:block">
            <p className="px-3 pb-3 text-[0.72rem] font-semibold tracking-[0.12em] text-muted-foreground uppercase">On this page</p>
            <Contents items={sections} />
          </nav>
          <details className="group rounded-xl border bg-card lg:hidden dark:bg-white/[0.03]">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3.5 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
              <span className="inline-flex items-center gap-2">
                <FileText className="size-4 text-primary dark:text-[#b9a6ff]" aria-hidden /> On this page
                <span className="font-normal text-muted-foreground">· {sections.length} sections</span>
              </span>
              <ChevronDown className="size-4 text-muted-foreground transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
            </summary>
            <nav aria-label={`${contentsLabel} contents (compact)`} className="border-t px-1 py-2">
              <Contents items={sections} />
            </nav>
          </details>
        </aside>

        <article className="min-w-0 max-w-[46rem]">
          {!published ? (
            <div role="note" className="mb-10 rounded-2xl border border-amber-500/35 bg-amber-500/[0.07] p-5 text-[0.95rem] leading-relaxed text-amber-900 dark:text-amber-200">
              <p className="font-semibold">Draft awaiting owner and legal review.</p>
              <p className="mt-1">{reviewNote}</p>
            </div>
          ) : null}

          <Glance title={glance.title} items={glance.items} />

          {sections.map((s, i) => (
            <section key={s.id} id={s.id} aria-labelledby={`${s.id}-title`} className={cn(i > 0 && "mt-14 border-t pt-12")}>
              <h2 id={`${s.id}-title`} className="group flex items-baseline gap-3 font-heading text-[1.5rem] leading-snug font-extrabold tracking-[-0.025em] sm:text-[1.7rem]">
                <span className="font-mono text-[0.8rem] font-semibold text-primary tabular-nums dark:text-[#b9a6ff]" aria-hidden>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>
                  {s.title}
                  <a href={`#${s.id}`} className="ms-2 inline-flex rounded-sm align-middle text-muted-foreground opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none">
                    <Hash className="size-4" aria-hidden />
                    <span className="sr-only">Link to {s.title}</span>
                  </a>
                </span>
              </h2>
              <p className="mt-4 rounded-xl border-s-2 border-primary/50 bg-primary/[0.04] py-3 ps-4 pe-3 text-[0.98rem] leading-relaxed text-foreground dark:bg-primary/10">
                <span className="font-semibold">In short: </span>
                {s.short}
              </p>
              {s.body}
            </section>
          ))}

          <p className="mt-14 border-t pt-8 text-sm text-muted-foreground">
            <a href="#top" className={cn(legalLink, "inline-flex items-center gap-1")}>
              Back to top <ArrowUpRight className="size-3.5 -rotate-45" aria-hidden />
            </a>
          </p>
        </article>
      </div>
    </>
  );
}

/** The closing contact card shared by legal pages. */
export function LegalContactCard({ icon: Icon, title, children, footnote }: { icon: LucideIcon; title: string; children: React.ReactNode; footnote?: React.ReactNode }) {
  return (
    <div id="contact" className="mt-8 rounded-2xl border bg-card p-6 shadow-[0_18px_40px_-34px_rgb(112_71_235/0.5)] sm:p-7 dark:bg-white/[0.03]">
      <div className="flex items-start gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/[0.08] text-primary dark:bg-primary/20 dark:text-[#b9a6ff]">
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="font-heading text-[1.1rem] font-bold">{title}</p>
          <dl className="mt-3 space-y-2 text-[0.98rem] leading-relaxed text-foreground/80">{children}</dl>
          {footnote ? <p className="mt-4 text-[0.9rem] leading-relaxed text-muted-foreground">{footnote}</p> : null}
        </div>
      </div>
    </div>
  );
}
