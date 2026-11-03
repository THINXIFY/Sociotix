import Link from "next/link";
import { ArrowRight, ArrowUpRight, Lightbulb, Plus, ShieldCheck } from "lucide-react";
import { HOW_RESULTS_ARE_MADE, type ToolGuide } from "@/lib/ai/guides";
import { AI_TOOL_BY_ID, type AiTool, aiToolHref, CATALOG_PLATFORM_CHOICES } from "@/lib/ai/registry";
import { cn } from "@/lib/utils";
import { LiveAvailabilityBadge } from "./live-badge";
import { ToolGlyph } from "./parts";
import { AiPlatformIcon } from "./platform-icon";
import { TryExampleButton } from "./try-example";

/*
 * The written half of every tool page, below the workspace, in a tight editorial
 * rhythm. Every word is server-rendered — but compact step cards, example cards, a scannable tips
 * grid and a quieter FAQ accordion.
 */

const h2 = "font-heading text-[1.45rem] leading-tight font-extrabold tracking-[-0.02em] text-balance sm:text-[1.75rem]";
const eyebrow = "text-[0.7rem] font-semibold tracking-[0.14em] text-primary uppercase dark:text-[#b9a8ff]";
const card = "rounded-[1.25rem] border bg-card shadow-[0_1px_2px_rgb(32_33_39/0.04)]";

/** The example's main text: the first free-text value (topic or brand). */
const exampleText = (fill: Record<string, string | string[]>) => Object.values(fill).find((v): v is string => typeof v === "string" && v.length > 12) ?? "";
const exampleSettings = (fill: Record<string, string | string[]>) =>
  [fill.businessType, fill.tone, fill.goal, fill.objective, fill.focus, fill.time, fill.days ? `${fill.days} days` : null, fill.duration ? `${fill.duration}-day plan` : null, fill.frequency ? `${fill.frequency} posts a week` : null].filter((v): v is string => typeof v === "string" && v.length > 0);
/** Platforms an example uses, as display names (single-platform tools store a name or a catalog id). */
const examplePlatforms = (fill: Record<string, string | string[]>) => (Array.isArray(fill.platforms) ? fill.platforms : typeof fill.platform === "string" ? [CATALOG_PLATFORM_CHOICES[fill.platform] ?? fill.platform] : []);

function Head({ id, kicker, title, aside }: { id: string; kicker: string; title: string; aside?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
      <div>
        <p className={eyebrow}>{kicker}</p>
        <h2 id={id} className={cn(h2, "mt-1.5")}>
          {title}
        </h2>
      </div>
      {aside}
    </div>
  );
}

export function StudioGuide({ tool, guide }: { tool: AiTool; guide: ToolGuide }) {
  const short = tool.name.replace(/^AI /, "");
  return (
    <div className="mt-14 space-y-16 sm:mt-20 sm:space-y-20">
      {/* How it works: the direct answer beside who it's for, then three compact steps */}
      <section aria-labelledby="guide-what">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-14">
          <div>
            <p className={eyebrow}>How it works</p>
            <h2 id="guide-what" className={cn(h2, "mt-1.5")}>
              {guide.whatIs.q}
            </h2>
            <p className="mt-3.5 text-[1.02rem] leading-relaxed">{guide.whatIs.a}</p>
            <p className="mt-2.5 text-[0.95rem] leading-relaxed text-muted-foreground">{guide.whatIs.more}</p>
          </div>
          <div className={cn(card, "self-start p-5 sm:p-6")}>
            <h3 className="text-sm font-semibold">Who it&apos;s for</h3>
            <ul className="mt-3 space-y-2.5">
              {guide.whoFor.map((w) => (
                <li key={w.who} className="flex gap-3 text-[0.92rem] leading-relaxed">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                  <span>
                    <span className="font-semibold">{w.who}</span> <span className="text-muted-foreground">— {w.why}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <h3 className="sr-only">How to use it</h3>
        <ol className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {guide.steps.map((s, i) => (
            <li key={s.title} className={cn(card, "relative overflow-hidden p-5")}>
              <span className="font-heading text-[2.25rem] leading-none font-extrabold text-primary/15 tabular-nums dark:text-primary/30" aria-hidden>
                {String(i + 1).padStart(2, "0")}
              </span>
              <h4 className="mt-2 font-semibold">{s.title}</h4>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Examples */}
      <section aria-labelledby="guide-examples">
        <Head id="guide-examples" kicker="Examples" title="Start from an example brief" aside={<p className="max-w-sm text-sm text-muted-foreground">“Try this example” fills the form above. Nothing is generated until you choose to.</p>} />
        <ul className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
          {guide.examples.map((ex) => {
            const platforms = examplePlatforms(ex.fill);
            const settings = exampleSettings(ex.fill);
            return (
              <li key={ex.title} className={cn(card, "group flex flex-col p-5 transition-[border-color,box-shadow] duration-200 hover:border-primary/30 hover:shadow-[0_16px_36px_-26px_rgb(112_71_235/0.5)] motion-reduce:transition-none sm:p-6")}>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-heading text-[1.05rem] font-bold">{ex.title}</h3>
                  <span className="flex items-center -space-x-1.5 text-muted-foreground">
                    {platforms.map((p) => (
                      <span key={p} title={p} className="grid size-7 place-items-center rounded-full border bg-card ring-2 ring-card">
                        <AiPlatformIcon name={p} className="size-3.5" />
                        <span className="sr-only">{p}</span>
                      </span>
                    ))}
                  </span>
                </div>
                <p className="mt-3.5 rounded-xl bg-subtle px-4 py-3 text-[0.93rem] leading-relaxed dark:bg-white/[0.03]">“{exampleText(ex.fill)}”</p>
                {settings.length ? (
                  <p className="mt-3 flex flex-wrap gap-1.5">
                    {settings.map((s) => (
                      <span key={s} className="rounded-full border px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                        {s}
                      </span>
                    ))}
                  </p>
                ) : null}
                <p className="mt-3.5 flex-1 text-sm leading-relaxed text-muted-foreground">
                  <span className="font-semibold text-foreground">What you get: </span>
                  {ex.youGet}
                </p>
                <div className="mt-4 border-t pt-4">
                  <TryExampleButton toolId={tool.id} title={ex.title} values={ex.fill} />
                </div>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">Examples describe how results are organised — they aren&apos;t generated output.</p>
      </section>

      {/* Better results: tips as a scannable grid, then options and how results are made */}
      <section aria-labelledby="guide-tips">
        <Head id="guide-tips" kicker="Better results" title="Tips from the Sociotix team" />
        <ul className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {guide.tips.map((t) => (
            <li key={t.title} className={cn(card, "flex gap-3.5 p-5")}>
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-lime/45 text-graphite dark:bg-lime/15 dark:text-lime" aria-hidden>
                <Lightbulb className="size-4" />
              </span>
              <div className="min-w-0">
                <h3 className="font-semibold">{t.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t.body}</p>
                {t.example ? <p className="mt-2.5 border-l-2 border-primary/30 pl-3 text-sm leading-relaxed">{t.example}</p> : null}
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className={cn(card, "p-5 sm:p-6")}>
            <h3 className="font-heading font-bold">What you can customise</h3>
            <dl className="mt-3 divide-y">
              {guide.options.map((o) => (
                <div key={o.name} className="grid grid-cols-1 gap-0.5 py-2.5 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-4">
                  <dt className="text-sm font-semibold">{o.name}</dt>
                  <dd className="text-sm leading-relaxed text-muted-foreground">{o.detail}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div id="how-results" className="scroll-mt-24 rounded-[1.25rem] border bg-subtle/60 p-5 sm:p-6 dark:bg-white/[0.02]">
            <h3 className="flex items-center gap-2 font-heading font-bold">
              <ShieldCheck className="size-4.5 text-primary" aria-hidden /> How results are made
            </h3>
            <ul className="mt-2.5 space-y-1.5 text-sm leading-relaxed text-muted-foreground">
              {HOW_RESULTS_ARE_MADE.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <h4 className="mt-4 text-sm font-semibold">Limits to keep in mind</h4>
            <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-muted-foreground marker:text-primary/60">
              {tool.limits.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section aria-labelledby="guide-faq" className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] lg:gap-14">
        <div>
          <p className={eyebrow}>Questions</p>
          <h2 id="guide-faq" className={cn(h2, "mt-1.5")}>
            {`${short} questions`}
          </h2>
          <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
            Short answers to what people ask most. More about Sociotix AI on the{" "}
            <Link href="/ai-tools#faq" className="font-semibold text-primary hover:underline">
              AI tools page
            </Link>
            .
          </p>
        </div>
        <div className="space-y-2">
          {guide.faqs.map((f, i) => (
            <details key={f.q} name={`faq-${tool.id}`} open={i === 0} className="group rounded-2xl border bg-card transition-colors open:border-primary/25 open:bg-primary/[0.025] dark:open:bg-primary/[0.06]">
              <summary className="flex min-h-14 cursor-pointer list-none items-center gap-4 rounded-2xl px-5 py-3.5 outline-none focus-visible:ring-3 focus-visible:ring-primary/30 [&::-webkit-details-marker]:hidden">
                <h3 className="flex-1 text-[0.97rem] font-semibold">{f.q}</h3>
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground transition-[transform,background-color,color] duration-200 group-open:rotate-45 group-open:bg-primary group-open:text-primary-foreground motion-reduce:transition-none" aria-hidden>
                  <Plus className="size-3.5" />
                </span>
              </summary>
              <p className="max-w-2xl px-5 pr-14 pb-4.5 text-[0.93rem] leading-relaxed text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}

/** Related tools, compact: next steps first (with why), then the rest of the family. Badges show real availability. */
export function StudioRelated({ tool, guide, others }: { tool: AiTool; guide?: ToolGuide; others: AiTool[] }) {
  const pairs = (guide?.next ?? []).map((n) => ({
    tool: AI_TOOL_BY_ID[n.toolId],
    why: n.text,
  }));
  const rest = others.filter((t) => !pairs.some((p) => p.tool.id === t.id)).map((t) => ({ tool: t, why: t.tagline }));
  const items = [...pairs, ...rest];
  if (!items.length) return null;
  return (
    <section aria-labelledby="related-title" className="mt-16 sm:mt-20">
      <Head
        id="related-title"
        kicker="Keep going"
        title={pairs.length ? `Pairs well with the ${tool.name.replace(/^AI /, "")}` : "Related tools"}
        aside={
          <Link href="/ai-tools#tools" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary hover:underline sm:min-h-0">
            All 13 tools <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        }
      />
      <ul className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
        {items.slice(0, 3).map(({ tool: t, why }) => (
          <li key={t.id}>
            <Link
              href={aiToolHref(t)}
              className="group flex h-full items-start gap-3.5 rounded-[1.25rem] border bg-card p-4 transition-[border-color,box-shadow,translate] duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[0_16px_36px_-26px_rgb(112_71_235/0.55)] focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              <ToolGlyph tool={t} size="sm" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-center justify-between gap-2">
                  <span className="font-heading font-bold">{t.name}</span>
                  <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-[color,translate] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary motion-reduce:transition-none" aria-hidden />
                </span>
                <span className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{why}</span>
                <span className="mt-2.5">
                  <LiveAvailabilityBadge tool={t} />
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
