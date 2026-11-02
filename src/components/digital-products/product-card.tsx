import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { type DigitalProduct, priceLabel, productCategoryName, productHref } from "@/lib/digital-products";
import { cn } from "@/lib/utils";
import { ProductCover } from "./cover";

/* A product card for the marketplace and Related Products. The whole card links to the product's page. */

export function ProductCard({ product, preview, headingLevel = "h3" }: { product: DigitalProduct; preview: boolean; headingLevel?: "h2" | "h3" }) {
  const H = headingLevel;
  const image = product.images?.[0];
  const soon = preview || product.availability === "coming_soon";
  return (
    <article className="group relative flex h-full flex-col rounded-[1.4rem] border bg-card p-2 transition-[transform,border-color,box-shadow] duration-300 has-[a:focus-visible]:ring-3 has-[a:focus-visible]:ring-primary/40 hover:-translate-y-1 hover:border-primary/30 hover:shadow-[0_28px_56px_-32px_rgb(112_71_235/0.5)] motion-reduce:transition-none motion-reduce:hover:translate-y-0 dark:bg-white/[0.03]">
      <div className="relative overflow-hidden rounded-[1.05rem]">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- uploaded images are served from this origin with their real dimensions
          <img src={image.src} alt="" width={image.width} height={image.height} loading="lazy" decoding="async" className="aspect-[16/10] w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100" />
        ) : (
          <ProductCover category={product.category} tone={product.tone} className="aspect-[16/10]" />
        )}
        {soon ? <span className="absolute top-2.5 left-2.5 rounded-full bg-white/90 px-2.5 py-1 text-[0.68rem] font-semibold text-muted-foreground shadow-sm backdrop-blur dark:bg-[#17181d]/90">Coming soon</span> : null}
      </div>
      <div className="flex flex-1 flex-col px-3.5 pt-4 pb-3">
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 truncate text-[0.74rem] font-semibold text-primary dark:text-[#b9a6ff]">{productCategoryName(product)}</p>
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[0.68rem] font-semibold text-muted-foreground dark:bg-white/[0.07]">{product.type}</span>
        </div>
        <H className="mt-2 line-clamp-2 font-heading text-[1.12rem] leading-snug font-extrabold tracking-[-0.02em] text-balance">{product.title}</H>
        <p className="mt-1.5 mb-5 line-clamp-2 text-[0.9rem] leading-relaxed text-muted-foreground">{product.description}</p>
        <div className="mt-auto flex items-center justify-between gap-3 border-t pt-3.5">
          <span className={cn("text-[0.85rem] font-semibold", product.price.kind === "unset" ? "text-muted-foreground" : "text-foreground")}>{priceLabel(product.price)}</span>
          <Link href={productHref(product)} aria-label={`View details: ${product.title}`} className="inline-flex items-center gap-2 rounded-full text-[0.85rem] font-semibold text-foreground outline-none transition-colors after:absolute after:inset-0 after:content-[''] group-hover:text-primary dark:group-hover:text-[#b9a6ff]">
            View details
            <span className="grid size-7 place-items-center rounded-full bg-primary/[0.09] text-primary transition-[background-color,color,transform] duration-200 group-hover:translate-x-0.5 group-hover:bg-primary group-hover:text-primary-foreground motion-reduce:transition-none motion-reduce:group-hover:translate-x-0 dark:bg-primary/20 dark:text-[#b9a6ff]">
              <ArrowRight className="size-3.5" aria-hidden />
            </span>
          </Link>
        </div>
      </div>
    </article>
  );
}

export function ProductGrid({ products, label, preview }: { products: DigitalProduct[]; label: string; preview: boolean }) {
  return (
    <ul aria-label={label} className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((p) => (
        <li key={p.id}>
          <ProductCard product={p} preview={preview} />
        </li>
      ))}
    </ul>
  );
}
