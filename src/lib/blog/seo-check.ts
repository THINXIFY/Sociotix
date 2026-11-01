import { richLinks, richPlainText, runsText } from "./rich";
import type { RichBlock } from "./types";

/*
 * Writing suggestions for the editor's SEO panel. These are common on-page guidelines, not a
 * prediction of Google rankings, and nothing here changes the post: the writer decides.
 */

export const SEO_LIMITS = { title: { min: 30, max: 60 }, description: { min: 120, max: 160 } } as const;

export type CheckState = "good" | "improve" | "missing";
export interface SeoCheck {
  id: string;
  label: string;
  state: CheckState;
  hint: string;
}

export interface SeoInput {
  title: string;
  seoTitle: string;
  slug: string;
  metaDescription: string;
  focusKeyword: string;
  blocks: RichBlock[];
  hasImage: boolean;
  imageAlt: string;
  category: string;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const contains = (hay: string, needle: string) => !!needle && ` ${norm(hay)} `.includes(` ${norm(needle)} `);
const words = (s: string) => norm(s).split(" ").filter(Boolean);

/** The title search engines will show: the SEO title, or the post title with the blog suffix. */
export const effectiveSeoTitle = (title: string, seoTitle: string) => seoTitle.trim() || (title.trim() ? `${title.trim()} | Sociotix Blog` : "");

export function wordCount(blocks: RichBlock[]) {
  return words(richPlainText(blocks)).length;
}

function sentences(text: string) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => words(s).length > 0);
}

export function seoChecklist(input: SeoInput): SeoCheck[] {
  const kw = input.focusKeyword.trim();
  const title = effectiveSeoTitle(input.title, input.seoTitle);
  const desc = input.metaDescription.trim();
  const paragraphs = input.blocks.filter((b): b is Extract<RichBlock, { runs: unknown }> => b.type === "p");
  const intro = paragraphs[0] ? runsText(paragraphs[0].runs) : "";
  const total = wordCount(input.blocks);
  const headings = input.blocks.filter((b) => b.type === "h2" || b.type === "h3" || b.type === "h4").length;
  const internal = richLinks(input.blocks).filter((h) => h.startsWith("/") || h.startsWith("#")).length;
  const sents = sentences(paragraphs.map((p) => runsText(p.runs)).join(" "));
  const avgSentence = sents.length ? Math.round(sents.reduce((n, s) => n + words(s).length, 0) / sents.length) : 0;
  const longParagraphs = paragraphs.filter((p) => words(runsText(p.runs)).length > 150).length;
  const kwHits = kw ? (` ${norm(richPlainText(input.blocks))} `.split(` ${norm(kw)} `).length - 1) : 0;
  const density = total ? (kwHits * words(kw).length) / total : 0;
  const slugHasKw = !!kw && norm(input.slug.replace(/-/g, " ")).includes(norm(kw));

  const missing = [!input.title.trim() && "title", !desc && "meta description", !input.category && "category", !kw && "focus keyword", !input.hasImage && "featured image"].filter(Boolean) as string[];

  const out: SeoCheck[] = [
    missing.length
      ? { id: "fields", label: "SEO fields", state: "missing", hint: `Still missing: ${missing.join(", ")}.` }
      : { id: "fields", label: "SEO fields", state: "good", hint: "Title, description, category, keyword and image are set." },
    !kw
      ? { id: "kw-title", label: "Keyword in SEO title", state: "missing", hint: "Add a focus keyword to check this." }
      : contains(title, kw)
        ? { id: "kw-title", label: "Keyword in SEO title", state: "good", hint: "The title mentions your focus keyword." }
        : { id: "kw-title", label: "Keyword in SEO title", state: "improve", hint: "Consider mentioning the keyword naturally in the title." },
    !kw
      ? { id: "kw-slug", label: "Keyword in URL", state: "missing", hint: "Add a focus keyword to check this." }
      : slugHasKw
        ? { id: "kw-slug", label: "Keyword in URL", state: "good", hint: "The URL slug contains the keyword." }
        : { id: "kw-slug", label: "Keyword in URL", state: "improve", hint: "A short slug that includes the keyword is easier to read." },
    !kw || !desc
      ? { id: "kw-desc", label: "Keyword in meta description", state: "missing", hint: !desc ? "Write a meta description." : "Add a focus keyword to check this." }
      : contains(desc, kw)
        ? { id: "kw-desc", label: "Keyword in meta description", state: "good", hint: "The description mentions the keyword." }
        : { id: "kw-desc", label: "Keyword in meta description", state: "improve", hint: "Mention the keyword once in the description if it fits." },
    !kw || !intro
      ? { id: "kw-intro", label: "Keyword in introduction", state: "missing", hint: !intro ? "Start the post with an introductory paragraph." : "Add a focus keyword to check this." }
      : contains(intro, kw)
        ? { id: "kw-intro", label: "Keyword in introduction", state: "good", hint: "The first paragraph introduces the topic." }
        : { id: "kw-intro", label: "Keyword in introduction", state: "improve", hint: "Mention the topic in your first paragraph." },
    !title
      ? { id: "title-length", label: "SEO title length", state: "missing", hint: "Add a title." }
      : title.length >= SEO_LIMITS.title.min && title.length <= SEO_LIMITS.title.max
        ? { id: "title-length", label: "SEO title length", state: "good", hint: `${title.length} characters: unlikely to be cut off.` }
        : { id: "title-length", label: "SEO title length", state: "improve", hint: `${title.length} characters. ${SEO_LIMITS.title.min}–${SEO_LIMITS.title.max} usually displays in full.` },
    !desc
      ? { id: "desc-length", label: "Meta description length", state: "missing", hint: "Write a one- or two-sentence summary." }
      : desc.length >= SEO_LIMITS.description.min && desc.length <= SEO_LIMITS.description.max
        ? { id: "desc-length", label: "Meta description length", state: "good", hint: `${desc.length} characters.` }
        : { id: "desc-length", label: "Meta description length", state: "improve", hint: `${desc.length} characters. ${SEO_LIMITS.description.min}–${SEO_LIMITS.description.max} usually displays in full.` },
    total < 300
      ? { id: "length", label: "Content length", state: total ? "improve" : "missing", hint: `${total} words. Most helpful guides run 300 words or more.` }
      : { id: "length", label: "Content length", state: "good", hint: `${total} words.` },
    headings >= (total > 600 ? 2 : 1)
      ? { id: "headings", label: "Subheadings", state: "good", hint: `${headings} subheading${headings === 1 ? "" : "s"} break up the text.` }
      : { id: "headings", label: "Subheadings", state: "improve", hint: "Use H2 subheadings so readers can scan the post." },
    !sents.length
      ? { id: "readability", label: "Readability", state: "missing", hint: "Write some paragraphs to check readability." }
      : avgSentence <= 22 && !longParagraphs
        ? { id: "readability", label: "Readability", state: "good", hint: `Sentences average ${avgSentence} words.` }
        : { id: "readability", label: "Readability", state: "improve", hint: longParagraphs ? `${longParagraphs} paragraph${longParagraphs === 1 ? " is" : "s are"} over 150 words: consider splitting.` : `Sentences average ${avgSentence} words: shorter sentences read more easily.` },
    internal
      ? { id: "internal-links", label: "Internal links", state: "good", hint: `${internal} link${internal === 1 ? "" : "s"} to other Sociotix pages.` }
      : { id: "internal-links", label: "Internal links", state: "improve", hint: "Link to a related Sociotix page, such as a Help article or service." },
    !input.hasImage
      ? { id: "image-alt", label: "Featured image alt text", state: "missing", hint: "Add a featured image with a short description." }
      : input.imageAlt.trim()
        ? { id: "image-alt", label: "Featured image alt text", state: "good", hint: "The featured image is described." }
        : { id: "image-alt", label: "Featured image alt text", state: "improve", hint: "Describe the image for screen readers and search." },
  ];
  // Repetition reads badly and can look like keyword stuffing; flag it rather than reward it.
  if (kw && density > 0.03 && total >= 100) out.push({ id: "density", label: "Keyword repetition", state: "improve", hint: "The keyword appears very often. Write naturally; repetition doesn't help readers." });
  return out;
}
