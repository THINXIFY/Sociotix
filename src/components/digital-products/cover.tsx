import { type CategoryId, type CoverTone, type DigitalCategoryId } from "@/lib/digital-products";
import { cn } from "@/lib/utils";

/*
 * Branded cover artwork for the Digital Products Marketplace. No approved product imagery exists yet, so each
 * category gets its own illustration, drawn in SVG from the brand palette. Colours come from CSS variables set by
 * the tone, so every cover follows light and dark themes. Purely decorative: always aria-hidden.
 */

export const TONE_CLASS: Record<CoverTone, string> = {
  violet: "[--bg1:#f3efff] [--bg2:#d9ccff] [--surf:#ffffff] [--acc:#7047EB] [--ink:#202127] [--soft:#b9a6ff] dark:[--bg1:#2c2354] dark:[--bg2:#171332] dark:[--surf:#2f2766] dark:[--acc:#9277F4] dark:[--ink:#f1f2f6] dark:[--soft:#4a3d93]",
  graphite: "[--bg1:#eef0f6] [--bg2:#d3d8e6] [--surf:#ffffff] [--acc:#202127] [--ink:#202127] [--soft:#aeb4c6] dark:[--bg1:#2a2b34] dark:[--bg2:#15161b] dark:[--surf:#33343f] dark:[--acc:#f1f2f6] dark:[--ink:#f1f2f6] dark:[--soft:#4a4c5a]",
  lime: "[--bg1:#f8ffe0] [--bg2:#dcf78a] [--surf:#ffffff] [--acc:#202127] [--ink:#202127] [--soft:#b4d95a] dark:[--bg1:#2b3719] dark:[--bg2:#151b0e] dark:[--surf:#34421f] dark:[--acc:#C8FF52] dark:[--ink:#f1f2f6] dark:[--soft:#566f26]",
};

/** Illustrations on a 320 × 200 canvas. Shapes use --surf (paper), --acc (accent), --ink (text) and --soft (muted). */
const ART: Record<DigitalCategoryId, React.ReactNode> = {
  "social-templates": (
    <>
      <rect x="62" y="36" width="104" height="132" rx="14" className="fill-(--soft)" transform="rotate(-8 114 102)" />
      <rect x="154" y="30" width="104" height="132" rx="14" className="fill-(--soft)" transform="rotate(7 206 96)" />
      <rect x="108" y="26" width="104" height="148" rx="14" className="fill-(--surf)" />
      <rect x="122" y="42" width="52" height="8" rx="4" className="fill-(--acc)" />
      <rect x="122" y="58" width="76" height="6" rx="3" className="fill-(--soft)" />
      <circle cx="160" cy="112" r="26" className="fill-(--acc)" />
      <path d="M150 112l8 8 14-16" fill="none" stroke="var(--surf)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="122" y="148" width="76" height="6" rx="3" className="fill-(--soft)" />
      <circle cx="262" cy="38" r="8" className="fill-lime" />
    </>
  ),
  "ai-prompts": (
    <>
      <rect x="40" y="36" width="170" height="52" rx="14" className="fill-(--surf)" />
      <rect x="56" y="52" width="110" height="7" rx="3.5" className="fill-(--ink)" opacity=".75" />
      <rect x="56" y="68" width="76" height="7" rx="3.5" className="fill-(--soft)" />
      <rect x="110" y="104" width="170" height="60" rx="14" className="fill-(--acc)" />
      <rect x="126" y="120" width="120" height="7" rx="3.5" className="fill-(--surf)" opacity=".9" />
      <rect x="126" y="136" width="84" height="7" rx="3.5" className="fill-(--surf)" opacity=".55" />
      <rect x="252" y="140" width="6" height="14" rx="2" className="fill-lime" />
      <path d="M262 22l4 10 10 4-10 4-4 10-4-10-10-4 10-4z" className="fill-lime" />
    </>
  ),
  "web-templates": (
    <>
      <rect x="40" y="28" width="240" height="152" rx="14" className="fill-(--surf)" />
      <path d="M40 42a14 14 0 0 1 14-14h212a14 14 0 0 1 14 14v10H40z" className="fill-(--soft)" />
      <circle cx="56" cy="40" r="3.5" className="fill-(--surf)" />
      <circle cx="68" cy="40" r="3.5" className="fill-(--surf)" />
      <circle cx="80" cy="40" r="3.5" className="fill-(--surf)" />
      <rect x="58" y="66" width="104" height="10" rx="5" className="fill-(--ink)" opacity=".8" />
      <rect x="58" y="84" width="76" height="7" rx="3.5" className="fill-(--soft)" />
      <rect x="58" y="102" width="52" height="18" rx="9" className="fill-(--acc)" />
      <rect x="182" y="64" width="80" height="56" rx="10" className="fill-(--acc)" opacity=".9" />
      <rect x="58" y="134" width="64" height="32" rx="8" className="fill-(--soft)" />
      <rect x="130" y="134" width="64" height="32" rx="8" className="fill-(--soft)" />
      <rect x="202" y="134" width="60" height="32" rx="8" className="fill-(--soft)" />
    </>
  ),
  branding: (
    <>
      <rect x="40" y="34" width="120" height="132" rx="16" className="fill-(--surf)" />
      <text x="62" y="108" fontSize="54" fontWeight="800" className="fill-(--ink)" style={{ fontFamily: "var(--font-heading)" }}>
        Aa
      </text>
      <rect x="62" y="124" width="76" height="6" rx="3" className="fill-(--soft)" />
      <rect x="62" y="138" width="50" height="6" rx="3" className="fill-(--soft)" />
      <circle cx="206" cy="66" r="30" className="fill-(--acc)" />
      <circle cx="246" cy="96" r="24" className="fill-lime" />
      <circle cx="206" cy="132" r="28" className="fill-(--soft)" />
      <rect x="236" y="134" width="30" height="30" rx="9" className="fill-(--surf)" />
    </>
  ),
  ebooks: (
    <>
      <rect x="168" y="42" width="84" height="120" rx="8" className="fill-(--soft)" transform="rotate(8 210 102)" />
      <rect x="82" y="30" width="96" height="140" rx="8" className="fill-(--acc)" />
      <rect x="82" y="30" width="10" height="140" rx="4" className="fill-black/20" />
      <rect x="104" y="52" width="58" height="9" rx="4.5" className="fill-(--surf)" />
      <rect x="104" y="68" width="40" height="9" rx="4.5" className="fill-(--surf)" opacity=".7" />
      <circle cx="133" cy="128" r="16" className="fill-lime" />
      <path d="M126 128l5 5 9-10" fill="none" stroke="#202127" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="196" y="66" width="44" height="6" rx="3" className="fill-(--surf)" opacity=".8" transform="rotate(8 210 102)" />
      <rect x="196" y="80" width="30" height="6" rx="3" className="fill-(--surf)" opacity=".5" transform="rotate(8 210 102)" />
    </>
  ),
  planners: (
    <>
      <rect x="50" y="26" width="220" height="152" rx="16" className="fill-(--surf)" />
      <rect x="50" y="26" width="220" height="34" rx="16" className="fill-(--acc)" />
      <rect x="50" y="44" width="220" height="16" className="fill-(--acc)" />
      <rect x="76" y="38" width="64" height="8" rx="4" className="fill-(--surf)" />
      {Array.from({ length: 20 }, (_, i) => {
        const x = 72 + (i % 7) * 30;
        const y = 76 + Math.floor(i / 7) * 32;
        const mark = i === 4 || i === 9 || i === 15;
        return <rect key={i} x={x} y={y} width="22" height="22" rx="7" className={mark ? "fill-lime" : "fill-(--soft)"} opacity={mark ? 1 : 0.55} />;
      })}
    </>
  ),
  "ai-agents": (
    <>
      <rect x="62" y="48" width="92" height="84" rx="24" className="fill-(--acc)" />
      <circle cx="90" cy="86" r="9" className="fill-(--surf)" />
      <circle cx="126" cy="86" r="9" className="fill-(--surf)" />
      <circle cx="90" cy="86" r="4" className="fill-(--ink)" />
      <circle cx="126" cy="86" r="4" className="fill-(--ink)" />
      <rect x="92" y="108" width="32" height="6" rx="3" className="fill-(--surf)" opacity=".7" />
      <rect x="104" y="30" width="6" height="18" rx="3" className="fill-(--acc)" />
      <circle cx="107" cy="28" r="7" className="fill-lime" />
      <rect x="160" y="64" width="112" height="44" rx="14" className="fill-(--surf)" />
      <rect x="176" y="78" width="70" height="6" rx="3" className="fill-(--ink)" opacity=".7" />
      <rect x="176" y="92" width="48" height="6" rx="3" className="fill-(--soft)" />
      <rect x="196" y="118" width="76" height="34" rx="12" className="fill-(--soft)" />
    </>
  ),
  "creative-toolkits": (
    <>
      <rect x="58" y="42" width="136" height="104" rx="14" className="fill-(--surf)" />
      <circle cx="88" cy="72" r="11" className="fill-lime" />
      <path d="M58 132l42-44 30 30 22-20 42 40v8a14 14 0 0 1-14 14H72a14 14 0 0 1-14-14z" className="fill-(--acc)" opacity=".9" />
      <path d="M236 36l7 18 18 7-18 7-7 18-7-18-18-7 18-7z" className="fill-(--acc)" />
      <path d="M262 112l4.5 11.5 11.5 4.5-11.5 4.5-4.5 11.5-4.5-11.5-11.5-4.5 11.5-4.5z" className="fill-lime" />
      <circle cx="230" cy="150" r="7" className="fill-(--soft)" />
      <circle cx="210" cy="164" r="5" className="fill-(--soft)" />
    </>
  ),
};

export function ProductCover({ category, tone, className, fit = "slice", art = "group-hover:scale-[1.05] motion-reduce:group-hover:scale-100" }: { category: CategoryId; tone: CoverTone; className?: string; fit?: "slice" | "meet"; art?: string }) {
  return (
    <div className={cn("relative isolate overflow-hidden bg-[linear-gradient(140deg,var(--bg1),var(--bg2))]", TONE_CLASS[tone], className)} aria-hidden>
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgb(112_71_235/0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgb(112_71_235/0.08)_1px,transparent_1px)] bg-size-[24px_24px] mask-[radial-gradient(80%_90%_at_50%_50%,black,transparent)]" />
      <svg viewBox="0 0 320 200" preserveAspectRatio={`xMidYMid ${fit}`} className={cn("relative size-full origin-center transition-transform duration-500 ease-out motion-reduce:transition-none", art)}>
        {/* Custom categories (added in admin) use the general toolkit artwork. */}
        {ART[category as DigitalCategoryId] ?? ART["creative-toolkits"]}
      </svg>
    </div>
  );
}
