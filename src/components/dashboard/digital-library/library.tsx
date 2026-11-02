"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, FileArchive, History, Library, Link2, Search, Sparkles, X } from "lucide-react";
import { ProductCover } from "@/components/digital-products/cover";
import { productCategoryName } from "@/lib/digital-products";
import { type CustomerLibrary, type DownloadRecord, fileDownloadHref, type LibraryItem, libraryHref } from "@/lib/digital-products/library";
import { formatDate, formatDateTime } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { FileDownloadButton, LinkDownloadButton } from "./download-button";
import { downloadStyles } from "./styles";

/* Customer dashboard → My Digital Products: the products this customer can access, and their download history. */

type Sort = "newest" | "name" | "recent";
const SORTS: { id: Sort; label: string }[] = [
  { id: "newest", label: "Newest first" },
  { id: "name", label: "Name A–Z" },
  { id: "recent", label: "Recently downloaded" },
];

const field = "h-11 rounded-full border bg-card text-sm outline-none transition-[border-color,box-shadow] focus-visible:border-primary/50 focus-visible:ring-3 focus-visible:ring-primary/15 dark:bg-white/[0.04]";

function sortItems(items: LibraryItem[], sort: Sort) {
  const list = [...items];
  if (sort === "name") return list.sort((a, b) => a.product.title.localeCompare(b.product.title));
  if (sort === "recent") return list.sort((a, b) => (b.lastDownloadedAt ?? "").localeCompare(a.lastDownloadedAt ?? "") || a.product.title.localeCompare(b.product.title));
  return list.sort((a, b) => (b.product.listedAt ?? "").localeCompare(a.product.listedAt ?? ""));
}

export function Cover({ item, className }: { item: LibraryItem; className?: string }) {
  const img = item.product.images?.[0];
  return img ? (
    // eslint-disable-next-line @next/next/no-img-element -- uploaded images are served from this origin with their real dimensions
    <img src={img.src} alt="" width={img.width} height={img.height} loading="lazy" decoding="async" className={cn("w-full object-cover", className)} />
  ) : (
    <ProductCover category={item.product.category} tone={item.product.tone} className={className} />
  );
}

function LibraryCard({ item }: { item: LibraryItem }) {
  const p = item.product;
  const files = p.downloads?.files ?? [];
  const links = p.downloads?.links ?? [];
  const only = files.length === 1 && !links.length ? files[0] : null;
  const count = files.length + links.length;
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-[1.4rem] border bg-card transition-[transform,border-color,box-shadow] duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_24px_50px_-34px_rgb(112_71_235/0.55)] motion-reduce:transition-none motion-reduce:hover:translate-y-0 dark:bg-white/[0.03]">
      <div className="relative overflow-hidden">
        <Cover item={item} className="aspect-[16/10] transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100" />
        {item.hasUpdate ? (
          <span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-lime px-2.5 py-1 text-[0.7rem] font-bold text-graphite shadow-sm">
            <Sparkles className="size-3" aria-hidden /> Updated
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <p className="flex items-center justify-between gap-2 text-[0.74rem] font-semibold">
          <span className="min-w-0 truncate text-primary dark:text-[#c4b5ff]">{productCategoryName(p)}</span>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-ok-soft px-2 py-0.5 text-ok">
            <span className="size-1.5 rounded-full bg-current" aria-hidden /> Free · Ready
          </span>
        </p>
        <h3 className="mt-2 line-clamp-2 font-heading text-[1.08rem] leading-snug font-extrabold tracking-[-0.02em]">
          <Link href={libraryHref(p.id)} className="outline-none after:absolute after:inset-0 after:content-[''] focus-visible:underline">
            {p.title}
          </Link>
        </h3>
        <p className="mt-1.5 line-clamp-2 text-[0.88rem] leading-relaxed text-muted-foreground">{p.description}</p>
        <p className="mt-3 text-xs text-muted-foreground">
          {count ? [files.length ? `${files.length} file${files.length === 1 ? "" : "s"}` : "", links.length ? `${links.length} link${links.length === 1 ? "" : "s"}` : ""].filter(Boolean).join(" · ") : "Downloads coming soon"}
          {item.lastDownloadedAt ? ` · Last downloaded ${formatDate(item.lastDownloadedAt, { year: true })}` : ""}
        </p>
        <div className="relative z-10 mt-auto flex flex-wrap items-center gap-2 pt-4">
          {only ? (
            <FileDownloadButton href={fileDownloadHref(p.id, only.id)} name={only.name} label="Download" />
          ) : (
            <Link href={libraryHref(p.id)} className={downloadStyles.primary}>
              {count ? "View downloads" : "View product"} <ArrowRight className="size-4" aria-hidden />
            </Link>
          )}
          {only ? (
            <Link href={libraryHref(p.id)} className={downloadStyles.quiet}>
              Details
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function HistoryList({ history }: { history: DownloadRecord[] }) {
  if (!history.length)
    return (
      <p className="rounded-2xl border border-dashed px-5 py-8 text-center text-sm text-muted-foreground">
        Nothing downloaded yet. Your downloads will be listed here.
      </p>
    );
  const action = (r: DownloadRecord) =>
    r.href ? (
      r.kind === "file" ? (
        <FileDownloadButton href={r.href} name={r.name} label="Download again" variant="quiet" />
      ) : (
        <LinkDownloadButton href={r.href} label="Open again" variant="quiet" />
      )
    ) : (
      <span className="text-xs text-muted-foreground">{r.unavailable === "removed" ? "No longer available" : "Not available"}</span>
    );
  return (
    <>
      <div className="hidden overflow-hidden rounded-2xl border md:block">
        <table className="w-full table-fixed text-sm">
          <caption className="sr-only">Your download history</caption>
          <thead className="bg-muted/50 text-[0.68rem] tracking-wider text-muted-foreground uppercase dark:bg-white/[0.03]">
            <tr>
              <th scope="col" className="py-2.5 ps-4 text-start font-bold">Product</th>
              <th scope="col" className="px-3 py-2.5 text-start font-bold">Download</th>
              <th scope="col" className="w-24 px-3 py-2.5 text-start font-bold">Version</th>
              <th scope="col" className="w-44 px-3 py-2.5 text-start font-bold">Date</th>
              <th scope="col" className="w-44 py-2.5 pe-4 text-end font-bold">
                <span className="sr-only">Action</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {history.map((r) => (
              <tr key={r.id}>
                <td className="truncate py-3 ps-4 font-semibold">{r.productSlug ? <Link href={libraryHref(r.productSlug)} className="hover:text-primary">{r.productTitle}</Link> : r.productTitle}</td>
                <td className="px-3 py-3">
                  <span className="flex min-w-0 items-center gap-2">
                    {r.kind === "file" ? <FileArchive className="size-4 shrink-0 text-primary dark:text-[#c4b5ff]" aria-label="File" /> : <Link2 className="size-4 shrink-0 text-primary dark:text-[#c4b5ff]" aria-label="Link" />}
                    <span className="truncate">{r.name}</span>
                  </span>
                </td>
                <td className="px-3 py-3 text-muted-foreground">{r.version || "—"}</td>
                <td className="px-3 py-3 text-muted-foreground">{formatDateTime(r.at, { year: true })}</td>
                <td className="py-2 pe-4 text-end">{action(r)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="divide-y rounded-2xl border md:hidden" aria-label="Your download history">
        {history.map((r) => (
          <li key={r.id} className="flex items-start gap-3 p-4">
            <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-primary/[0.08] text-primary dark:bg-primary/20 dark:text-[#c4b5ff]" aria-hidden>
              {r.kind === "file" ? <FileArchive className="size-4" /> : <Link2 className="size-4" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{r.productTitle}</p>
              <p className="truncate text-xs text-muted-foreground">
                {r.name}
                {r.version ? ` · v${r.version}` : ""}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{formatDateTime(r.at, { year: true })}</p>
              <div className="mt-1.5">{action(r)}</div>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

export function DigitalLibrary({ library }: { library: CustomerLibrary }) {
  const { items, history, summary } = library;
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState("all");
  const [sort, setSort] = React.useState<Sort>("newest");
  const categories = [...new Map(items.map((i) => [i.product.category, productCategoryName(i.product)])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = sortItems(
    items.filter((i) => {
      if (category !== "all" && i.product.category !== category) return false;
      const hay = [i.product.title, i.product.description, productCategoryName(i.product), i.product.type].join(" ").toLowerCase();
      return words.every((w) => hay.includes(w));
    }),
    sort,
  );
  const filtering = Boolean(words.length) || category !== "all";
  const stats = [
    { label: "Products", value: summary.products },
    { label: "Files", value: summary.files },
    { label: "Download links", value: summary.links },
  ];

  return (
    <div className="mx-auto max-w-[80rem] px-3 py-4 sm:px-6 sm:py-7 lg:px-8">
      <section aria-labelledby="library-heading" className="relative isolate overflow-hidden rounded-[1.6rem] bg-graphite p-5 text-white sm:p-8 dark:bg-[#17181d] dark:ring-1 dark:ring-white/10">
        <div aria-hidden className="pointer-events-none absolute -top-28 -right-16 -z-10 size-72 rounded-full bg-primary/45 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-36 left-1/4 -z-10 size-64 rounded-full bg-lime/10 blur-3xl" />
        <p className="inline-flex items-center gap-1.5 text-[0.75rem] font-semibold tracking-wide text-lime uppercase">
          <Library className="size-3.5" aria-hidden /> My Digital Products
        </p>
        <h1 id="library-heading" className="mt-2 font-heading text-[1.9rem] leading-tight font-extrabold tracking-[-0.03em] text-balance sm:text-[2.4rem]">
          Your Digital Library
        </h1>
        <p className="mt-2 max-w-2xl text-[0.95rem] text-pretty text-white/70">Free Sociotix resources you can download any time. Paid products will appear here once purchasing opens and you&apos;ve bought them.</p>
        <dl className="mt-6 grid max-w-lg grid-cols-3 gap-2 sm:gap-3">
          {stats.map((s) => (
            <div key={s.label} className="rounded-2xl bg-white/[0.07] px-3 py-3 ring-1 ring-white/10 sm:px-4">
              <dt className="text-[0.72rem] text-white/60">{s.label}</dt>
              <dd className="mt-0.5 font-heading text-xl font-extrabold tabular-nums">{s.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {items.length ? (
        <section aria-labelledby="products-heading" className="mt-8">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <h2 id="products-heading" className="font-heading text-[1.3rem] font-extrabold tracking-[-0.02em]">
              Your products
            </h2>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative sm:w-72">
                <label htmlFor="library-search" className="sr-only">
                  Search your products
                </label>
                <Search className="pointer-events-none absolute start-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <input id="library-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your products" autoComplete="off" className={cn(field, "w-full ps-10 pe-10 [&::-webkit-search-cancel-button]:hidden")} />
                {query ? (
                  <button type="button" onClick={() => setQuery("")} className="absolute end-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
                    <X className="size-4" aria-hidden />
                    <span className="sr-only">Clear search</span>
                  </button>
                ) : null}
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex">
                <label className="sr-only" htmlFor="library-category">
                  Category
                </label>
                <select id="library-category" value={category} onChange={(e) => setCategory(e.target.value)} className={cn(field, "min-w-0 px-4 dark:[color-scheme:dark] sm:w-52")}>
                  <option value="all">All categories</option>
                  {categories.map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
                <label className="sr-only" htmlFor="library-sort">
                  Sort
                </label>
                <select id="library-sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)} className={cn(field, "min-w-0 px-4 dark:[color-scheme:dark] sm:w-48")}>
                  {SORTS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground" aria-live="polite">
            {filtering ? `${shown.length} of ${items.length} products` : `${items.length} product${items.length === 1 ? "" : "s"}`}
          </p>
          {shown.length ? (
            <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Your products">
              {shown.map((i) => (
                <li key={i.product.id}>
                  <LibraryCard item={i} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed px-6 py-10 text-center">
              <p className="font-heading font-bold">No products match</p>
              <p className="mt-1 text-sm text-muted-foreground">Try another search or category.</p>
              <button type="button" onClick={() => (setQuery(""), setCategory("all"))} className={cn(downloadStyles.secondary, "mt-4")}>
                Clear filters
              </button>
            </div>
          )}
        </section>
      ) : (
        <section aria-labelledby="empty-heading" className="mt-8 flex flex-col items-center rounded-[1.5rem] border border-dashed bg-card px-6 py-14 text-center dark:bg-white/[0.02]">
          <span className="grid size-14 place-items-center rounded-2xl bg-primary/[0.08] text-primary dark:bg-primary/20 dark:text-[#c4b5ff]" aria-hidden>
            <Library className="size-6" />
          </span>
          <h2 id="empty-heading" className="mt-4 font-heading text-xl font-extrabold">
            Your library is empty for now
          </h2>
          <p className="mt-1.5 max-w-md text-sm text-muted-foreground">When free Sociotix resources are released they&apos;ll appear here, ready to download. Browse the marketplace to see what&apos;s coming.</p>
          <Link href="/digital-products" className={cn(downloadStyles.primary, "mt-6")}>
            Explore Marketplace <ArrowUpRight className="size-4" aria-hidden />
          </Link>
        </section>
      )}

      <section aria-labelledby="history-heading" className="mt-10">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="history-heading" className="flex items-center gap-2 font-heading text-[1.3rem] font-extrabold tracking-[-0.02em]">
            <History className="size-5 text-primary dark:text-[#c4b5ff]" aria-hidden /> My downloads
          </h2>
          {history.length ? <span className="text-xs text-muted-foreground">Latest {history.length}</span> : null}
        </div>
        <HistoryList history={history} />
      </section>

      {items.length ? (
        <p className="mt-8 text-center text-sm text-muted-foreground">
          Looking for more?{" "}
          <Link href="/digital-products" className="font-semibold text-primary hover:underline dark:text-[#c4b5ff]">
            Explore the marketplace
          </Link>
        </p>
      ) : null}
    </div>
  );
}
