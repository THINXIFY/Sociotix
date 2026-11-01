import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import { BlogListing } from "@/components/blog/listing";
import { type BlogArticle, isPublished, toCard } from "@/lib/blog";

/*
 * The blog listing page: compact hero (search) → category cards → featured → latest → simple CTA.
 * With no published articles (production), an honest empty state replaces the grids.
 */

export const BLOG_TITLE = "Sociotix Blog — Social Media, AI & Growth Insights";
export const BLOG_DESCRIPTION = "Practical guides and ideas on social media, AI marketing, content planning, automation and growth from the Sociotix team.";

const wrap = "mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8";

function Cta() {
  return (
    <section className={`${wrap} pb-16 sm:pb-20`} aria-labelledby="blog-cta-title">
      <div className="flex flex-col items-start justify-between gap-6 rounded-2xl border bg-card p-6 sm:flex-row sm:items-center sm:p-8 dark:bg-white/[0.03]">
        <div>
          <h2 id="blog-cta-title" className="font-heading text-[1.4rem] font-extrabold tracking-[-0.02em]">
            Ready to put it into practice?
          </h2>
          <p className="mt-1 text-muted-foreground">Compare social media services with clear details and plan your content in one place.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/#services" className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-[0_12px_28px_-14px_rgb(112_71_235/0.9)] transition-colors hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-primary/35 focus-visible:outline-none">
            Browse services <ArrowRight className="size-4" aria-hidden />
          </Link>
          <Link href="/help" className="inline-flex h-11 items-center rounded-full border px-5 text-sm font-semibold transition-colors hover:border-primary/35 hover:text-primary focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none">
            Help Center
          </Link>
        </div>
      </div>
    </section>
  );
}

function EmptyState() {
  return (
    <section className="relative isolate overflow-hidden" aria-labelledby="blog-title">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(70%_90%_at_50%_0%,rgb(112_71_235/0.14),transparent_70%)] dark:bg-[radial-gradient(70%_90%_at_50%_0%,rgb(112_71_235/0.3),transparent_70%)]" aria-hidden />
      <div className={`${wrap} py-16 text-center sm:py-24`}>
        <p className="text-[0.72rem] font-semibold tracking-[0.14em] text-primary uppercase dark:text-[#b9a6ff]">Sociotix Blog</p>
        <h1 id="blog-title" className="mx-auto mt-5 max-w-3xl font-heading text-[2.4rem] leading-[1.05] font-extrabold tracking-[-0.045em] text-balance sm:text-[3.4rem]">
          Insights That <span className="text-[#7047EB] dark:text-[#9277F4]">Inspire Growth.</span>
        </h1>
        <div className="mx-auto mt-10 max-w-lg rounded-2xl border border-dashed bg-card/60 p-8 dark:bg-white/[0.02]">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/[0.09] text-primary dark:bg-primary/20 dark:text-[#b9a6ff]">
            <BookOpen className="size-6" aria-hidden />
          </span>
          <h2 className="mt-5 font-heading text-[1.4rem] font-extrabold tracking-[-0.02em]">Our first articles are being written.</h2>
          <p className="mt-2 text-muted-foreground">We publish only when a piece is genuinely useful. Until then, the Help Center answers the most common questions.</p>
          <Link href="/help" className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-primary/35 focus-visible:outline-none">
            Visit the Help Center <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}

export function BlogHome({ articles }: { articles: BlogArticle[] }) {
  if (!articles.length) return <EmptyState />;
  return (
    <>
      <BlogListing cards={articles.map(toCard)} preview={articles.some((a) => !isPublished(a))} />
      <Cta />
    </>
  );
}
