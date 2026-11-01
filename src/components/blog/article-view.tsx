import Link from "next/link";
import { ArrowRight, ChevronDown, ChevronRight, Lightbulb } from "lucide-react";
import { ReadingProgress, ShareBar } from "@/components/blog/article-tools";
import { ArticleCardView, ArticleMeta, Cover } from "@/components/blog/cover";
import { RichBody } from "@/components/blog/rich-body";
import { Mark } from "@/components/media-kit/interactive";
import { type BlogArticle, type BlogBlock, articleCategoryName, headingId, isPublished, parseInline, readingMinutes, relatedArticles, tableOfContents, toCard } from "@/lib/blog";
import { cn } from "@/lib/utils";

/* The article reading experience: hero, cover, sticky contents, styled body, share, related, CTA. */

const linkClass = "font-medium text-primary underline decoration-primary/30 underline-offset-[3px] transition-colors hover:decoration-primary dark:text-[#b9a6ff]";

function Inline({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((part, i) =>
        part.type === "text" ? (
          <span key={i}>{part.value}</span>
        ) : part.href.startsWith("/") ? (
          <Link key={i} href={part.href} className={linkClass}>
            {part.label}
          </Link>
        ) : (
          <a key={i} href={part.href} className={linkClass} rel="noopener noreferrer" target="_blank">
            {part.label}
          </a>
        ),
      )}
    </>
  );
}

function Block({ b }: { b: BlogBlock }) {
  switch (b.type) {
    case "p":
      return (
        <p className="mt-5 text-[1.08rem] leading-[1.8] text-foreground/85">
          <Inline text={b.text} />
        </p>
      );
    case "h2":
      return (
        <h2 id={headingId(b.text)} className="mt-12 font-heading text-[1.6rem] leading-snug font-extrabold tracking-[-0.025em] sm:text-[1.85rem]">
          {b.text}
        </h2>
      );
    case "h3":
      return <h3 className="mt-8 font-heading text-[1.2rem] font-bold tracking-[-0.015em]">{b.text}</h3>;
    case "ul":
    case "ol": {
      const L = b.type;
      return (
        <L className={cn("mt-5 space-y-2.5 text-[1.05rem] leading-[1.75] text-foreground/85", b.type === "ul" ? "[&>li]:relative [&>li]:ps-6 [&>li]:before:absolute [&>li]:before:top-[0.72em] [&>li]:before:left-1 [&>li]:before:size-1.5 [&>li]:before:rounded-full [&>li]:before:bg-primary" : "list-none [counter-reset:step] [&>li]:relative [&>li]:ps-10 [&>li]:[counter-increment:step] [&>li]:before:absolute [&>li]:before:top-0.5 [&>li]:before:left-0 [&>li]:before:grid [&>li]:before:size-7 [&>li]:before:place-items-center [&>li]:before:rounded-lg [&>li]:before:bg-primary/[0.09] [&>li]:before:font-mono [&>li]:before:text-[0.78rem] [&>li]:before:font-semibold [&>li]:before:text-primary [&>li]:before:content-[counter(step)] dark:[&>li]:before:bg-primary/20 dark:[&>li]:before:text-[#b9a6ff]")}>
          {b.items.map((it, i) => (
            <li key={i}>
              <Inline text={it} />
            </li>
          ))}
        </L>
      );
    }
    case "quote":
      return (
        <blockquote className="my-10 border-s-4 border-lime ps-6">
          <p className="font-heading text-[1.45rem] leading-snug font-bold tracking-[-0.015em] text-balance sm:text-[1.65rem]">{b.text}</p>
        </blockquote>
      );
    case "tip":
      return (
        <aside className="mt-8 rounded-2xl border border-primary/20 bg-primary/[0.05] p-5 dark:bg-primary/10">
          <p className="flex items-center gap-2 font-semibold text-primary dark:text-[#b9a6ff]">
            <Lightbulb className="size-4" aria-hidden /> {b.title}
          </p>
          <p className="mt-1.5 text-[1rem] leading-relaxed text-foreground/85">
            <Inline text={b.text} />
          </p>
        </aside>
      );
  }
}

function Contents({ items }: { items: { id: string; text: string }[] }) {
  return (
    <ol className="space-y-0.5 border-s">
      {items.map((t) => (
        <li key={t.id}>
          <a href={`#${t.id}`} className="-ms-px block border-s border-transparent py-1.5 ps-4 text-[0.88rem] leading-snug text-foreground/65 transition-colors duration-150 hover:border-primary hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none">
            {t.text}
          </a>
        </li>
      ))}
    </ol>
  );
}

/** `pool`: the articles to pick "Keep reading" from (defaults to the file articles); `preview` replaces the draft notice. */
export function ArticleView({ a, url, pool, preview }: { a: BlogArticle; url: string; pool?: BlogArticle[]; preview?: React.ReactNode }) {
  const toc = tableOfContents(a);
  const related = pool ? relatedArticles(a, pool) : relatedArticles(a);
  const draft = !isPublished(a);
  return (
    <>
      <ReadingProgress targetId="article-body" />
      <header className="relative isolate overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_70%_at_80%_0%,rgb(112_71_235/0.1),transparent_70%)] dark:bg-[radial-gradient(60%_70%_at_80%_0%,rgb(112_71_235/0.22),transparent_70%)]" aria-hidden />
        <div className="mx-auto w-full max-w-4xl px-4 pt-10 sm:px-6 sm:pt-14">
          <nav aria-label="Breadcrumb">
            <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
              <li>
                <Link href="/" className="hover:text-foreground">
                  Home
                </Link>
              </li>
              <ChevronRight className="size-3.5" aria-hidden />
              <li>
                <Link href="/blog" className="hover:text-foreground">
                  Blog
                </Link>
              </li>
              <ChevronRight className="size-3.5" aria-hidden />
              <li aria-current="page" className="text-foreground/80">
                {articleCategoryName(a)}
              </li>
            </ol>
          </nav>
          {preview ?? (draft ? (
            <p role="note" className="mt-6 rounded-xl border border-amber-500/35 bg-amber-500/[0.07] px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
              <span className="font-semibold">Draft preview.</span> This article isn&apos;t published, indexed or served in production until it&apos;s approved and dated.
            </p>
          ) : null)}
          <p className="mt-8 text-[0.74rem] font-semibold tracking-[0.16em] text-primary uppercase dark:text-[#b9a6ff]">{articleCategoryName(a)}</p>
          <h1 className="mt-3 font-heading text-[2.4rem] leading-[1.02] font-extrabold tracking-[-0.045em] text-balance sm:text-[3.4rem] lg:text-[3.9rem]">{a.title}</h1>
          <p className="mt-5 text-[1.15rem] leading-relaxed text-muted-foreground sm:text-[1.25rem]">{a.description}</p>
          <div className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-3 border-t pt-6">
            <span className="inline-flex items-center gap-2.5">
              <Mark className="size-9" />
              <span className="leading-tight">
                <span className="block text-sm font-semibold">{a.author.name}</span>
                {a.author.role ? <span className="block text-xs text-muted-foreground">{a.author.role}</span> : null}
              </span>
            </span>
            <ArticleMeta date={a.publishedAt ?? null} minutes={readingMinutes(a)} draft={draft} className="ms-auto" />
          </div>
        </div>
        <div className="mx-auto mt-10 w-full max-w-6xl px-4 sm:px-6">
          <div className="aspect-[16/8] overflow-hidden rounded-[2rem] ring-1 ring-black/5 dark:ring-white/10">
            {a.image ? (
              // eslint-disable-next-line @next/next/no-img-element -- uploaded images are served from this origin with their real dimensions
              <img src={a.image.src} alt={a.image.alt} width={a.image.width} height={a.image.height} fetchPriority="high" className="size-full object-cover" />
            ) : (
              <Cover cover={a.cover} alt={a.coverAlt} />
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-16">
        <article id="article-body" className="min-w-0 max-w-[42rem] lg:mx-auto lg:w-full">
          {toc.length > 2 ? (
            <details className="group mb-8 rounded-xl border bg-card lg:hidden dark:bg-white/[0.03]">
              <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl px-4 py-3.5 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
                In this article
                <ChevronDown className="size-4 text-muted-foreground transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
              </summary>
              <nav aria-label="In this article (compact)" className="border-t px-3 py-3">
                <Contents items={toc} />
              </nav>
            </details>
          ) : null}
          {a.rich ? (
            <RichBody blocks={a.rich} />
          ) : (
            a.body.map((b, i) => <Block key={i} b={b} />)
          )}
          <div className={cn("mt-12 flex flex-wrap gap-2 border-t pt-8", !a.tags.length && "hidden")}>
            {a.tags.map((t) => (
              <span key={t} className="rounded-full bg-muted px-3 py-1 text-[0.8rem] text-muted-foreground dark:bg-white/[0.06]">
                #{t}
              </span>
            ))}
          </div>
          <div className="mt-6">
            <p className="mb-3 text-[0.72rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">Share this article</p>
            <ShareBar url={url} title={a.title} />
          </div>
        </article>
        {toc.length > 2 ? (
          <aside className="hidden lg:block">
            <nav aria-label="In this article" className="sticky top-28">
              <p className="mb-3 text-[0.72rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">In this article</p>
              <Contents items={toc} />
            </nav>
          </aside>
        ) : null}
      </div>

      <section className="mx-auto w-full max-w-6xl px-4 sm:px-6" aria-labelledby="cta-title">
        <div className="relative isolate overflow-hidden rounded-[2rem] bg-[#15161b] px-6 py-12 text-white sm:px-12">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_80%_at_10%_0%,rgb(112_71_235/0.5),transparent_70%)]" aria-hidden />
          <h2 id="cta-title" className="max-w-2xl font-heading text-[1.9rem] leading-tight font-extrabold tracking-[-0.03em] sm:text-[2.4rem]">
            Put it into practice with <span className="text-lime">Sociotix.</span>
          </h2>
          <p className="mt-3 max-w-xl text-white/65">Compare social media services with clear details, plan content in one workspace, and follow every order step by step.</p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link href="/#services" className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-lime px-6 font-semibold text-graphite transition-colors hover:bg-lime/90 focus-visible:ring-3 focus-visible:ring-lime/40 focus-visible:outline-none">
              Browse services <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link href="/blog" className="inline-flex h-12 items-center justify-center rounded-full border border-white/15 px-6 font-semibold text-white transition-colors hover:bg-white/5 focus-visible:ring-3 focus-visible:ring-white/25 focus-visible:outline-none">
              More articles
            </Link>
          </div>
        </div>
      </section>

      {related.length ? (
        <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20" aria-labelledby="related-title">
          <h2 id="related-title" className="font-heading text-[1.8rem] font-extrabold tracking-[-0.03em]">
            Keep reading
          </h2>
          <ul className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {related.map((r) => (
              <li key={r.slug}>
                <ArticleCardView card={toCard(r)} />
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-muted-foreground">
            Looking for something specific?{" "}
            <Link href="/blog" className={linkClass}>
              See all articles
            </Link>{" "}
            or visit the{" "}
            <Link href="/help" className={linkClass}>
              Help Center
            </Link>
            .
          </p>
        </section>
      ) : null}
    </>
  );
}
