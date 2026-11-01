import Link from "next/link";
import { ArrowUpRight, Clock3 } from "lucide-react";
import { type ArticleCard, type BlogArticle, formatDate } from "@/lib/blog";
import { cn } from "@/lib/utils";

/*
 * Original, on-brand cover artwork generated in SVG (no stock imagery). Each article picks a tone
 * and motif; the art scales to any frame and works in light and dark themes.
 */

const TONES = {
  violet: { bg: "#7047EB", fg: "#FFFFFF", accent: "#C8FF52", soft: "rgba(255,255,255,0.16)" },
  graphite: { bg: "#202127", fg: "#9277F4", accent: "#C8FF52", soft: "rgba(255,255,255,0.08)" },
  lime: { bg: "#C8FF52", fg: "#7047EB", accent: "#202127", soft: "rgba(32,33,39,0.1)" },
} as const;

export function Cover({ cover, alt, className }: { cover: BlogArticle["cover"]; alt: string; className?: string }) {
  const t = TONES[cover.tone];
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" role="img" aria-label={alt} className={cn("block size-full", className)}>
      <rect width="400" height="300" fill={t.bg} />
      <circle cx="330" cy="40" r="140" fill={t.soft} />
      {cover.motif === "orbit" ? (
        <g fill="none" strokeWidth="1.5">
          {[50, 85, 120].map((r) => (
            <circle key={r} cx="200" cy="155" r={r} stroke={t.fg} strokeOpacity={0.35} strokeDasharray={r === 85 ? "4 7" : undefined} />
          ))}
          <circle cx="200" cy="155" r="22" fill={t.fg} />
          <circle cx="285" cy="95" r="9" fill={t.accent} stroke="none" />
          <circle cx="120" cy="215" r="6" fill={t.fg} stroke="none" fillOpacity={0.8} />
        </g>
      ) : null}
      {cover.motif === "waves" ? (
        <g fill="none" strokeLinecap="round">
          {[0, 1, 2, 3, 4].map((i) => (
            <path key={i} d={`M-10 ${110 + i * 26} C 90 ${70 + i * 26}, 170 ${170 + i * 26}, 260 ${120 + i * 26} S 380 ${90 + i * 26}, 420 ${120 + i * 26}`} stroke={i === 2 ? t.accent : t.fg} strokeOpacity={i === 2 ? 1 : 0.45} strokeWidth={i === 2 ? 4 : 2} />
          ))}
        </g>
      ) : null}
      {cover.motif === "grid" ? (
        <g>
          {Array.from({ length: 4 }, (_, row) =>
            Array.from({ length: 7 }, (_, col) => {
              const on = (row * 7 + col) % 5 === 1 || (row === 2 && col === 4);
              return <rect key={`${row}-${col}`} x={52 + col * 44} y={60 + row * 46} width="34" height="34" rx="9" fill={row === 2 && col === 4 ? t.accent : on ? t.fg : t.soft} fillOpacity={on || (row === 2 && col === 4) ? 1 : 1} />;
            }),
          )}
        </g>
      ) : null}
      {cover.motif === "bars" ? (
        <g>
          {[70, 120, 95, 160, 135, 190].map((h, i) => (
            <rect key={i} x={70 + i * 46} y={250 - h} width="30" height={h} rx="8" fill={i === 5 ? t.accent : t.fg} fillOpacity={i === 5 ? 1 : 0.55} />
          ))}
        </g>
      ) : null}
    </svg>
  );
}

export function ArticleMeta({ date, minutes, draft, className }: { date: string | null; minutes: number; draft: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8rem] text-muted-foreground", className)}>
      {draft || !date ? <span className="rounded-full bg-amber-500/12 px-2 py-0.5 text-[0.7rem] font-semibold text-amber-700 dark:text-amber-300">Draft</span> : <time dateTime={date}>{formatDate(date)}</time>}
      <span aria-hidden>·</span>
      <span className="inline-flex items-center gap-1">
        <Clock3 className="size-3.5" aria-hidden /> {minutes} min read
      </span>
    </span>
  );
}

/** Editorial article card: cover, category, title, description, meta. `wide` lays it out side by side. */
export function ArticleCardView({ card, wide = false, headingLevel = "h3" }: { card: ArticleCard; wide?: boolean; headingLevel?: "h2" | "h3" }) {
  const H = headingLevel;
  return (
    <article className={cn("group relative flex h-full flex-col overflow-hidden rounded-[1.6rem] border bg-card transition-[border-color,box-shadow] duration-300 has-[a:focus-visible]:ring-3 has-[a:focus-visible]:ring-primary/40 hover:border-primary/25 hover:shadow-[0_30px_60px_-36px_rgb(112_71_235/0.5)] dark:bg-white/[0.03]", wide && "md:grid md:grid-cols-[1.1fr_1fr]")}>
      <div className={cn("relative overflow-hidden", wide ? "aspect-[16/10] md:aspect-auto md:min-h-full" : "aspect-[16/10]")}>
        <div className="size-full transition-transform duration-500 ease-out group-hover:scale-[1.04] motion-reduce:transition-none">
          {card.image ? (
            // eslint-disable-next-line @next/next/no-img-element -- uploaded images are served from this origin with their real dimensions
            <img src={card.image.src} alt={card.image.alt} width={card.image.width} height={card.image.height} loading="lazy" decoding="async" className="size-full object-cover" />
          ) : (
            <Cover cover={card.cover} alt={card.coverAlt} />
          )}
        </div>
      </div>
      <div className={cn("flex flex-1 flex-col p-5 sm:p-6", wide && "md:justify-center md:p-8")}>
        <p className="text-[0.7rem] font-semibold tracking-[0.14em] text-primary uppercase dark:text-[#b9a6ff]">{card.categoryName}</p>
        <H className={cn("mt-2 font-heading leading-snug font-extrabold tracking-[-0.02em] text-balance", wide ? "text-[1.5rem] sm:text-[1.75rem]" : "text-[1.15rem]")}>
          <Link href={`/blog/${card.slug}`} className="outline-none after:absolute after:inset-0 after:content-['']">
            {card.title}
          </Link>
        </H>
        <p className={cn("mt-2 text-muted-foreground", wide ? "text-[1rem] leading-relaxed" : "line-clamp-3 text-[0.9rem] leading-relaxed")}>{card.description}</p>
        <div className="mt-auto flex items-center justify-between gap-3 pt-5">
          <ArticleMeta date={card.date} minutes={card.minutes} draft={card.draft} />
          <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-[transform,color] duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary motion-reduce:transition-none" aria-hidden />
        </div>
      </div>
    </article>
  );
}
