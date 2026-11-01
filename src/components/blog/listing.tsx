"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, Clock3, LayoutGrid, Lightbulb, Search, Share2, Sparkles, Tag, TrendingUp, Workflow, X, type LucideIcon } from "lucide-react";
import { type ArticleCard, BLOG_CATEGORIES, type CategoryId, filterCards, formatDate } from "@/lib/blog";
import { cn } from "@/lib/utils";

/*
 * The blog listing: compact hero with search, category cards, featured and latest article grids.
 * One client component so search and categories drive the same results; it's server-rendered too.
 */

const wrap = "mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8";
const PAGE_SIZE = 9;

const ICONS: Record<string, LucideIcon> = {
  all: LayoutGrid,
  "social-media": Share2,
  "ai-marketing": Sparkles,
  growth: TrendingUp,
  automation: Workflow,
  guides: BookOpen,
  tips: Lightbulb,
};

/** Tasteful branded placeholder (no approved photography yet): the category icon on a soft brand field. */
function Placeholder({ category, alt }: { category: CategoryId; alt: string }) {
  const Icon = ICONS[category];
  return (
    <div role="img" aria-label={alt} className="relative grid size-full place-items-center overflow-hidden bg-[linear-gradient(135deg,#f1edff_0%,#e6dfff_55%,#f6fbe6_100%)] dark:bg-[linear-gradient(135deg,#221d3a_0%,#1a1730_60%,#1b2016_100%)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_15%,rgb(112_71_235/0.18),transparent_55%)]" aria-hidden />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgb(112_71_235/0.07)_1px,transparent_1px),linear-gradient(to_bottom,rgb(112_71_235/0.07)_1px,transparent_1px)] bg-size-[28px_28px]" aria-hidden />
      <span className="relative grid size-16 place-items-center rounded-2xl bg-white/80 text-primary shadow-[0_16px_36px_-18px_rgb(112_71_235/0.6)] ring-1 ring-primary/10 backdrop-blur transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none dark:bg-white/10 dark:text-[#b9a6ff] dark:ring-white/10">
        {/* Custom categories (added in Blog Management) use a generic tag icon. */}
        {Icon ? <Icon className="size-7" aria-hidden /> : <Tag className="size-7" aria-hidden />}
      </span>
    </div>
  );
}

/** One article card: equal height, 2-line description, verified meta, read action. */
export function BlogCard({ card, headingLevel = "h3" }: { card: ArticleCard; headingLevel?: "h2" | "h3" }) {
  const H = headingLevel;
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border bg-card transition-[transform,border-color,box-shadow] duration-200 has-[a:focus-visible]:ring-3 has-[a:focus-visible]:ring-primary/40 hover:-translate-y-1 hover:border-primary/25 hover:shadow-[0_24px_50px_-30px_rgb(112_71_235/0.45)] motion-reduce:transition-none motion-reduce:hover:translate-y-0 dark:bg-white/[0.03]">
      <div className="relative aspect-[16/9] overflow-hidden">
        {card.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- uploaded images are served from this origin with their real dimensions
          <img src={card.image.src} alt={card.image.alt} width={card.image.width} height={card.image.height} loading="lazy" decoding="async" className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03] motion-reduce:transition-none" />
        ) : (
          <Placeholder category={card.category} alt={card.coverAlt} />
        )}
        <span className="absolute top-3 left-3 rounded-full bg-white/90 px-2.5 py-1 text-[0.7rem] font-semibold text-primary shadow-sm backdrop-blur dark:bg-[#17181d]/90 dark:text-[#b9a6ff]">{card.categoryName}</span>
        {card.draft ? <span className="absolute top-3 right-3 rounded-full bg-amber-100 px-2.5 py-1 text-[0.7rem] font-semibold text-amber-800 dark:bg-amber-500/20 dark:text-amber-200">Draft</span> : null}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <H className="line-clamp-2 font-heading text-[1.12rem] leading-snug font-bold tracking-[-0.015em]">
          <Link href={`/blog/${card.slug}`} className="outline-none after:absolute after:inset-0 after:content-['']">
            {card.title}
          </Link>
        </H>
        <p className="mt-2 line-clamp-2 text-[0.92rem] leading-relaxed text-muted-foreground">{card.description}</p>
        <div className="mt-auto pt-5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.78rem] text-muted-foreground">
            <span className="font-medium text-foreground/80">{card.author}</span>
            <span aria-hidden>·</span>
            {card.date && !card.draft ? <time dateTime={card.date}>{formatDate(card.date)}</time> : <span>Not yet published</span>}
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1">
              <Clock3 className="size-3.5" aria-hidden /> {card.minutes} min read
            </span>
          </div>
          <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary dark:text-[#b9a6ff]" aria-hidden>
            Read article <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transition-none" />
          </span>
        </div>
      </div>
    </article>
  );
}

function Grid({ cards, label }: { cards: ArticleCard[]; label: string }) {
  return (
    <ul aria-label={label} className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((c) => (
        <li key={c.slug}>
          <BlogCard card={c} />
        </li>
      ))}
    </ul>
  );
}

export function BlogListing({ cards, preview }: { cards: ArticleCard[]; preview: boolean }) {
  const [category, setCategory] = React.useState<CategoryId | "all">("all");
  const [query, setQuery] = React.useState("");
  const [shown, setShown] = React.useState(PAGE_SIZE);
  const filtering = category !== "all" || query.trim() !== "";
  const featured = filtering ? [] : cards.filter((c) => c.featured).slice(0, 3);
  // Featured articles aren't repeated in Latest unless you're searching or filtering.
  const results = filterCards(cards, category, query).filter((c) => filtering || !featured.some((f) => f.slug === c.slug));
  const visible = results.slice(0, shown);
  // The six built-in categories always show; a custom category appears once it has an article.
  const custom = [...new Map(cards.filter((c) => !BLOG_CATEGORIES.some((b) => b.id === c.category)).map((c) => [c.category, { id: c.category, name: c.categoryName }])).values()].sort((a, b) => a.name.localeCompare(b.name));
  const categories = [{ id: "all", name: "All Articles" }, ...BLOG_CATEGORIES, ...custom];
  const counts = Object.fromEntries(categories.map((c) => [c.id, c.id === "all" ? cards.length : cards.filter((x) => x.category === c.id).length]));
  const choose = (id: CategoryId | "all") => {
    setCategory(id);
    setShown(PAGE_SIZE);
  };

  return (
    <>
      {/* Compact hero with search. */}
      <section className="relative isolate overflow-hidden border-b" aria-labelledby="blog-title">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(70%_90%_at_50%_0%,rgb(112_71_235/0.14),transparent_70%)] dark:bg-[radial-gradient(70%_90%_at_50%_0%,rgb(112_71_235/0.3),transparent_70%)]" aria-hidden />
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgb(112_71_235/0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgb(112_71_235/0.06)_1px,transparent_1px)] mask-[radial-gradient(60%_80%_at_50%_0%,black,transparent)] bg-size-[40px_40px]" aria-hidden />
        <div className={cn(wrap, "py-14 text-center sm:py-20")}>
          <p className="inline-flex items-center gap-2 rounded-full border bg-card/70 px-3 py-1 text-[0.72rem] font-semibold tracking-[0.14em] text-primary uppercase backdrop-blur dark:text-[#b9a6ff]">
            Sociotix Blog
            {preview ? <span className="rounded-full bg-amber-100 px-2 py-0.5 tracking-normal text-amber-800 normal-case dark:bg-amber-500/20 dark:text-amber-200">Draft preview</span> : null}
          </p>
          <h1 id="blog-title" className="mx-auto mt-5 max-w-3xl font-heading text-[2.4rem] leading-[1.05] font-extrabold tracking-[-0.045em] text-balance sm:text-[3.4rem] lg:text-[3.8rem]">
            Insights That <span className="text-[#7047EB] dark:text-[#9277F4]">Inspire Growth.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-[1.05rem] leading-relaxed text-muted-foreground">Practical guides on social media, AI marketing, growth and automation, written to be useful the moment you finish reading.</p>
          <div className="relative mx-auto mt-8 max-w-xl">
            <Search className="pointer-events-none absolute top-1/2 left-5 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <label htmlFor="blog-search" className="sr-only">
              Search articles
            </label>
            <input
              id="blog-search"
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShown(PAGE_SIZE);
              }}
              placeholder="Search articles"
              className="h-14 w-full rounded-full border bg-card ps-13 pe-12 text-[0.98rem] shadow-[0_18px_40px_-28px_rgb(112_71_235/0.55)] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-muted-foreground focus:border-primary/45 focus:ring-4 focus:ring-primary/15 dark:bg-[#17181d] [&::-webkit-search-cancel-button]:hidden"
            />
            {query ? (
              <button type="button" onClick={() => setQuery("")} className="absolute top-1/2 right-3 grid size-8 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none">
                <X className="size-4" aria-hidden />
                <span className="sr-only">Clear search</span>
              </button>
            ) : null}
          </div>
        </div>
      </section>

      {/* Category tabs: one compact row (scrolls sideways on small screens). */}
      <section className={cn(wrap, "pt-8 sm:pt-10")} aria-labelledby="categories-title">
        <h2 id="categories-title" className="sr-only">
          Browse by category
        </h2>
        <div role="group" aria-label="Filter articles by category" className="relative -mx-4 flex snap-x gap-2 overflow-x-auto scroll-smooth px-4 py-1 [scrollbar-width:none] sm:mx-0 sm:px-0 motion-reduce:scroll-auto [&::-webkit-scrollbar]:hidden">
          {categories.map((c) => {
            const active = category === c.id;
            const n = counts[c.id];
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={active}
                onClick={() => choose(c.id)}
                className={cn(
                  "inline-flex h-10 shrink-0 snap-start items-center gap-2 rounded-full border ps-4 pe-1.5 text-[0.875rem] font-semibold whitespace-nowrap transition-[background-color,border-color,color,box-shadow] duration-150 outline-none focus-visible:ring-3 focus-visible:ring-primary/40 motion-reduce:transition-none",
                  active
                    ? "border-[#7047EB] bg-[#7047EB] text-white shadow-[0_10px_24px_-14px_rgb(112_71_235/0.9)]"
                    : "border-border/70 bg-muted/50 text-foreground/75 hover:border-primary/25 hover:bg-primary/[0.06] hover:text-foreground dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.08]",
                )}
              >
                {c.name}
                <span className={cn("grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-[0.7rem] font-semibold tabular-nums", active ? "bg-white/20 text-white" : "bg-background text-muted-foreground dark:bg-white/10")}>
                  {n}
                  <span className="sr-only"> {n === 1 ? "article" : "articles"}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {featured.length ? (
        <section className={cn(wrap, "pt-14")} aria-labelledby="featured-title">
          <h2 id="featured-title" className="font-heading text-[1.6rem] font-extrabold tracking-[-0.025em]">
            Featured articles
          </h2>
          <div className="mt-6">
            <Grid cards={featured} label="Featured articles" />
          </div>
        </section>
      ) : null}

      <section id="articles" className={cn(wrap, "pt-14 pb-16 sm:pb-20")} aria-labelledby="latest-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="latest-title" className="font-heading text-[1.6rem] font-extrabold tracking-[-0.025em]">
            {filtering ? (query.trim() ? `Results for “${query.trim()}”` : (categories.find((c) => c.id === category)?.name ?? "Articles")) : "Latest articles"}
          </h2>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {results.length} {results.length === 1 ? "article" : "articles"}
          </p>
        </div>
        <div className="mt-6">
          {visible.length ? (
            <Grid cards={visible} label="Latest articles" />
          ) : (
            <div className="rounded-2xl border border-dashed p-10 text-center">
              <p className="font-heading text-lg font-bold">{filtering ? "No articles match that yet" : "More articles coming soon"}</p>
              <p className="mt-1 text-sm text-muted-foreground">{filtering ? "Try another word or category." : "The featured articles above are all we've published so far."}</p>
              {filtering ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    choose("all");
                  }}
                  className="mt-4 inline-flex h-9 items-center rounded-full border px-4 text-sm font-medium hover:border-primary/35 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
                >
                  Show all articles
                </button>
              ) : null}
            </div>
          )}
        </div>
        {results.length > shown ? (
          <div className="mt-8 text-center">
            <button type="button" onClick={() => setShown((s) => s + PAGE_SIZE)} className="inline-flex h-11 items-center rounded-full border bg-card px-6 text-sm font-semibold transition-colors hover:border-primary/35 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none dark:bg-white/[0.03]">
              Load more articles
            </button>
          </div>
        ) : null}
      </section>
    </>
  );
}
