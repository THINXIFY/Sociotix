"use client";

import * as React from "react";
import { Check, Link2, Share2 } from "lucide-react";

/** A thin reading-progress bar under the header, tracking the article body. */
export function ReadingProgress({ targetId }: { targetId: string }) {
  const [p, setP] = React.useState(0);
  React.useEffect(() => {
    const el = document.getElementById(targetId);
    if (!el) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const r = el.getBoundingClientRect();
      const total = r.height - window.innerHeight * 0.6;
      setP(Math.min(1, Math.max(0, total > 0 ? -r.top / total : 0)));
    };
    const on = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", on);
      window.removeEventListener("resize", on);
    };
  }, [targetId]);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-16 z-30 h-[3px]" aria-hidden>
      <div className="h-full origin-left bg-[linear-gradient(90deg,#7047EB,#9277F4,#C8FF52)]" style={{ transform: `scaleX(${p})` }} data-progress={p.toFixed(2)} />
    </div>
  );
}

/** Copy link, native share where available, and plain share links (no tracking scripts). */
export function ShareBar({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = React.useState(false);
  // Native share is a browser capability: false on the server, read once on the client.
  const canShare = React.useSyncExternalStore(
    () => () => {},
    () => typeof navigator.share === "function",
    () => false,
  );
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  const btn = "inline-flex h-10 items-center gap-2 rounded-full border bg-card px-4 text-sm font-medium transition-colors duration-150 hover:border-primary/35 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none dark:bg-white/[0.03]";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={copy} className={btn}>
        {copied ? <Check className="size-4" aria-hidden /> : <Link2 className="size-4" aria-hidden />}
        {copied ? "Link copied" : "Copy link"}
      </button>
      {canShare ? (
        <button type="button" onClick={() => void navigator.share({ title, url }).catch(() => {})} className={btn}>
          <Share2 className="size-4" aria-hidden /> Share
        </button>
      ) : null}
      <a className={btn} href={`https://x.com/intent/post?url=${u}&text=${t}`} target="_blank" rel="noopener noreferrer">
        X<span className="sr-only"> (share on X, opens in a new tab)</span>
      </a>
      <a className={btn} href={`https://www.linkedin.com/sharing/share-offsite/?url=${u}`} target="_blank" rel="noopener noreferrer">
        LinkedIn<span className="sr-only"> (share on LinkedIn, opens in a new tab)</span>
      </a>
      <a className={btn} href={`https://www.facebook.com/sharer/sharer.php?u=${u}`} target="_blank" rel="noopener noreferrer">
        Facebook<span className="sr-only"> (share on Facebook, opens in a new tab)</span>
      </a>
      <span className="sr-only" aria-live="polite">
        {copied ? "Link copied to clipboard" : ""}
      </span>
    </div>
  );
}
