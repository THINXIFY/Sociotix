import { describe, expect, it } from "vitest";
import { postState, slugify } from "@/lib/blog/admin";
import { blocksToHtml, isMediaSrc, normalizeRuns, parseRichBlocks, richPlainText, safeHref } from "@/lib/blog/rich";
import { effectiveSeoTitle, seoChecklist } from "@/lib/blog/seo-check";
import type { RichBlock } from "@/lib/blog/types";
import { checkImageUrl, inspectImage, isBlockedAddress } from "@/server/blog/media";

/* Blog Management: rich-text safety, image validation, SSRF guard, slugs and the SEO checklist. */

const MEDIA = "/media/blog/0b7c3c6e-6d55-4f5e-9a51-1d1f3c7d9e10";

describe("rich text safety", () => {
  it("allows site paths, anchors, https and mailto links only", () => {
    expect(safeHref("/help")).toBe("/help");
    expect(safeHref("#section-2")).toBe("#section-2");
    expect(safeHref("https://example.com/a?b=1")).toBe("https://example.com/a?b=1");
    expect(safeHref("mailto:hello@sociotix.com")).toBe("mailto:hello@sociotix.com");
    for (const bad of ["javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,<script>", "//evil.example", "/\\evil.example", "vbscript:x", "ftp://x.example", ""]) expect(safeHref(bad), bad).toBeNull();
  });

  it("rejects unsafe links, foreign images and unknown block types", () => {
    expect(() => parseRichBlocks([{ type: "p", runs: [{ text: "x", href: "javascript:alert(1)" }] }])).toThrow();
    expect(() => parseRichBlocks([{ type: "img", src: "https://evil.example/x.png", alt: "x" }])).toThrow();
    expect(() => parseRichBlocks([{ type: "script", runs: [{ text: "alert(1)" }] }])).toThrow();
    expect(() => parseRichBlocks([{ type: "p", runs: [{ text: "x", style: "color:red" }] }])).toThrow();
    expect(() => parseRichBlocks("<p>html</p>")).toThrow();
  });

  it("normalises: merges same-format runs, trims, drops empty blocks", () => {
    const out = parseRichBlocks([
      { type: "p", runs: [{ text: "  Hello " }, { text: "world", b: false }, { text: "!", b: true }, { text: "" }] },
      { type: "h2", runs: [{ text: "   " }] },
      { type: "ul", items: [[{ text: "one" }], [{ text: " " }]] },
      { type: "img", src: MEDIA, alt: " A chart ", caption: "  " },
    ]);
    expect(out).toEqual([
      { type: "p", runs: [{ text: "Hello world" }, { text: "!", b: true }] },
      { type: "ul", items: [[{ text: "one" }]] },
      { type: "img", src: MEDIA, alt: "A chart" },
    ]);
    expect(normalizeRuns([{ text: "a", href: "javascript:x" }])).toEqual([{ text: "a" }]);
  });

  it("escapes everything it writes back into the editor", () => {
    const html = blocksToHtml([
      { type: "p", runs: [{ text: `<img src=x onerror="alert(1)">` }, { text: "link", href: `/a"onmouseover="x` }] },
      { type: "img", src: MEDIA, alt: `"><script>alert(1)</script>` },
    ]);
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(html).toContain(`alt="&quot;&gt;&lt;script&gt;`);
  });

  it("only accepts media served by Sociotix", () => {
    expect(isMediaSrc(MEDIA)).toBe(true);
    expect(isMediaSrc(`${MEDIA}/../../etc`)).toBe(false);
    expect(isMediaSrc("/media/blog/not-a-uuid")).toBe(false);
  });

  it("extracts plain text for reading time and search", () => {
    const blocks: RichBlock[] = [
      { type: "h2", runs: [{ text: "Plan" }] },
      { type: "p", runs: [{ text: "Write " }, { text: "weekly", b: true }] },
      { type: "ol", items: [[{ text: "one" }], [{ text: "two" }]] },
    ];
    expect(richPlainText(blocks)).toBe("Plan Write weekly one two");
  });
});

describe("image validation", () => {
  const png = (w: number, h: number) => {
    const b = Buffer.alloc(33);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
    b.writeUInt32BE(13, 8);
    b.write("IHDR", 12, "latin1");
    b.writeUInt32BE(w, 16);
    b.writeUInt32BE(h, 20);
    return b;
  };
  const jpeg = (w: number, h: number) => Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, h >> 8, h & 255, w >> 8, w & 255, 0x03, 0, 0, 0, 0, 0, 0, 0, 0]);
  const webp = (w: number, h: number) => {
    const b = Buffer.alloc(30);
    b.write("RIFF", 0, "latin1");
    b.write("WEBP", 8, "latin1");
    b.write("VP8X", 12, "latin1");
    b.writeUIntLE(w - 1, 24, 3);
    b.writeUIntLE(h - 1, 27, 3);
    return b;
  };

  it("identifies JPEG, PNG and WebP by their bytes and reads dimensions", () => {
    expect(inspectImage(png(1200, 630))).toEqual({ mime: "image/png", width: 1200, height: 630 });
    expect(inspectImage(jpeg(800, 600))).toEqual({ mime: "image/jpeg", width: 800, height: 600 });
    expect(inspectImage(webp(640, 480))).toEqual({ mime: "image/webp", width: 640, height: 480 });
  });

  it("refuses SVG, HTML, GIF, empty, oversized and absurd images", () => {
    expect(() => inspectImage(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>`))).toThrow(/JPEG, PNG or WebP/);
    expect(() => inspectImage(Buffer.from("<!doctype html><script>alert(1)</script>"))).toThrow();
    expect(() => inspectImage(Buffer.from("GIF89a\x01\x00\x01\x00", "latin1"))).toThrow();
    expect(() => inspectImage(Buffer.alloc(0))).toThrow(/empty/);
    expect(() => inspectImage(Buffer.alloc(5 * 1024 * 1024 + 1))).toThrow(/5 MB/);
    expect(() => inspectImage(png(50_000, 10))).toThrow(/dimensions/);
  });
});

describe("image URL import guard (SSRF)", () => {
  it("blocks loopback, private, link-local, metadata and mapped addresses", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fe80::1", "fd00::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1"]) expect(isBlockedAddress(ip), ip).toBe(true);
    for (const ip of ["93.184.216.34", "1.1.1.1", "2606:4700:4700::1111"]) expect(isBlockedAddress(ip), ip).toBe(false);
  });

  it("refuses non-web schemes, credentials, odd ports and internal names before any request", () => {
    for (const u of ["file:///etc/passwd", "ftp://example.com/a.png", "http://user:pass@example.com/a.png", "http://example.com:8080/a.png", "http://localhost/a.png", "http://db.internal/a.png", "http://127.0.0.1/a.png", "http://[::1]/a.png", "http://169.254.169.254/latest/meta-data", "not a url"]) expect(() => checkImageUrl(u), u).toThrow();
    expect(checkImageUrl("https://images.example.com/photo.jpg").hostname).toBe("images.example.com");
  });
});

describe("slugs and states", () => {
  it("builds clean slugs from titles", () => {
    expect(slugify("How to Plan a Month of Content!")).toBe("how-to-plan-a-month-of-content");
    expect(slugify("Café & Crème — Growth Tips")).toBe("cafe-and-creme-growth-tips");
    expect(slugify("x".repeat(120)).length).toBe(80);
    expect(slugify("   ")).toBe("");
  });

  it("derives draft / scheduled / published", () => {
    const now = Date.UTC(2026, 10, 1);
    expect(postState("draft", null, now)).toBe("draft");
    expect(postState("draft", new Date(now - 1000), now)).toBe("draft");
    expect(postState("published", new Date(now + 60_000), now)).toBe("scheduled");
    expect(postState("published", new Date(now - 60_000), now)).toBe("published");
  });
});

describe("SEO checklist", () => {
  const base = { title: "", seoTitle: "", slug: "", metaDescription: "", focusKeyword: "", blocks: [] as RichBlock[], hasImage: false, imageAlt: "", category: "guides" };
  const byId = (input: typeof base) => Object.fromEntries(seoChecklist(input).map((c) => [c.id, c.state]));

  it("reports missing fields on an empty post", () => {
    const c = byId(base);
    expect(c.fields).toBe("missing");
    expect(c["kw-title"]).toBe("missing");
    expect(c["image-alt"]).toBe("missing");
  });

  it("recognises a well-prepared post", () => {
    const intro = "A content calendar helps small teams plan posts ahead. It keeps ideas organised and publishing steady.";
    const body = Array.from({ length: 30 }, (_, i) => ({ type: "p" as const, runs: [{ text: `Paragraph ${i} explains one practical planning step in plain words for busy people.` }] }));
    const c = byId({
      ...base,
      title: "How to Build a Content Calendar That Works",
      slug: "build-a-content-calendar",
      metaDescription: "Learn how to build a simple content calendar: plan themes, batch your writing and keep a steady publishing rhythm without burning out.",
      focusKeyword: "content calendar",
      hasImage: true,
      imageAlt: "A monthly planner",
      blocks: [{ type: "p", runs: [{ text: intro }] }, { type: "h2", runs: [{ text: "Plan themes" }] }, ...body, { type: "h2", runs: [{ text: "Batch it" }] }, { type: "p", runs: [{ text: "See our ", }, { text: "Help Center", href: "/help" }, { text: "." }] }],
    });
    for (const id of ["fields", "kw-title", "kw-slug", "kw-desc", "kw-intro", "title-length", "desc-length", "length", "headings", "readability", "internal-links", "image-alt"]) expect(c[id], id).toBe("good");
    expect(c.density).toBeUndefined();
  });

  it("flags keyword repetition instead of rewarding it", () => {
    const stuffed = Array.from({ length: 40 }, () => ({ type: "p" as const, runs: [{ text: "content calendar content calendar tips." }] }));
    expect(byId({ ...base, focusKeyword: "content calendar", blocks: stuffed }).density).toBe("improve");
  });

  it("uses the post title with the blog suffix when there's no SEO title", () => {
    expect(effectiveSeoTitle("Plan Better", "")).toBe("Plan Better | Sociotix Blog");
    expect(effectiveSeoTitle("Plan Better", "Custom")).toBe("Custom");
  });
});
