import { z } from "zod";
import type { InlineRun, RichBlock } from "./types";

/*
 * Rich text for admin-written posts. The editor's DOM (typed or pasted) is converted to RichBlock JSON
 * by walking it against an allowlist; the server re-validates that JSON; pages render it as React.
 * Raw HTML is never stored, so there is nothing to "unsanitize" later.
 */

export const MEDIA_PREFIX = "/media/blog/";
const MEDIA_RE = /^\/media\/blog\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const isMediaSrc = (src: string) => MEDIA_RE.test(src);
export const mediaId = (src: string) => (isMediaSrc(src) ? src.slice(MEDIA_PREFIX.length) : null);

/** Site paths, in-page anchors, http(s) and mailto links only — never javascript:, data: or protocol-relative URLs. */
export function safeHref(raw: string): string | null {
  const h = raw.trim();
  if (!h || h.length > 2000) return null;
  if (/^\/(?!\/)[^\s\\]*$/.test(h)) return h;
  if (/^#[\w-]{1,100}$/.test(h)) return h;
  if (/^mailto:[^\s@/]+@[^\s@/]+$/i.test(h)) return h;
  try {
    const u = new URL(h);
    if ((u.protocol === "https:" || u.protocol === "http:") && u.hostname) return u.toString();
  } catch {}
  return null;
}

export const RICH_LIMITS = { blocks: 600, runs: 300, items: 200, text: 10_000, alt: 200, caption: 300 } as const;

const Run = z.strictObject({
  text: z.string().max(RICH_LIMITS.text),
  b: z.boolean().optional(),
  i: z.boolean().optional(),
  u: z.boolean().optional(),
  href: z
    .string()
    .max(2000)
    .refine((h) => safeHref(h) !== null, "Links must be a site path, an https:// address or a mailto: address.")
    .optional(),
});
const Runs = z.array(Run).max(RICH_LIMITS.runs);

export const RichBlocksSchema = z
  .array(
    z.discriminatedUnion("type", [
      z.strictObject({ type: z.enum(["p", "h2", "h3", "h4", "quote"]), runs: Runs }),
      z.strictObject({ type: z.enum(["ul", "ol"]), items: z.array(Runs).min(1).max(RICH_LIMITS.items) }),
      z.strictObject({
        type: z.literal("img"),
        src: z.string().refine(isMediaSrc, "Images must be uploaded to Sociotix first."),
        alt: z.string().trim().max(RICH_LIMITS.alt),
        caption: z.string().trim().max(RICH_LIMITS.caption).optional(),
        width: z.number().int().min(1).max(20_000).optional(),
        height: z.number().int().min(1).max(20_000).optional(),
      }),
    ]),
  )
  .max(RICH_LIMITS.blocks);

const sameMarks = (a: InlineRun, b: InlineRun) => !!a.b === !!b.b && !!a.i === !!b.i && !!a.u === !!b.u && a.href === b.href;

/** Merges neighbouring runs with the same formatting, drops empty ones, trims the ends and canonicalises links. */
export function normalizeRuns(runs: InlineRun[]): InlineRun[] {
  const out: InlineRun[] = [];
  for (const r of runs) {
    if (!r.text) continue;
    const href = r.href ? (safeHref(r.href) ?? undefined) : undefined;
    const run: InlineRun = { text: r.text, ...(r.b ? { b: true } : {}), ...(r.i ? { i: true } : {}), ...(r.u ? { u: true } : {}), ...(href ? { href } : {}) };
    const last = out.at(-1);
    if (last && sameMarks(last, run)) last.text += run.text;
    else out.push(run);
  }
  if (out.length) {
    out[0].text = out[0].text.replace(/^[ \t\n]+/, "");
    out[out.length - 1].text = out[out.length - 1].text.replace(/[ \t\n]+$/, "");
  }
  return out.filter((r) => r.text);
}

export function normalizeBlocks(blocks: RichBlock[]): RichBlock[] {
  const out: RichBlock[] = [];
  for (const b of blocks) {
    if (b.type === "img") {
      const { caption, ...rest } = b;
      out.push({ ...rest, alt: b.alt.trim(), ...(caption?.trim() ? { caption: caption.trim() } : {}) });
    }
    else if ("items" in b) {
      const items = b.items.map(normalizeRuns).filter((i) => i.length);
      if (items.length) out.push({ type: b.type, items });
    } else {
      const runs = normalizeRuns(b.runs);
      if (runs.length) out.push({ type: b.type, runs });
    }
  }
  return out;
}

/** Validates untrusted JSON from the editor and returns normalised blocks (throws ZodError). */
export const parseRichBlocks = (input: unknown): RichBlock[] => normalizeBlocks(RichBlocksSchema.parse(input) as RichBlock[]);

export const runsText = (runs: InlineRun[]) => runs.map((r) => r.text).join("");

export function richPlainText(blocks: RichBlock[]) {
  return blocks
    .map((b) => (b.type === "img" ? (b.caption ?? "") : "items" in b ? b.items.map(runsText).join(" ") : runsText(b.runs)))
    .join(" ")
    .trim();
}

export const richLinks = (blocks: RichBlock[]) => blocks.flatMap((b) => (b.type === "img" ? [] : "items" in b ? b.items.flat() : b.runs)).flatMap((r) => (r.href ? [r.href] : []));

/* ------------------------------------------------------------------ */
/*  Editor round-trip (browser)                                        */
/* ------------------------------------------------------------------ */

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function runHtml(r: InlineRun) {
  let h = esc(r.text).replace(/\n/g, "<br>");
  if (r.u) h = `<u>${h}</u>`;
  if (r.i) h = `<em>${h}</em>`;
  if (r.b) h = `<strong>${h}</strong>`;
  if (r.href) h = `<a href="${esc(r.href)}">${h}</a>`;
  return h;
}
const runsHtml = (runs: InlineRun[]) => runs.map(runHtml).join("") || "<br>";

/** Escaped HTML for the editor's contenteditable, built only from validated blocks. */
export function blocksToHtml(blocks: RichBlock[]): string {
  if (!blocks.length) return "<p><br></p>";
  return blocks
    .map((b) => {
      switch (b.type) {
        case "img":
          return `<figure data-rich-img contenteditable="false"><img src="${esc(b.src)}" alt="${esc(b.alt)}"${b.width ? ` width="${b.width}"` : ""}${b.height ? ` height="${b.height}"` : ""}><figcaption contenteditable="true">${esc(b.caption ?? "")}</figcaption></figure>`;
        case "ul":
        case "ol":
          return `<${b.type}>${b.items.map((it) => `<li>${runsHtml(it)}</li>`).join("")}</${b.type}>`;
        case "quote":
          return `<blockquote>${runsHtml(b.runs)}</blockquote>`;
        default:
          return `<${b.type}>${runsHtml(b.runs)}</${b.type}>`;
      }
    })
    .join("");
}

type Marks = Omit<InlineRun, "text">;
const SKIP = new Set(["SCRIPT", "STYLE", "TEMPLATE", "NOSCRIPT", "IFRAME", "OBJECT", "EMBED", "SVG", "MATH", "HEAD", "TITLE", "META", "LINK", "BUTTON", "INPUT", "SELECT", "TEXTAREA", "CANVAS", "VIDEO", "AUDIO"]);
const BLOCK = new Set(["P", "DIV", "SECTION", "ARTICLE", "MAIN", "HEADER", "FOOTER", "ASIDE", "NAV", "H1", "H2", "H3", "H4", "H5", "H6", "UL", "OL", "LI", "BLOCKQUOTE", "FIGURE", "TABLE", "THEAD", "TBODY", "TR", "TD", "TH", "PRE", "HR", "DL", "DT", "DD", "BODY"]);

function marksOf(el: Element, base: Marks): Marks {
  const m: Marks = { ...base };
  const tag = el.tagName;
  if (tag === "B" || tag === "STRONG") m.b = true;
  if (tag === "I" || tag === "EM") m.i = true;
  if (tag === "U" || tag === "INS") m.u = true;
  if (tag === "A") {
    const href = safeHref(el.getAttribute("href") ?? "");
    if (href) m.href = href;
  }
  // Word processors (Google Docs, Word) mark formatting with inline styles.
  const style = (el as HTMLElement).style;
  if (style) {
    const w = style.fontWeight;
    if (w === "bold" || Number(w) >= 600) m.b = true;
    else if (w === "normal" || (Number(w) > 0 && Number(w) < 600)) m.b = false;
    if (style.fontStyle === "italic") m.i = true;
    if (style.textDecorationLine?.includes("underline") || style.textDecoration?.includes("underline")) m.u = true;
  }
  return m;
}

function collectRuns(node: Node, marks: Marks, out: InlineRun[]) {
  if (node.nodeType === 3) {
    out.push({ text: (node.textContent ?? "").replace(/[\s ]+/g, " "), ...marks });
    return;
  }
  if (node.nodeType !== 1) return;
  const el = node as Element;
  if (SKIP.has(el.tagName) || el.tagName === "IMG") return;
  if (el.tagName === "BR") {
    out.push({ text: "\n", ...marks });
    return;
  }
  const m = marksOf(el, marks);
  el.childNodes.forEach((c) => collectRuns(c, m, out));
}

const inlineRuns = (el: Node) => {
  const runs: InlineRun[] = [];
  el.childNodes.forEach((c) => collectRuns(c, {}, runs));
  // Collapse whitespace around explicit line breaks.
  return normalizeRuns(runs.map((r) => ({ ...r, text: r.text.replace(/ ?\n ?/g, "\n") })));
};

function imageBlock(img: Element, caption?: string): RichBlock | null {
  // Only images already uploaded to Sociotix survive; pasted images from other sites are dropped.
  const src = img.getAttribute("src") ?? "";
  let path = src;
  if (!src.startsWith("/")) {
    try {
      const u = new URL(src);
      path = typeof window !== "undefined" && u.origin === window.location.origin ? u.pathname : "";
    } catch {
      path = "";
    }
  }
  if (!isMediaSrc(path)) return null;
  const w = Number(img.getAttribute("width")) || undefined;
  const h = Number(img.getAttribute("height")) || undefined;
  return { type: "img", src: path, alt: (img.getAttribute("alt") ?? "").slice(0, RICH_LIMITS.alt), ...(caption ? { caption: caption.slice(0, RICH_LIMITS.caption) } : {}), ...(w ? { width: w } : {}), ...(h ? { height: h } : {}) };
}

/** Converts editor or pasted DOM into blocks. Unknown tags keep their text; scripts, styles, embeds and foreign images are dropped. */
export function domToBlocks(root: Node): RichBlock[] {
  const out: RichBlock[] = [];
  let pending: InlineRun[] = [];
  const flush = () => {
    const runs = normalizeRuns(pending);
    if (runs.length) out.push({ type: "p", runs });
    pending = [];
  };
  const walk = (node: Node) => {
    if (node.nodeType === 3) {
      collectRuns(node, {}, pending);
      return;
    }
    if (node.nodeType !== 1) return;
    const el = node as Element;
    const tag = el.tagName;
    if (SKIP.has(tag)) return;
    if (tag === "IMG") {
      flush();
      const b = imageBlock(el);
      if (b) out.push(b);
      return;
    }
    if (!BLOCK.has(tag)) {
      // Inline element: but pasted HTML sometimes wraps blocks inside spans.
      if (el.querySelector("p,div,h1,h2,h3,h4,h5,h6,ul,ol,blockquote,figure,img,table")) el.childNodes.forEach(walk);
      else collectRuns(el, {}, pending);
      return;
    }
    flush();
    switch (tag) {
      case "H1":
      case "H2":
        out.push({ type: "h2", runs: inlineRuns(el).map(({ text }) => ({ text })) });
        return;
      case "H3":
        out.push({ type: "h3", runs: inlineRuns(el).map(({ text }) => ({ text })) });
        return;
      case "H4":
      case "H5":
      case "H6":
        out.push({ type: "h4", runs: inlineRuns(el).map(({ text }) => ({ text })) });
        return;
      case "BLOCKQUOTE": {
        // Headings, lists or images typed or pasted inside a quote keep their own blocks; its text stays quoted.
        if (!el.querySelector("h1,h2,h3,h4,h5,h6,ul,ol,figure,img,table,blockquote")) {
          out.push({ type: "quote", runs: inlineRuns(el) });
          return;
        }
        let quoted: InlineRun[] = [];
        const flushQuote = () => {
          const runs = normalizeRuns(quoted);
          if (runs.length) out.push({ type: "quote", runs });
          quoted = [];
        };
        el.childNodes.forEach((c) => {
          if (c.nodeType === 1 && (BLOCK.has((c as Element).tagName) || (c as Element).tagName === "IMG") && !/^(P|DIV)$/.test((c as Element).tagName)) {
            flushQuote();
            walk(c);
          } else if (c.nodeType === 1 && /^(P|DIV)$/.test((c as Element).tagName)) {
            flushQuote();
            quoted = inlineRuns(c);
            flushQuote();
          } else collectRuns(c, {}, quoted);
        });
        flushQuote();
        return;
      }
      case "UL":
      case "OL": {
        const items: InlineRun[][] = [];
        el.querySelectorAll("li").forEach((li) => {
          const clone = li.cloneNode(true) as Element;
          clone.querySelectorAll("ul,ol").forEach((n) => n.remove());
          items.push(inlineRuns(clone));
        });
        out.push({ type: tag === "UL" ? "ul" : "ol", items });
        return;
      }
      case "FIGURE": {
        const img = el.querySelector("img");
        const b = img ? imageBlock(img, el.querySelector("figcaption")?.textContent?.trim() || undefined) : null;
        if (b) out.push(b);
        return;
      }
      case "HR":
        return;
      default: {
        const hasBlocks = Array.from(el.children).some((c) => BLOCK.has(c.tagName) || c.tagName === "IMG");
        if (hasBlocks) el.childNodes.forEach(walk);
        else {
          const runs = inlineRuns(el);
          if (runs.length) out.push({ type: "p", runs });
        }
        flush();
      }
    }
  };
  root.childNodes.forEach(walk);
  flush();
  return normalizeBlocks(out);
}
