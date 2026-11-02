"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Info, RotateCcw, Search, Sparkles, X } from "lucide-react";
import { Select } from "@/components/ui/select";
import { availableSorts, capabilities, COLLECTIONS, type Collection, DIGITAL_CATEGORIES, type DigitalProduct, productCategoryName, filterProducts, type Filters, PRODUCT_TYPES, type PriceFilter, type ProductType, type SortId, sortProducts } from "@/lib/digital-products";
import { cn } from "@/lib/utils";
import { ProductCover, TONE_CLASS } from "./cover";
import { HeroImage } from "./hero-image";
import { ProductGrid } from "./product-card";

/*
 * The Digital Products Marketplace homepage: hero with search and a product showcase → category tabs → featured →
 * curated collections → all products (one toolbar) → CTA. One client component so search, tabs, filters and
 * sorting share state; it is server-rendered too, so the products are in the HTML without JavaScript.
 * Purchasing is inactive: each card links to the product's page, which states its availability.
 */

const wrap = "mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8";
const PAGE_SIZE = 12;
const CONTACT = "hello@sociotix.com";

/** A curated collection: a banner that filters to its categories, with two covers fanned beside the text. */
function CollectionBanner({ collection, count, firstCovers, onPick }: { collection: Collection; count: number; firstCovers: DigitalProduct[]; onPick: (c: Collection) => void }) {
  return (
    <button
      type="button"
      onClick={() => onPick(collection)}
      className={cn(
        "group relative isolate flex min-h-[9.5rem] w-full flex-col justify-between overflow-hidden rounded-[1.4rem] border border-black/5 bg-[linear-gradient(140deg,var(--bg1),var(--bg2))] p-5 text-start text-(--ink) outline-none transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-[0_26px_50px_-30px_rgb(112_71_235/0.55)] focus-visible:ring-3 focus-visible:ring-primary/45 motion-reduce:transition-none motion-reduce:hover:translate-y-0 dark:border-white/10",
        TONE_CLASS[collection.tone],
      )}
    >
      <div className="max-w-[16rem] sm:max-w-sm min-[1360px]:max-w-[14rem]">
        <p className="text-[0.68rem] font-semibold tracking-[0.14em] uppercase opacity-70">Collection</p>
        <h3 className="mt-1.5 font-heading text-[1.25rem] leading-tight font-extrabold tracking-[-0.025em]">{collection.title}</h3>
        <p className="mt-1.5 line-clamp-2 text-[0.85rem] leading-snug opacity-75">{collection.blurb}</p>
      </div>
      <span className="mt-4 inline-flex items-center gap-1.5 text-[0.82rem] font-semibold">
        {count} {count === 1 ? "product" : "products"}
        <ArrowUpRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none" aria-hidden />
      </span>
      <div className="pointer-events-none absolute top-1/2 right-5 hidden h-24 w-32 -translate-y-1/2 sm:block lg:hidden min-[1360px]:block" aria-hidden>
        {firstCovers.slice(0, 2).map((p, i) => (
          <div key={p.id} className={cn("absolute w-24 overflow-hidden rounded-xl border border-white/60 shadow-[0_16px_30px_-16px_rgb(32_33_39/0.5)] transition-transform duration-300 motion-reduce:transition-none dark:border-white/10", i === 0 ? "top-3 left-0 -rotate-6 group-hover:-rotate-[9deg]" : "top-0 right-0 rotate-6 group-hover:rotate-[9deg]")}>
            <ProductCover category={p.category} tone={p.tone} className="aspect-[16/10]" art="" />
          </div>
        ))}
      </div>
    </button>
  );
}

function ClosingCta({ preview }: { preview: boolean }) {
  return (
    <section className={cn(wrap, "pb-16 sm:pb-24")} aria-labelledby="dp-cta-title">
      <div className="relative isolate overflow-hidden rounded-[2rem] bg-[#15161b] px-6 py-12 text-white sm:px-12 sm:py-14">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_90%_at_10%_0%,rgb(112_71_235/0.5),transparent_70%),radial-gradient(40%_60%_at_100%_100%,rgb(200_255_82/0.12),transparent_70%)]" aria-hidden />
        <h2 id="dp-cta-title" className="max-w-2xl font-heading text-[1.9rem] leading-tight font-extrabold tracking-[-0.03em] text-balance sm:text-[2.5rem]">
          {preview ? "Digital tools are" : "More digital tools are"} <span className="text-lime">on the way.</span>
        </h2>
        <p className="mt-3 max-w-xl text-white/65">{preview ? "Until the marketplace opens, explore the Sociotix services and AI tools, or tell us which digital products you'd like to see." : "Purchasing opens in a later phase. Meanwhile, explore the Sociotix services and AI tools, or tell us which digital products you'd like to see."}</p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link href="/#services" className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-lime px-6 font-semibold text-graphite transition-colors hover:bg-lime/90 focus-visible:ring-3 focus-visible:ring-lime/40 focus-visible:outline-none">
            Browse social media services <ArrowRight className="size-4" aria-hidden />
          </Link>
          <Link href="/ai-tools" className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/15 px-6 font-semibold text-white transition-colors hover:bg-white/5 focus-visible:ring-3 focus-visible:ring-white/25 focus-visible:outline-none">
            Explore AI tools <ArrowUpRight className="size-4" aria-hidden />
          </Link>
          <a href={`mailto:${CONTACT}?subject=${encodeURIComponent("Digital products suggestion")}`} className="inline-flex h-12 items-center justify-center gap-2 rounded-full px-4 font-semibold text-white/80 underline decoration-white/30 underline-offset-4 transition-colors hover:text-white focus-visible:ring-3 focus-visible:ring-white/25 focus-visible:outline-none">
            Suggest a product
          </a>
        </div>
      </div>
    </section>
  );
}

export function DigitalMarketplace({ products, preview }: { products: DigitalProduct[]; preview: boolean }) {
  const [category, setCategory] = React.useState<Filters["category"]>("all");
  const [collection, setCollection] = React.useState<Collection | null>(null);
  const [query, setQuery] = React.useState("");
  const [type, setType] = React.useState<Filters["type"]>("all");
  const [price, setPrice] = React.useState<PriceFilter>("all");
  const [sort, setSort] = React.useState<SortId>("featured");
  const [shown, setShown] = React.useState(PAGE_SIZE);

  // Typing stays responsive: the grid follows a deferred copy of the query and dims while it catches up.
  const deferredQuery = React.useDeferredValue(query);
  const busy = deferredQuery !== query;

  const { hasPrices } = capabilities(products);
  const sorts = availableSorts(products);
  const filters: Filters = { category, collection: collection?.categories ?? null, query: deferredQuery, type, price };
  const filtering = category !== "all" || collection !== null || query.trim() !== "" || type !== "all" || price !== "all";
  const featured = filtering || !products.some((p) => p.featured) ? [] : sortProducts(products.filter((p) => p.featured), "featured").slice(0, 3);
  const results = sortProducts(filterProducts(products, filters), sort).filter((p) => filtering || !featured.some((f) => f.id === p.id));
  const visible = results.slice(0, shown);
  const typesPresent = PRODUCT_TYPES.filter((t) => products.some((p) => p.type === t));
  // Tab counts follow the search, type and price filters, so they always match what a tab would show.
  // Built-in categories, then custom ones (added in admin) that have products.
  const custom = [...new Map(products.filter((p) => !DIGITAL_CATEGORIES.some((c) => c.id === p.category)).map((p) => [p.category, { id: p.category, name: productCategoryName(p) }])).values()];
  // The concept preview shows every category; a real catalogue shows only categories that have products.
  const allCategories = [...DIGITAL_CATEGORIES, ...custom].filter((c) => preview || products.some((p) => p.category === c.id));
  const hasFree = products.some((p) => p.price.kind === "free" && p.availability === "available");
  const hasPaid = products.some((p) => p.price.kind === "paid");
  const nameOf = (id: string) => allCategories.find((c) => c.id === id)?.name ?? id;
  const tabs = [{ id: "all" as const, name: "All products" }, ...allCategories];
  const counts = Object.fromEntries(tabs.map((c) => [c.id, filterProducts(products, { ...filters, collection: null, category: c.id }).length]));
  const collectionCount = (c: Collection) => products.filter((p) => c.categories.includes(p.category)).length;
  const collections = COLLECTIONS.filter((c) => collectionCount(c) > 0);

  const reset = () => {
    setCategory("all");
    setCollection(null);
    setQuery("");
    setType("all");
    setPrice("all");
    setShown(PAGE_SIZE);
  };
  const changed = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setShown(PAGE_SIZE);
  };
  const pickCategory = (c: Filters["category"]) => {
    setCollection(null);
    changed(setCategory)(c);
  };
  // Jumping to the results waits for the layout to settle: picking a collection or category hides the sections above them.
  const [jump, setJump] = React.useState(0);
  React.useEffect(() => {
    if (jump) document.getElementById("products")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }, [jump]);
  const pickCollection = (c: Collection) => {
    setCategory("all");
    changed(setCollection)(c);
    setJump((n) => n + 1);
  };

  // Active filters as removable chips.
  const chips: { key: string; label: string; clear: () => void }[] = [
    ...(query.trim() ? [{ key: "q", label: `Search: ${query.trim()}`, clear: () => setQuery("") }] : []),
    ...(category !== "all" ? [{ key: "c", label: nameOf(category), clear: () => setCategory("all") }] : []),
    ...(collection ? [{ key: "col", label: `Collection: ${collection.title}`, clear: () => setCollection(null) }] : []),
    ...(type !== "all" ? [{ key: "t", label: type, clear: () => setType("all") }] : []),
    ...(price !== "all" ? [{ key: "p", label: price === "free" ? "Free" : "Paid", clear: () => setPrice("all") }] : []),
  ];
  const heading = query.trim() ? `Results for “${query.trim()}”` : collection ? collection.title : category !== "all" ? nameOf(category) : "All products";

  return (
    <>
      {/* Hero: heading, one line, the search that drives everything below, and a showcase of product covers. */}
      <section className="relative isolate overflow-hidden border-b" aria-labelledby="dp-title">
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
          <div className="aurora aurora-a -top-40 -right-24 size-[30rem] bg-[#7047EB]/20 dark:bg-[#7047EB]/35" />
          <div className="aurora aurora-b -bottom-48 left-[8%] size-[22rem] bg-[#C8FF52]/25 dark:bg-[#C8FF52]/10" />
          <div className="absolute inset-0 mask-[radial-gradient(70%_90%_at_50%_0%,black,transparent)]">
            <div className="grid-pan absolute -inset-[44px] bg-[linear-gradient(to_right,rgb(32_33_39/0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgb(32_33_39/0.05)_1px,transparent_1px)] bg-size-[44px_44px] dark:bg-[linear-gradient(to_right,rgb(255_255_255/0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.05)_1px,transparent_1px)]" />
          </div>
        </div>
        <div className={cn(wrap, "grid items-center gap-10 py-12 sm:py-16 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-6 lg:py-14")}>
          <div className="text-center lg:text-start">
            <p className="inline-flex items-center gap-2 rounded-full border bg-card/70 px-3 py-1 text-[0.72rem] font-semibold tracking-[0.14em] text-primary uppercase backdrop-blur dark:text-[#b9a6ff]">
              Digital Products
            </p>
            <h1 id="dp-title" className="mt-5 max-w-3xl font-heading text-[2.4rem] leading-[1.05] font-extrabold tracking-[-0.045em] text-balance sm:text-[3.4rem] lg:text-[3.5rem] xl:text-[3.9rem]">
              Digital Tools. <span className="text-[#7047EB] dark:text-[#9277F4]">Bigger Possibilities.</span>
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-[1.05rem] leading-relaxed text-muted-foreground lg:mx-0">Templates, prompts, planners, guides and creative toolkits for social media work, all in one place.</p>
            <form role="search" onSubmit={(e) => e.preventDefault()} className="relative mx-auto mt-8 max-w-xl lg:mx-0">
              <Search className="pointer-events-none absolute top-1/2 left-5 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <label htmlFor="dp-search" className="sr-only">
                Search digital products
              </label>
              <input
                id="dp-search"
                type="search"
                value={query}
                onChange={(e) => changed(setQuery)(e.target.value)}
                placeholder="Search digital products"
                autoComplete="off"
                className="h-14 w-full rounded-full border bg-card ps-13 pe-12 text-[0.98rem] shadow-[0_18px_40px_-28px_rgb(112_71_235/0.55)] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-muted-foreground focus:border-primary/45 focus:ring-4 focus:ring-primary/15 dark:bg-[#17181d] [&::-webkit-search-cancel-button]:hidden"
              />
              {query ? (
                <button type="button" onClick={() => setQuery("")} className="absolute top-1/2 right-3 grid size-8 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none">
                  <X className="size-4" aria-hidden />
                  <span className="sr-only">Clear search</span>
                </button>
              ) : null}
            </form>
            {products.length ? (
              <p className="mt-4 text-[0.8rem] text-muted-foreground">
                {allCategories.length} {allCategories.length === 1 ? "category" : "categories"} · {products.length} {products.length === 1 ? "product" : "products"}
              </p>
            ) : null}
          </div>
          <HeroImage />
        </div>
      </section>

      {products.length === 0 ? (
        <section className={cn(wrap, "py-16 sm:py-24")} aria-labelledby="dp-empty-title">
          <div className="mx-auto max-w-lg rounded-2xl border border-dashed bg-card/60 p-8 text-center dark:bg-white/[0.02]">
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/[0.09] text-primary dark:bg-primary/20 dark:text-[#b9a6ff]">
              <Sparkles className="size-6" aria-hidden />
            </span>
            <h2 id="dp-empty-title" className="mt-5 font-heading text-[1.4rem] font-extrabold tracking-[-0.02em]">
              The marketplace is opening soon.
            </h2>
            <p className="mt-2 text-muted-foreground">No products are listed yet. We only list things that are genuinely useful.</p>
          </div>
        </section>
      ) : (
        <>
          {/* Category tabs: one compact row that scrolls sideways on small screens. */}
          <section className={cn(wrap, "pt-8 sm:pt-10")} aria-labelledby="dp-categories-title">
            <h2 id="dp-categories-title" className="sr-only">
              Browse by category
            </h2>
            <div role="group" aria-label="Filter products by category" className="relative -mx-4 flex snap-x gap-2 overflow-x-auto scroll-smooth px-4 py-1 [scrollbar-width:none] sm:mx-0 sm:px-0 motion-reduce:scroll-auto [&::-webkit-scrollbar]:hidden">
              {tabs.map((c) => {
                const active = category === c.id && !collection;
                const n = counts[c.id];
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => pickCategory(c.id)}
                    className={cn(
                      "inline-flex h-10 shrink-0 snap-start items-center gap-2 rounded-full border ps-4 pe-1.5 text-[0.875rem] font-semibold whitespace-nowrap outline-none transition-[background-color,border-color,color,box-shadow] duration-150 focus-visible:ring-3 focus-visible:ring-primary/40 motion-reduce:transition-none",
                      active ? "border-[#7047EB] bg-[#7047EB] text-white shadow-[0_10px_24px_-14px_rgb(112_71_235/0.9)]" : "border-border/70 bg-muted/50 text-foreground/75 hover:border-primary/25 hover:bg-primary/[0.06] hover:text-foreground dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.08]",
                    )}
                  >
                    {c.name}
                    <span className={cn("grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-[0.7rem] font-semibold tabular-nums", active ? "bg-white/20 text-white" : "bg-background text-muted-foreground dark:bg-white/10")}>
                      {n}
                      <span className="sr-only"> {n === 1 ? "product" : "products"}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            {preview ? (
              <p role="note" className="mt-5 flex items-start gap-2.5 rounded-xl border border-primary/20 bg-primary/[0.04] px-4 py-3 text-[0.85rem] leading-relaxed text-foreground/80 dark:bg-primary/10">
                <Info className="mt-0.5 size-4 shrink-0 text-primary dark:text-[#b9a6ff]" aria-hidden />
                <span>
                  <span className="font-semibold">Opening soon.</span> Browse what is planned. Purchasing isn&apos;t available yet, and prices will be announced at launch.
                </span>
              </p>
            ) : (
              <p role="note" className="mt-5 flex items-start gap-2.5 rounded-xl border border-primary/20 bg-primary/[0.04] px-4 py-3 text-[0.85rem] leading-relaxed text-foreground/80 dark:bg-primary/10">
                <Info className="mt-0.5 size-4 shrink-0 text-primary dark:text-[#b9a6ff]" aria-hidden />
                <span>
                  {hasFree ? (
                    <>
                      <span className="font-semibold">Free products can be downloaded</span> with a Sociotix account.{" "}
                    </>
                  ) : null}
                  {hasPaid || !hasFree ? "Purchasing isn't open yet, so nothing can be bought or charged." : "Nothing here can be bought or charged."}
                </span>
              </p>
            )}
          </section>

          {featured.length ? (
            <section className={cn(wrap, "pt-12")} aria-labelledby="dp-featured-title">
              <h2 id="dp-featured-title" className="font-heading text-[1.6rem] font-extrabold tracking-[-0.025em]">
                Featured products
              </h2>
              <div className="mt-6">
                <ProductGrid products={featured} label="Featured products" preview={preview} />
              </div>
            </section>
          ) : null}

          {!filtering && collections.length ? (
            <section className={cn(wrap, "pt-14")} aria-labelledby="dp-collections-title">
              <h2 id="dp-collections-title" className="font-heading text-[1.6rem] font-extrabold tracking-[-0.025em]">
                Curated collections
              </h2>
              <ul aria-label="Curated collections" className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
                {collections.map((c) => (
                  <li key={c.id}>
                    <CollectionBanner collection={c} count={collectionCount(c)} firstCovers={products.filter((p) => c.categories.includes(p.category))} onPick={pickCollection} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section id="products" className={cn(wrap, "pt-14 pb-16 sm:pb-20")} aria-labelledby="dp-all-title">
            <h2 id="dp-all-title" className="font-heading text-[1.6rem] font-extrabold tracking-[-0.025em]">
              {heading}
            </h2>

            {/* One toolbar: result count, type and sort controls, reset, and the active filters as chips. */}
            <div className="mt-5 rounded-2xl border bg-card p-3 dark:bg-white/[0.03]">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5">
                <p className="me-auto px-1 text-sm text-muted-foreground" aria-live="polite">
                  <span className="font-semibold text-foreground tabular-nums">{results.length}</span> {results.length === 1 ? "product" : "products"}
                  {filtering ? " match" : ""}
                </p>
                <div className={cn("grid w-full gap-2 sm:flex sm:w-auto", hasPrices ? "grid-cols-3" : "grid-cols-2")}>
                  <Select aria-label="Product type" value={type} onChange={(e) => changed(setType)(e.target.value as ProductType | "all")} className="h-10 sm:w-40">
                    <option value="all">All types</option>
                    {typesPresent.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </Select>
                  {hasPrices ? (
                    <Select aria-label="Price" value={price} onChange={(e) => changed(setPrice)(e.target.value as PriceFilter)} className="h-10 sm:w-32">
                      <option value="all">Any price</option>
                      <option value="free">Free</option>
                      <option value="paid">Paid</option>
                    </Select>
                  ) : null}
                  <Select aria-label="Sort products" value={sort} onChange={(e) => changed(setSort)(e.target.value as SortId)} className="h-10 sm:w-48">
                    {sorts.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </Select>
                </div>
                {filtering ? (
                  <button type="button" onClick={reset} className="inline-flex h-10 items-center gap-1.5 rounded-full px-3.5 text-[0.85rem] font-semibold text-primary transition-colors hover:bg-primary/[0.08] focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none dark:text-[#b9a6ff]">
                    <RotateCcw className="size-3.5" aria-hidden /> Reset
                  </button>
                ) : null}
              </div>
              {chips.length ? (
                <ul aria-label="Active filters" className="mt-3 flex flex-wrap gap-2 border-t pt-3">
                  {chips.map((c) => (
                    <li key={c.key}>
                      <button type="button" onClick={c.clear} className="group/chip inline-flex h-8 max-w-full items-center gap-1.5 rounded-full bg-primary/[0.08] ps-3 pe-2 text-[0.8rem] font-semibold text-primary transition-colors hover:bg-primary/15 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none dark:bg-primary/20 dark:text-[#cbbdff]">
                        <span className="truncate">{c.label}</span>
                        <X className="size-3.5 shrink-0 opacity-70 group-hover/chip:opacity-100" aria-hidden />
                        <span className="sr-only">Remove filter</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <div className={cn("mt-6 transition-opacity duration-150 motion-reduce:transition-none", busy && "opacity-60")} aria-busy={busy || undefined}>
              {visible.length ? (
                <ProductGrid products={visible} label="All products" preview={preview} />
              ) : (
                <div className="rounded-2xl border border-dashed p-10 text-center">
                  <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-primary/[0.09] text-primary dark:bg-primary/20 dark:text-[#b9a6ff]">
                    <Search className="size-5" aria-hidden />
                  </span>
                  <p className="mt-4 font-heading text-lg font-bold">{filtering ? "No products match that yet" : "More products coming soon"}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{filtering ? "Try another word, or clear the filters to see everything." : "The featured products above are all there is so far."}</p>
                  {filtering ? (
                    <button type="button" onClick={reset} className="mt-5 inline-flex h-10 items-center gap-2 rounded-full border bg-card px-4 text-sm font-semibold hover:bg-muted focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none">
                      Show all products
                    </button>
                  ) : null}
                </div>
              )}
            </div>
            {results.length > visible.length ? (
              <div className="mt-8 flex justify-center">
                <button type="button" onClick={() => setShown((n) => n + PAGE_SIZE)} className="inline-flex h-11 items-center gap-2 rounded-full border bg-card px-6 text-sm font-semibold transition-colors hover:border-primary/35 hover:text-primary focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none">
                  Load more products
                </button>
              </div>
            ) : null}
          </section>
        </>
      )}

      <ClosingCta preview={preview} />
    </>
  );
}
