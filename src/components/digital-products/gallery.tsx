"use client";

import * as React from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Expand } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { CoverTone, DigitalProduct } from "@/lib/digital-products";
import { cn } from "@/lib/utils";
import { ProductCover } from "./cover";

/*
 * Product gallery: a large stage that crossfades between slides and zooms gently on hover (click opens the
 * lightbox), clickable thumbnails, and a full-screen lightbox with arrow-key controls. Released products show
 * their own images; products without images show their cover artwork in the three brand colourways, labelled as
 * illustrative, so nothing pretends to be a real product screenshot.
 */

type Slide = { key: string; label: string; image?: NonNullable<DigitalProduct["images"]>[number]; tone?: CoverTone };

function slidesFor(p: DigitalProduct): Slide[] {
  if (p.images?.length) return p.images.map((image, i) => ({ key: `img-${i}`, label: image.alt, image }));
  const tones: CoverTone[] = [p.tone, ...(["violet", "graphite", "lime"] as const).filter((t) => t !== p.tone)];
  return tones.map((tone) => ({ key: tone, label: `${p.title} cover artwork, ${tone} colourway`, tone }));
}

function SlideView({ product, slide, sizes, priority }: { product: DigitalProduct; slide: Slide; sizes: string; priority?: boolean }) {
  if (slide.image) return <Image src={slide.image.src} alt={slide.image.alt} width={slide.image.width} height={slide.image.height} sizes={sizes} priority={priority} className="h-full w-full object-contain" />;
  return (
    <div role="img" aria-label={slide.label} className="h-full w-full">
      <ProductCover category={product.category} tone={slide.tone!} className="h-full w-full" fit="meet" art="" />
    </div>
  );
}

/** All slides stacked; only the current one is visible, so changing slides is a smooth crossfade. */
function Stage({ product, slides, index, sizes, zoom = false }: { product: DigitalProduct; slides: Slide[]; index: number; sizes: string; zoom?: boolean }) {
  return (
    <div className="relative h-full w-full">
      {slides.map((s, i) => (
        <div key={s.key} aria-hidden={i !== index} className={cn("absolute inset-0 transition-opacity duration-500 ease-out motion-reduce:transition-none", i === index ? "opacity-100" : "pointer-events-none opacity-0")}>
          <div className={cn("h-full w-full", zoom && "transition-transform duration-700 ease-out group-hover/stage:scale-[1.045] motion-reduce:transition-none motion-reduce:group-hover/stage:scale-100")}>
            <SlideView product={product} slide={s} sizes={sizes} priority={i === 0} />
          </div>
        </div>
      ))}
    </div>
  );
}

const glass = "border border-white/60 bg-white/85 shadow-sm backdrop-blur transition-[opacity,background-color] duration-200 hover:bg-white focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none dark:border-white/10 dark:bg-[#17181d]/85 dark:hover:bg-[#17181d]";

function Thumbs({ product, slides, index, onPick, label }: { product: DigitalProduct; slides: Slide[]; index: number; onPick: (i: number) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex gap-2.5">
      {slides.map((s, i) => (
        <button
          key={s.key}
          type="button"
          onClick={() => onPick(i)}
          aria-label={`Show image ${i + 1} of ${slides.length}`}
          aria-current={i === index ? "true" : undefined}
          className={cn("w-24 shrink-0 overflow-hidden rounded-xl ring-2 ring-offset-2 ring-offset-background transition-[box-shadow,opacity,transform] duration-200 outline-none focus-visible:ring-primary/60 sm:w-28", i === index ? "ring-primary" : "opacity-65 ring-transparent hover:-translate-y-0.5 hover:opacity-100 motion-reduce:hover:translate-y-0")}
        >
          <div className="pointer-events-none aspect-[16/10]">
            <SlideView product={product} slide={s} sizes="112px" />
          </div>
        </button>
      ))}
    </div>
  );
}

export function ProductGallery({ product }: { product: DigitalProduct }) {
  const slides = slidesFor(product);
  const [index, setIndex] = React.useState(0);
  const [full, setFull] = React.useState(false);
  const go = (d: number) => setIndex((i) => (i + d + slides.length) % slides.length);
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    go(e.key === "ArrowRight" ? 1 : -1);
  };
  const many = slides.length > 1;

  return (
    <section aria-label="Product gallery" aria-roledescription="carousel" onKeyDown={onKey}>
      <div className="group/stage relative overflow-hidden rounded-[1.75rem] bg-card ring-1 ring-black/[0.06] shadow-[0_40px_80px_-50px_rgb(112_71_235/0.55)] dark:bg-white/[0.03] dark:ring-white/10">
        <div className="aspect-[16/10]">
          <Stage product={product} slides={slides} index={index} sizes="(min-width: 1024px) 58vw, 100vw" zoom />
        </div>
        {/* The stage itself opens the lightbox; controls sit above it. */}
        <button type="button" onClick={() => setFull(true)} className="absolute inset-0 cursor-zoom-in outline-none focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:ring-inset" aria-label={`Open ${slides[index].label} full screen`} />
        {many ? (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="Previous image" className={cn(glass, "absolute top-1/2 left-3 grid size-10 -translate-y-1/2 place-items-center rounded-full sm:opacity-0 sm:group-hover/stage:opacity-100 sm:focus-visible:opacity-100")}>
              <ChevronLeft className="size-5" aria-hidden />
            </button>
            <button type="button" onClick={() => go(1)} aria-label="Next image" className={cn(glass, "absolute top-1/2 right-3 grid size-10 -translate-y-1/2 place-items-center rounded-full sm:opacity-0 sm:group-hover/stage:opacity-100 sm:focus-visible:opacity-100")}>
              <ChevronRight className="size-5" aria-hidden />
            </button>
          </>
        ) : null}
        <span className={cn(glass, "pointer-events-none absolute bottom-3 left-3 rounded-full px-2.5 py-1 text-[0.72rem] font-semibold text-muted-foreground tabular-nums")} aria-live="polite">
          {index + 1} / {slides.length}
        </span>
        <button type="button" onClick={() => setFull(true)} className={cn(glass, "absolute right-3 bottom-3 inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[0.8rem] font-semibold")}>
          <Expand className="size-3.5" aria-hidden /> Full screen
        </button>
      </div>

      {many ? (
        <div className="-mx-1 mt-4 overflow-x-auto px-1 pt-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Thumbs product={product} slides={slides} index={index} onPick={setIndex} label="Choose an image" />
        </div>
      ) : null}
      {!product.images?.length ? <p className="mt-2 text-xs text-muted-foreground">{product.source === "admin" ? "Illustrative cover artwork." : "Illustrative cover artwork. Product previews will appear here when this product is released."}</p> : null}

      <Dialog open={full} onOpenChange={setFull}>
        <DialogContent className="w-[min(76rem,calc(100vw-2rem))] max-w-none gap-4 bg-background/95 p-3 backdrop-blur sm:max-w-none sm:p-4" onKeyDown={onKey}>
          <DialogTitle className="sr-only">
            {product.title}: image {index + 1} of {slides.length}
          </DialogTitle>
          <DialogDescription className="sr-only">{slides[index].label}. Use the arrow keys to move between images.</DialogDescription>
          <div className="relative overflow-hidden rounded-2xl">
            <div className="mx-auto aspect-[16/10] max-h-[74dvh] w-full">
              <Stage product={product} slides={slides} index={index} sizes="92vw" />
            </div>
            {many ? (
              <>
                <button type="button" onClick={() => go(-1)} aria-label="Previous image" className={cn(glass, "absolute top-1/2 left-3 grid size-11 -translate-y-1/2 place-items-center rounded-full")}>
                  <ChevronLeft className="size-5" aria-hidden />
                </button>
                <button type="button" onClick={() => go(1)} aria-label="Next image" className={cn(glass, "absolute top-1/2 right-3 grid size-11 -translate-y-1/2 place-items-center rounded-full")}>
                  <ChevronRight className="size-5" aria-hidden />
                </button>
              </>
            ) : null}
          </div>
          {many ? (
            <div className="flex justify-center overflow-x-auto">
              <Thumbs product={product} slides={slides} index={index} onPick={setIndex} label="Choose an image (full screen)" />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
