import Link from "next/link";
import { ArrowLeft, ArrowUpRight, FileArchive, Info, Library, Scale, Sparkles } from "lucide-react";
import { RichBody } from "@/components/blog/rich-body";
import { productCategoryName, productHref } from "@/lib/digital-products";
import { formatBytes } from "@/lib/digital-products/admin";
import { fileDownloadHref, type LibraryItem, LIBRARY_PATH, linkDownloadHref } from "@/lib/digital-products/library";
import { formatDate } from "@/lib/i18n";
import { FileDownloadButton, LinkDownloadButton } from "./download-button";
import { downloadStyles } from "./styles";
import { Cover } from "./library";

/* One product in the customer's library: what it is, its downloads, license and updates. */

const h2 = "font-heading text-[1.15rem] font-extrabold tracking-[-0.02em]";
const card = "rounded-[1.4rem] border bg-card p-5 sm:p-6 dark:bg-white/[0.03]";

function Chips({ title, items }: { title: string; items?: string[] }) {
  if (!items?.length) return null;
  return (
    <div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <ul className="mt-2 flex flex-wrap gap-2">
        {items.map((x) => (
          <li key={x} className="rounded-full bg-muted px-3 py-1.5 text-[0.85rem] font-medium dark:bg-white/[0.06]">
            {x}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LibraryProductDetail({ item }: { item: LibraryItem }) {
  const p = item.product;
  const files = p.downloads?.files ?? [];
  const links = p.downloads?.links ?? [];
  const hasDetails = Boolean(p.specifications?.length || p.formats?.length || p.compatibility?.length || p.requirements?.length);
  return (
    <div className="mx-auto max-w-[80rem] px-3 py-4 sm:px-6 sm:py-7 lg:px-8">
      <Link href={LIBRARY_PATH} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Your Digital Library
      </Link>

      <div className="mt-2 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-6">
          <header className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <div className="w-full shrink-0 overflow-hidden rounded-[1.2rem] border sm:w-60">
              <Cover item={item} className="aspect-[16/10]" />
            </div>
            <div className="min-w-0">
              <p className="text-[0.78rem] font-semibold">
                <span className="text-primary dark:text-[#c4b5ff]">{productCategoryName(p)}</span>
                <span className="text-muted-foreground"> · {p.type}</span>
              </p>
              <h1 className="mt-1.5 font-heading text-[1.75rem] leading-tight font-extrabold tracking-[-0.03em] text-balance sm:text-[2.1rem]">{p.title}</h1>
              <p className="mt-2 text-[0.95rem] leading-relaxed text-pretty text-muted-foreground">{p.description}</p>
              <a href={productHref(p)} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary hover:underline dark:text-[#c4b5ff]">
                View public product page <ArrowUpRight className="size-4" aria-hidden />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            </div>
          </header>

          {item.hasUpdate ? (
            <p role="note" className="flex items-start gap-2.5 rounded-2xl border border-lime/60 bg-lime/15 px-4 py-3 text-sm">
              <Sparkles className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                <span className="font-semibold">Updated since your last download</span>
                {item.lastDownloadedAt ? ` on ${formatDate(item.lastDownloadedAt, { year: true })}` : ""}. Download again to get the latest files.
              </span>
            </p>
          ) : null}

          {p.highlights?.length || p.includes.length ? (
            <section aria-labelledby="included-heading" className={card}>
              <h2 id="included-heading" className={h2}>
                What&apos;s included
              </h2>
              {p.includes.length ? (
                <ul className="mt-4 grid gap-x-6 sm:grid-cols-2">
                  {p.includes.map((x, i) => (
                    <li key={x} className="flex items-start gap-3 border-t py-3 text-[0.95rem] dark:border-white/10">
                      <span className="font-heading text-sm font-extrabold text-primary/70 tabular-nums dark:text-[#c4b5ff]/80">{String(i + 1).padStart(2, "0")}</span>
                      {x}
                    </li>
                  ))}
                </ul>
              ) : null}
              {p.highlights?.length ? (
                <div className="mt-4">
                  <Chips title="Highlights" items={p.highlights} />
                </div>
              ) : null}
            </section>
          ) : null}

          {p.rich?.length ? (
            <section aria-labelledby="about-heading" className={card}>
              <h2 id="about-heading" className={h2}>
                About this product
              </h2>
              <div className="mt-1 max-w-prose">
                <RichBody blocks={p.rich} />
              </div>
            </section>
          ) : null}

          {hasDetails ? (
            <section aria-labelledby="details-heading" className={`${card} space-y-4`}>
              <h2 id="details-heading" className={h2}>
                Details
              </h2>
              <Chips title="Specifications" items={[...(p.formats?.map((f) => `File format: ${f}`) ?? []), ...(p.specifications ?? [])]} />
              <Chips title="Compatibility" items={p.compatibility} />
              <Chips title="Requirements" items={p.requirements} />
            </section>
          ) : null}
        </div>

        <aside className="space-y-6 lg:sticky lg:top-20 lg:self-start" aria-label="Downloads and license">
          <section aria-labelledby="downloads-heading" className={card}>
            <h2 id="downloads-heading" className={h2}>
              Downloads
            </h2>
            {item.lastDownloadedAt ? <p className="mt-1 text-xs text-muted-foreground">Last downloaded {formatDate(item.lastDownloadedAt, { year: true })}</p> : null}
            {files.length || links.length ? (
              <ul className="mt-4 space-y-3" aria-label="Files and links">
                {files.map((f) => (
                  <li key={f.id} className="rounded-2xl border p-3.5 dark:border-white/10">
                    <div className="flex items-start gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/[0.08] text-primary dark:bg-primary/20 dark:text-[#c4b5ff]" aria-hidden>
                        <FileArchive className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{f.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {f.type} · {formatBytes(f.sizeBytes)}
                          {f.version ? ` · Version ${f.version}` : ""}
                        </p>
                      </div>
                    </div>
                    <FileDownloadButton href={fileDownloadHref(p.id, f.id)} name={f.name} label={`Download ${f.type}`} className="mt-3 w-full [&>button]:w-full" />
                  </li>
                ))}
                {links.map((l) => (
                  <li key={l.id} className="rounded-2xl border p-3.5 dark:border-white/10">
                    {l.title ? <p className="text-sm font-semibold">{l.title}</p> : null}
                    {l.instructions ? <p className="mt-1 text-xs leading-relaxed whitespace-pre-line text-muted-foreground">{l.instructions}</p> : null}
                    <LinkDownloadButton href={linkDownloadHref(p.id, l.id)} label={l.label} provider={l.provider} className="mt-3 w-full" />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 flex items-start gap-2 rounded-xl bg-muted/60 px-3 py-2.5 text-sm text-muted-foreground dark:bg-white/[0.04]">
                <Info className="mt-0.5 size-4 shrink-0" aria-hidden /> The files for this product haven&apos;t been added yet. Check back soon.
              </p>
            )}
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">Downloads are checked against your account each time. External links open the provider&apos;s site in a new tab.</p>
          </section>

          {p.license || p.licenseTerms ? (
            <section aria-labelledby="license-heading" className={card}>
              <h2 id="license-heading" className={`${h2} flex items-center gap-2`}>
                <Scale className="size-4 text-primary dark:text-[#c4b5ff]" aria-hidden /> License
              </h2>
              {p.license ? <p className="mt-3 inline-flex rounded-full bg-muted px-3 py-1.5 text-sm font-semibold dark:bg-white/[0.06]">{p.license}</p> : null}
              {p.licenseTerms ? <p className="mt-3 text-sm leading-relaxed whitespace-pre-line text-muted-foreground">{p.licenseTerms}</p> : null}
            </section>
          ) : null}

          <Link href={LIBRARY_PATH} className={`${downloadStyles.secondary} w-full`}>
            <Library className="size-4" aria-hidden /> Back to your library
          </Link>
        </aside>
      </div>
    </div>
  );
}
