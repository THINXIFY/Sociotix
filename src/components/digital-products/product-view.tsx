import Link from "next/link";
import { ArrowLeft, ArrowRight, BellRing, ChevronRight, Download, ExternalLink, FileText, Layers, ListChecks, Lock, Tag } from "lucide-react";
import { ShareBar } from "@/components/blog/article-tools";
import { RichBody } from "@/components/blog/rich-body";
import { ProductGallery } from "@/components/digital-products/gallery";
import { ProductGrid } from "@/components/digital-products/product-card";
import { DIGITAL_PRODUCTS_PATH, type DigitalProduct, priceLabel, productCategoryName, productHref, relatedProducts } from "@/lib/digital-products";
import { formatBytes } from "@/lib/digital-products/admin";
import { absoluteUrl } from "@/lib/seo/site";

const CONTACT = "hello@sociotix.com";
const wrap = "mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8";
const h2 = "font-heading text-[1.45rem] font-extrabold tracking-[-0.025em]";
const primaryBtn =
  "group inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 text-[0.95rem] font-semibold text-primary-foreground shadow-[0_14px_30px_-14px_rgb(112_71_235/0.95)] transition-[background-color,transform] duration-200 hover:-translate-y-px hover:bg-primary/92 focus-visible:ring-3 focus-visible:ring-primary/35 focus-visible:outline-none motion-reduce:hover:translate-y-0";

/**
 * What a visitor can do with a product. Purchasing is never open, so only free, released products offer
 * downloads (through the permission-checked endpoint, which asks visitors to sign in first).
 */
export type ProductState = "concept" | "coming_soon" | "free_download" | "paid_closed" | "released_unpriced";

export function productState(p: DigitalProduct, preview: boolean): ProductState {
  if (preview || p.source !== "admin") return "concept";
  if (p.availability !== "available") return "coming_soon";
  if (p.price.kind === "free") return "free_download";
  if (p.price.kind === "paid") return "paid_closed";
  return "released_unpriced";
}

const BADGE: Record<ProductState, { text: string; tone: "soon" | "live" }> = {
  concept: { text: "Coming soon, not available to buy yet", tone: "soon" },
  coming_soon: { text: "Coming soon", tone: "soon" },
  free_download: { text: "Free download", tone: "live" },
  paid_closed: { text: "Released · purchasing isn't open yet", tone: "soon" },
  released_unpriced: { text: "Released · pricing to be announced", tone: "soon" },
};

/** Release details appear only when the product actually has them; nothing is filled in for unreleased products. */
function releaseDetails(p: DigitalProduct): { title: string; items: string[] }[] {
  const all: { title: string; items?: string[] }[] = [
    { title: "Specifications", items: [...(p.formats?.map((f) => `File format: ${f}`) ?? []), ...(p.specifications ?? [])] },
    { title: "Compatibility", items: p.compatibility },
    { title: "Requirements", items: p.requirements },
    { title: "License", items: p.license ? [p.license] : undefined },
  ];
  return all.filter((s): s is { title: string; items: string[] } => Boolean(s.items?.length));
}

export function ProductView({ product: p, products, preview, staffPreview = false }: { product: DigitalProduct; products: DigitalProduct[]; preview: boolean; staffPreview?: boolean }) {
  const state = productState(p, preview);
  const concept = state === "concept";
  const path = productHref(p);
  const related = relatedProducts(p, products);
  const release = releaseDetails(p);
  const id = (name: string) => `${name}-${p.id}`;
  const downloads = state === "free_download" ? p.downloads : undefined;
  const hasDownloads = Boolean(downloads && (downloads.files.length || downloads.links.length));
  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Digital Products", path: DIGITAL_PRODUCTS_PATH },
    { name: p.title, path },
  ];
  const facts = [
    { icon: Tag, label: "Category", value: productCategoryName(p) },
    { icon: Layers, label: "Type", value: p.type },
    ...(p.includes.length ? [{ icon: ListChecks, label: concept ? "Planned contents" : "Contents", value: `${p.includes.length} ${p.includes.length === 1 ? "item" : "items"}` }] : []),
    { icon: FileText, label: "Status", value: concept || state === "coming_soon" ? "Coming soon" : "Released" },
  ];
  const badge = BADGE[state];
  const notify = (
    <a href={`mailto:${CONTACT}?subject=${encodeURIComponent(`Notify me when available: ${p.title}`)}`} className={primaryBtn}>
      <BellRing className="size-4 transition-transform duration-300 group-hover:-rotate-12 motion-reduce:transition-none" aria-hidden /> Notify Me When Available
    </a>
  );

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[34rem] bg-[radial-gradient(60%_70%_at_20%_0%,rgb(112_71_235/0.09),transparent_70%)] dark:bg-[radial-gradient(60%_70%_at_20%_0%,rgb(112_71_235/0.2),transparent_70%)]" aria-hidden />

      <div className={`${wrap} flex flex-wrap items-center justify-between gap-3 pt-6 sm:pt-8`}>
        <nav aria-label="Breadcrumb" className="min-w-0">
          <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
            {crumbs.map((c, i) => (
              <li key={c.path} className="flex min-w-0 items-center gap-1.5">
                {i > 0 ? <ChevronRight className="size-3.5 shrink-0" aria-hidden /> : null}
                {i < crumbs.length - 1 ? (
                  <Link href={c.path} className="transition-colors hover:text-foreground">
                    {c.name}
                  </Link>
                ) : (
                  <span aria-current="page" className="truncate text-foreground/80">
                    {c.name}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>
        <Link href={DIGITAL_PRODUCTS_PATH} className="hidden items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-primary sm:inline-flex dark:hover:text-[#b9a6ff]">
          <ArrowLeft className="size-4" aria-hidden /> Back to all digital products
        </Link>
      </div>

      <div className={`${wrap} grid grid-cols-1 gap-10 pt-6 pb-16 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-12 xl:gap-16`}>
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <ProductGallery product={p} />
        </div>

        {/* Information panel: sticky beside the gallery on desktop, in the normal flow on smaller screens. */}
        <aside className="lg:col-start-2 lg:row-span-2 lg:row-start-1" aria-labelledby={id("product-title")}>
          <div className="lg:sticky lg:top-24">
            <p className="flex flex-wrap items-center gap-2 text-[0.78rem] font-semibold">
              <span className="text-primary dark:text-[#b9a6ff]">{productCategoryName(p)}</span>
              <span className="size-1 rounded-full bg-muted-foreground/40" aria-hidden />
              <span className="text-muted-foreground">{p.type}</span>
            </p>
            <h1 id={id("product-title")} className="mt-3 font-heading text-[2.1rem] leading-[1.04] font-extrabold tracking-[-0.04em] text-balance sm:text-[2.6rem] xl:text-[2.9rem]">
              {p.title}
            </h1>
            <p className="mt-4 text-[1.05rem] leading-relaxed text-muted-foreground">{p.description}</p>

            <section aria-labelledby={id("availability-title")} className="mt-7 overflow-hidden rounded-[1.4rem] bg-card ring-1 ring-black/[0.06] shadow-[0_30px_60px_-44px_rgb(112_71_235/0.6)] dark:bg-white/[0.04] dark:ring-white/10">
              <h2 id={id("availability-title")} className="sr-only">
                Availability
              </h2>
              <div className="flex items-center justify-between gap-3 border-b px-5 py-4 dark:border-white/10">
                <span className={badge.tone === "live" ? "inline-flex items-center gap-2 rounded-full bg-lime/25 px-3 py-1 text-[0.8rem] font-semibold text-foreground" : "inline-flex items-center gap-2 rounded-full bg-soon-soft px-3 py-1 text-[0.8rem] font-semibold text-soon"}>
                  <span className="relative flex size-2">
                    {badge.tone === "soon" ? <span className="absolute inline-flex size-full animate-ping rounded-full bg-soon opacity-50 motion-reduce:animate-none" /> : null}
                    <span className={badge.tone === "live" ? "relative inline-flex size-2 rounded-full bg-[#5f8f00]" : "relative inline-flex size-2 rounded-full bg-soon"} />
                  </span>
                  {badge.text}
                </span>
              </div>
              <dl className="flex items-baseline justify-between gap-3 px-5 pt-4">
                <dt className="text-sm text-muted-foreground">Price</dt>
                <dd className="font-heading text-[1.15rem] font-extrabold">{p.price.kind === "unset" ? "To be announced" : priceLabel(p.price)}</dd>
              </dl>
              <div className="space-y-2.5 p-5">
                {state === "free_download" && downloads && hasDownloads ? (
                  <>
                    <ul className="space-y-2.5" aria-label="Downloads">
                      {downloads.files.map((f) => (
                        <li key={f.id}>
                          <a href={`/api/digital-products/${p.id}/files/${f.id}`} className={primaryBtn} rel="nofollow">
                            <Download className="size-4" aria-hidden /> <span className="min-w-0 truncate">Download {f.name}</span>
                          </a>
                          <p className="mt-1 text-center text-xs text-muted-foreground">
                            {f.type} · {formatBytes(f.sizeBytes)}
                            {f.version ? ` · Version ${f.version}` : ""}
                          </p>
                        </li>
                      ))}
                      {downloads.links.map((l) => (
                        <li key={l.id} className="rounded-2xl border p-3 dark:border-white/10">
                          {l.title ? <p className="text-sm font-semibold">{l.title}</p> : null}
                          {l.instructions ? <p className="mt-1 text-xs leading-relaxed whitespace-pre-line text-muted-foreground">{l.instructions}</p> : null}
                          <a href={`/api/digital-products/${p.id}/links/${l.id}`} rel="nofollow noopener noreferrer" target="_blank" className="mt-2.5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-primary/40 px-4 text-sm font-semibold text-primary transition-colors hover:bg-primary/[0.07] focus-visible:ring-3 focus-visible:ring-primary/35 focus-visible:outline-none dark:text-[#b9a6ff]">
                            <ExternalLink className="size-4" aria-hidden /> {l.label}
                            {l.provider ? <span className="font-normal text-muted-foreground">· {l.provider}</span> : null}
                          </a>
                        </li>
                      ))}
                    </ul>
                    <p className="pt-1 text-center text-xs leading-relaxed text-muted-foreground">Free with a Sociotix account. If you aren&apos;t signed in, you&apos;ll be asked to sign in and brought straight back. Downloads also appear in My Digital Products.</p>
                  </>
                ) : state === "free_download" ? (
                  <>
                    {notify}
                    <p className="pt-1 text-center text-xs leading-relaxed text-muted-foreground">This free product&apos;s downloads aren&apos;t ready yet. The button above emails us so we can let you know.</p>
                  </>
                ) : (
                  <>
                    {notify}
                    <button type="button" disabled aria-describedby={id("buy-note")} className="inline-flex h-11 w-full cursor-not-allowed items-center justify-center gap-2 rounded-full border border-dashed text-sm font-semibold text-muted-foreground dark:border-white/15">
                      <Lock className="size-4" aria-hidden /> Purchase unavailable
                    </button>
                    <p id={id("buy-note")} className="pt-1 text-center text-xs leading-relaxed text-muted-foreground">
                      {state === "paid_closed" ? "Purchasing isn't open yet, so this product can't be bought or downloaded. Nothing can be charged. The button above emails us so we can let you know when it opens." : "Buying opens in a later phase. Nothing can be purchased or charged yet. The button above emails us so we can let you know."}
                    </p>
                  </>
                )}
              </div>
            </section>

            {staffPreview ? null : (
              <div className="mt-6">
                <p className="mb-3 text-[0.72rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">Share this product</p>
                <ShareBar url={absoluteUrl(path)} title={p.title} />
              </div>
            )}
            <Link href={DIGITAL_PRODUCTS_PATH} className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline sm:hidden dark:text-[#b9a6ff]">
              <ArrowLeft className="size-4" aria-hidden /> Back to all digital products
            </Link>
          </div>
        </aside>

        {/* Details: readable sections, no tables; only information that exists. */}
        <div className="min-w-0 space-y-12 lg:col-start-1 lg:row-start-2">
          <section aria-labelledby={id("overview-title")}>
            <h2 id={id("overview-title")} className={h2}>
              Overview
            </h2>
            <ul className="mt-5 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
              {facts.map((f) => (
                <li key={f.label} className="min-w-0">
                  <span className="grid size-9 place-items-center rounded-xl bg-primary/[0.08] text-primary dark:bg-primary/20 dark:text-[#b9a6ff]" aria-hidden>
                    <f.icon className="size-4" />
                  </span>
                  <p className="mt-2.5 text-xs text-muted-foreground">{f.label}</p>
                  <p className="mt-0.5 text-[0.92rem] leading-snug font-semibold">{f.value}</p>
                </li>
              ))}
            </ul>
          </section>

          {p.highlights?.length ? (
            <section aria-labelledby={id("highlights-title")}>
              <h2 id={id("highlights-title")} className={h2}>
                Highlights
              </h2>
              <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                {p.highlights.map((h) => (
                  <li key={h} className="flex items-start gap-3 rounded-2xl bg-muted/50 p-4 text-[0.95rem] leading-relaxed dark:bg-white/[0.04]">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                    {h}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {p.rich?.length ? (
            <section aria-labelledby={id("description-title")}>
              <h2 id={id("description-title")} className={h2}>
                Description
              </h2>
              <div className="mt-2 max-w-prose">
                <RichBody blocks={p.rich} />
              </div>
            </section>
          ) : null}

          {p.includes.length ? (
            <section aria-labelledby={id("contents-title")}>
              <h2 id={id("contents-title")} className={h2}>
                {concept ? "Planned contents" : "What's included"}
              </h2>
              <ol className="mt-5 grid gap-x-8 sm:grid-cols-2">
                {p.includes.map((item, i) => (
                  <li key={item} className="flex items-start gap-4 border-t py-4 dark:border-white/10">
                    <span className="font-heading text-[0.95rem] font-extrabold text-primary/70 tabular-nums dark:text-[#b9a6ff]/80">{String(i + 1).padStart(2, "0")}</span>
                    <span className="text-[0.98rem] leading-relaxed">{item}</span>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          {release.map((s) => (
            <section key={s.title} aria-labelledby={id(s.title.toLowerCase())}>
              <h2 id={id(s.title.toLowerCase())} className={h2}>
                {s.title}
              </h2>
              <ul className="mt-4 flex flex-wrap gap-2">
                {s.items.map((x) => (
                  <li key={x} className="rounded-full bg-muted px-3 py-1.5 text-[0.88rem] font-medium dark:bg-white/[0.06]">
                    {x}
                  </li>
                ))}
              </ul>
              {s.title === "License" && p.licenseTerms ? <p className="mt-4 max-w-prose text-[0.95rem] leading-relaxed whitespace-pre-line text-muted-foreground">{p.licenseTerms}</p> : null}
            </section>
          ))}
          {!p.license && p.licenseTerms ? (
            <section aria-labelledby={id("terms-title")}>
              <h2 id={id("terms-title")} className={h2}>
                Usage terms
              </h2>
              <p className="mt-4 max-w-prose text-[0.95rem] leading-relaxed whitespace-pre-line text-muted-foreground">{p.licenseTerms}</p>
            </section>
          ) : null}
          {(concept && release.length < 4) || (state === "coming_soon" && release.length === 0) ? (
            <p className="flex items-start gap-3 border-s-2 border-lime ps-4 text-[0.92rem] leading-relaxed text-muted-foreground">File formats, compatibility, requirements and license terms will be published with the product when it&apos;s released.</p>
          ) : null}
        </div>
      </div>

      {related.length ? (
        <section className="border-t bg-muted/30 py-16 sm:py-20 dark:border-white/10 dark:bg-white/[0.015]" aria-labelledby={id("related-title")}>
          <div className={wrap}>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[0.72rem] font-semibold tracking-[0.14em] text-primary uppercase dark:text-[#b9a6ff]">Keep exploring</p>
                <h2 id={id("related-title")} className="mt-2 font-heading text-[1.75rem] font-extrabold tracking-[-0.03em]">
                  Related products
                </h2>
              </div>
              <Link href={DIGITAL_PRODUCTS_PATH} className="group inline-flex items-center gap-1.5 text-sm font-semibold text-primary dark:text-[#b9a6ff]">
                Browse all digital products <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden />
              </Link>
            </div>
            <div className="mt-8">
              <ProductGrid products={related} label="Related products" preview={preview} />
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
