import { afterEach, describe, expect, it } from "vitest";
import { generateMetadata as blogMetadata } from "@/app/blog/page";
import sitemap from "@/app/sitemap";
import { ALL_ARTICLES, BLOG_CATEGORIES, type BlogArticle, filterCards, getArticle, headingId, isPublished, parseInline, publishedArticles, readingMinutes, relatedArticles, tableOfContents, toCard, visibleArticles } from "@/lib/blog";
import { blogPosting } from "@/lib/seo/schema";

const saved = { APP_URL: process.env.APP_URL, APP_ENV: process.env.APP_ENV };
afterEach(() => {
  for (const [k, v] of Object.entries(saved)) if (v === undefined) delete process.env[k];
  else process.env[k] = v;
});

const published = (a: BlogArticle, date: string): BlogArticle => ({ ...a, status: "published", publishedAt: date });

describe("blog content", () => {
  it("every article is well formed: unique slugs, known categories, real headings, no invented dates or people", () => {
    const slugs = ALL_ARTICLES.map((a) => a.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const a of ALL_ARTICLES) {
      expect(a.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(BLOG_CATEGORIES.map((c) => c.id)).toContain(a.category);
      expect(a.description.length, a.slug).toBeGreaterThanOrEqual(110);
      expect(a.description.length, a.slug).toBeLessThanOrEqual(175);
      expect(tableOfContents(a).length).toBeGreaterThanOrEqual(3);
      expect(a.coverAlt.length).toBeGreaterThan(10);
      // Drafts carry no publication date; a person author would need a real, approved name.
      if (a.status === "draft") expect(a.publishedAt).toBeUndefined();
      expect(a.author.kind === "organization" ? a.author.name : "person").toBe(a.author.kind === "organization" ? "Sociotix Team" : "person");
      // No statistics or guarantees in the copy.
      const text = JSON.stringify(a.body).toLowerCase();
      for (const banned of ["guarantee results", "guaranteed growth", "go viral", "% of", "studies show", "according to research"]) expect(text, `${a.slug}: ${banned}`).not.toContain(banned);
    }
  });

  it("only approved AND dated articles count as published", () => {
    const [a] = ALL_ARTICLES;
    expect(isPublished(a)).toBe(false);
    expect(isPublished({ ...a, status: "published" })).toBe(false);
    expect(isPublished(published(a, "2026-11-01"))).toBe(true);
  });

  it("drafts are visible only when previewing; production shows published articles only", () => {
    const list = [published(ALL_ARTICLES[0], "2026-10-01"), published(ALL_ARTICLES[1], "2026-11-01"), ALL_ARTICLES[2]];
    expect(publishedArticles(list).map((a) => a.publishedAt)).toEqual(["2026-11-01", "2026-10-01"]);
    expect(visibleArticles(list, false)).toHaveLength(2);
    expect(visibleArticles(list, true)).toHaveLength(3);
    expect(getArticle(ALL_ARTICLES[0].slug, false)).toBeNull();
    expect(getArticle(ALL_ARTICLES[0].slug, true)?.slug).toBe(ALL_ARTICLES[0].slug);
    expect(getArticle("does-not-exist", true)).toBeNull();
  });

  it("an empty blog stays out of search and the sitemap until something is published", async () => {
    process.env.APP_URL = "https://www.example.com";
    expect(publishedArticles()).toHaveLength(0);
    expect((await blogMetadata()).robots).toEqual({ index: false, follow: true });
    expect((await sitemap()).map((e) => e.url).some((u) => u.includes("/blog"))).toBe(false);
  });
});

describe("blog helpers", () => {
  it("search matches title, description, category and tags; categories filter", () => {
    const cards = ALL_ARTICLES.map(toCard);
    expect(filterCards(cards, "all", "")).toHaveLength(cards.length);
    expect(filterCards(cards, "all", "CAPTION").map((c) => c.slug)).toEqual(["write-captions-that-sound-like-you"]);
    expect(filterCards(cards, "all", "growth strategies").map((c) => c.slug)).toEqual(["plan-a-month-of-social-content"]);
    expect(filterCards(cards, "automation", "")).toHaveLength(0);
    expect(filterCards(cards, "guides", "marketplace").map((c) => c.slug)).toEqual(["choose-the-right-social-media-service"]);
  });

  it("reading time, heading ids, related articles and inline links", () => {
    for (const a of ALL_ARTICLES) expect(readingMinutes(a)).toBeGreaterThanOrEqual(2);
    expect(headingId("Start with the goal, not the metric")).toBe("start-with-the-goal-not-the-metric");
    const rel = relatedArticles(ALL_ARTICLES[0], ALL_ARTICLES);
    expect(rel.map((r) => r.slug)).not.toContain(ALL_ARTICLES[0].slug);
    expect(parseInline("See [order statuses](/help/order-statuses) now.")).toEqual([
      { type: "text", value: "See " },
      { type: "link", label: "order statuses", href: "/help/order-statuses" },
      { type: "text", value: " now." },
    ]);
  });

  it("BlogPosting reflects the real article: team author as the Organization, real dates, no ratings", () => {
    process.env.APP_URL = "https://www.example.com";
    const node = blogPosting({ path: "/blog/x", headline: "X", description: "Y", datePublished: "2026-11-01", image: "/blog/x/opengraph-image", author: { name: "Sociotix Team", kind: "organization" }, keywords: ["a", "b"] });
    expect(node).toMatchObject({ "@type": "BlogPosting", datePublished: "2026-11-01", dateModified: "2026-11-01", author: { "@id": "https://www.example.com/#organization" }, image: ["https://www.example.com/blog/x/opengraph-image"] });
    expect(JSON.stringify(node)).not.toMatch(/rating|review/i);
  });
});

describe("blog homepage states", async () => {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { createElement } = await import("react");
  const { BlogHome } = await import("@/components/blog/blog-home");

  it("with no published articles (production), shows the polished empty state and an honest newsletter note", () => {
    const html = renderToStaticMarkup(createElement(BlogHome, { articles: [] }));
    expect(html).toContain("Insights That");
    expect(html).toContain("Our first articles are being written.");
    expect(html).not.toMatch(/<form|type="email"/);
    expect(html).not.toContain("Featured articles");
    expect(html).not.toContain("Draft");
  });

  it("with articles: hero search, six categories + All Articles, featured not repeated in latest, drafts labelled", () => {
    const html = renderToStaticMarkup(createElement(BlogHome, { articles: visibleArticles(ALL_ARTICLES, true) }));
    for (const t of ["Insights That", "Inspire Growth.", "Search articles", "All Articles", "Featured articles", "Latest articles", "Draft preview", "Ready to put it into practice?"]) expect(html).toContain(t);
    for (const c of BLOG_CATEGORIES) expect(html).toContain(c.name.replace("&", "&amp;"));
    expect(BLOG_CATEGORIES).toHaveLength(6);
    // The featured article appears once (in Featured), not again in Latest.
    expect(html.split("How to Choose the Right Social Media Service for Your Goal").length - 1).toBe(1);
    for (const gone of ["Featured insights", "One idea from each story", "A newsletter is on its way"]) expect(html).not.toContain(gone);
  });
});
