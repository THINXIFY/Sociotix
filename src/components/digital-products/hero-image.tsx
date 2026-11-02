"use client";

import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

/*
 * Hero visual: the Sociotix marketplace illustration (transparent WebP, 1338 × 837). Three lightweight motions,
 * all transform-only: a slow float, mouse-follow parallax with a slight tilt (mouse pointers only), and a gentle
 * lift on hover. Reduced motion switches the float and the parallax off. Width and height reserve the space,
 * so nothing shifts while the image loads.
 */

const SRC = "/digital products page media/Sociotix Digital Marketplace Laptop hero.webp";
const ALT = "Illustration of the Sociotix digital marketplace on a laptop, surrounded by floating tiles for an AI toolkit, templates, prompt packs and a content planner.";

export function HeroImage({ className }: { className?: string }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const frame = React.useRef(0);

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el || e.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = el.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width - 0.5) * 2;
    const y = ((e.clientY - r.top) / r.height - 0.5) * 2;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      el.style.setProperty("--px", x.toFixed(3));
      el.style.setProperty("--py", y.toFixed(3));
    });
  };
  const onLeave = () => {
    cancelAnimationFrame(frame.current);
    ref.current?.style.setProperty("--px", "0");
    ref.current?.style.setProperty("--py", "0");
  };

  return (
    <div ref={ref} onPointerMove={onMove} onPointerLeave={onLeave} className={cn("relative mx-auto w-full max-w-[34rem] [perspective:1200px] lg:max-w-none", className)}>
      <div className="pointer-events-none absolute inset-[10%] rounded-full bg-[radial-gradient(closest-side,rgb(112_71_235/0.22),transparent)] dark:bg-[radial-gradient(closest-side,rgb(112_71_235/0.42),transparent)]" aria-hidden />
      <div className="ai-float motion-reduce:animate-none">
        <div
          className="will-change-transform"
          style={{
            translate: "calc(var(--px, 0) * 14px) calc(var(--py, 0) * 10px)",
            transform: "rotateX(calc(var(--py, 0) * -3deg)) rotateY(calc(var(--px, 0) * 4deg))",
            transition: "translate 600ms cubic-bezier(0.22, 1, 0.36, 1), transform 600ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          <Image src={SRC} alt={ALT} width={1338} height={837} priority sizes="(min-width: 1024px) 46vw, 92vw" className="relative h-auto w-full select-none transition-[scale] duration-500 ease-out hover:scale-[1.025] motion-reduce:transition-none motion-reduce:hover:scale-100" draggable={false} />
        </div>
      </div>
    </div>
  );
}
