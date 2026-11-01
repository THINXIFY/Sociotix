import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";

/** The official dark-background logo (white wordmark, violet "tix"), read once from public/brand/web. */
const LOGO = { file: "public/brand/web/logo-dark.png", width: 504, height: 120 };
let logo: string | null = null;
const logoDataUri = () => (logo ??= `data:image/png;base64,${readFileSync(join(process.cwd(), LOGO.file)).toString("base64")}`);

/** Shared 1200×630 social-sharing image (SEO-01): official logo, eyebrow, title and one line. No claims beyond the page's own copy. */
export const OG_SIZE = { width: 1200, height: 630 };

export function ogImage({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "72px 80px", background: "radial-gradient(circle at 85% 10%, #3b2a7a 0%, #141519 55%)", color: "#ffffff", fontFamily: "sans-serif" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- rendered by ImageResponse, not the browser */}
        <img src={logoDataUri()} alt="" width={Math.round((56 * LOGO.width) / LOGO.height)} height={56} />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: 4, textTransform: "uppercase", color: "#c8ff52" }}>{eyebrow}</div>
          <div style={{ marginTop: 18, fontSize: 72, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2, maxWidth: 1000 }}>{title}</div>
          <div style={{ marginTop: 22, fontSize: 32, lineHeight: 1.35, color: "rgba(255,255,255,0.72)", maxWidth: 960 }}>{subtitle}</div>
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
