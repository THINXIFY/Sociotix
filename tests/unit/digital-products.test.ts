import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import { DigitalMarketplace } from "@/components/digital-products/marketplace";
import { getMarketplace } from "@/server/digital-products/public";
import { availableSorts, capabilities, COLLECTIONS, DIGITAL_CATEGORIES, type DigitalProduct, filterProducts, PREVIEW_PRODUCTS, priceLabel, sortProducts } from "@/lib/digital-products";

/* DP-01: the Digital Products Marketplace homepage (frontend only, preview data). */

const base = { category: "all", query: "", type: "all", price: "all" } as const;
const product = (id: string, over: Partial<DigitalProduct>): DigitalProduct => ({ id, title: id, category: "planners", type: "Planner", description: "d", includes: ["x"], price: { kind: "unset" }, tone: "violet", ...over });

describe("preview catalog", () => {
  it("has the eight categories, each with products, and unique ids", () => {
    expect(DIGITAL_CATEGORIES.map((c) => c.name)).toEqual(["Social Media Templates", "AI Prompts & Automation", "Website & SaaS Templates", "Branding & Design Assets", "E-books & Guides", "Content Calendars & Planners", "AI Agents & Chatbots", "AI Creative Toolkits"]);
    for (const c of DIGITAL_CATEGORIES) expect(PREVIEW_PRODUCTS.some((p) => p.category === c.id), c.id).toBe(true);
    expect(new Set(PREVIEW_PRODUCTS.map((p) => p.id)).size).toBe(PREVIEW_PRODUCTS.length);
  });

  it("invents nothing: no prices, dates, ratings or sales; shown as a preview while nothing is published", async () => {
    expect(await getMarketplace()).toEqual({ products: PREVIEW_PRODUCTS, preview: true });
    for (const p of PREVIEW_PRODUCTS) {
      expect(p.price, p.id).toEqual({ kind: "unset" });
      expect(p.listedAt, p.id).toBeUndefined();
      expect(JSON.stringify(p), p.id).not.toMatch(/\$\d|rating|\breviews\b|testimonial|sold|bestseller|\d+ ?(sales|downloads)/i);
    }
  });

  it("keeps the page out of the sitemap while it is a preview", async () => {
    expect((await sitemap()).some((e) => e.url.includes("digital-products"))).toBe(false);
  });
});

describe("search, filters and sorting", () => {
  it("filters by category, type and search words (every word must match)", () => {
    expect(filterProducts(PREVIEW_PRODUCTS, { ...base, category: "planners" }).map((p) => p.category)).toEqual(["planners", "planners"]);
    expect(filterProducts(PREVIEW_PRODUCTS, { ...base, type: "Guide" }).every((p) => p.type === "Guide")).toBe(true);
    expect(filterProducts(PREVIEW_PRODUCTS, { ...base, query: "calendar" }).map((p) => p.id)).toContain("monthly-content-calendar");
    expect(filterProducts(PREVIEW_PRODUCTS, { ...base, query: "  CALENDAR monthly " })).toHaveLength(1);
    expect(filterProducts(PREVIEW_PRODUCTS, { ...base, query: "calendar zzzz" })).toHaveLength(0);
    expect(filterProducts(PREVIEW_PRODUCTS, { ...base, category: "planners", query: "carousel" })).toHaveLength(0);
  });

  it("offers price and date sorts and the price filter only when that data exists", () => {
    expect(capabilities(PREVIEW_PRODUCTS)).toEqual({ hasPrices: false, hasDates: false });
    expect(availableSorts(PREVIEW_PRODUCTS).map((s) => s.id)).toEqual(["featured", "name"]);
    const mixed = [product("free-one", { price: { kind: "free" }, listedAt: "2026-11-02" }), product("paid-one", { price: { kind: "paid", cents: 1900 } }), product("paid-two", { price: { kind: "paid", cents: 900 } }), product("unpriced", {})];
    expect(availableSorts(mixed).map((s) => s.id)).toEqual(["featured", "name", "newest", "price-asc", "price-desc"]);
    expect(sortProducts(mixed, "price-asc").map((p) => p.id)).toEqual(["free-one", "paid-two", "paid-one", "unpriced"]);
    expect(sortProducts(mixed, "price-desc").map((p) => p.id)).toEqual(["paid-one", "paid-two", "free-one", "unpriced"]);
    expect(sortProducts(mixed, "newest")[0].id).toBe("free-one");
    expect(filterProducts(mixed, { ...base, price: "free" }).map((p) => p.id)).toEqual(["free-one"]);
    expect(filterProducts(mixed, { ...base, price: "paid" }).map((p) => p.id)).toEqual(["paid-one", "paid-two"]);
  });

  it("sorts featured first, and A–Z by name", () => {
    expect(sortProducts(PREVIEW_PRODUCTS, "featured").slice(0, 3).every((p) => p.featured)).toBe(true);
    const names = sortProducts(PREVIEW_PRODUCTS, "name").map((p) => p.title);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it("labels prices honestly", () => {
    expect(priceLabel({ kind: "unset" })).toBe("Pricing at launch");
    expect(priceLabel({ kind: "free" })).toBe("Free");
    expect(priceLabel({ kind: "paid", cents: 1900 })).toBe("$19");
    expect(priceLabel({ kind: "paid", cents: 1950 })).toBe("$19.50");
  });
});

describe("marketplace page", () => {
  const html = renderToStaticMarkup(createElement(DigitalMarketplace, { products: PREVIEW_PRODUCTS, preview: true }));

  it("renders the heading, search, nine tabs and the products in the server HTML", () => {
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain("Digital Tools.");
    expect(html).toContain("Bigger Possibilities.");
    expect(html).toContain('role="search"');
    const start = html.indexOf('aria-label="Filter products by category"');
    const group = html.slice(start, html.indexOf("</section>", start));
    expect((group.match(/aria-pressed/g) ?? []).length).toBe(9);
    expect(html).toContain("Featured products");
    expect(html).toContain("All products");
    expect(html).toContain("Carousel Storytelling Templates");
  });

  it("is honest about availability without 'preview' labels, shows no prices, and has no active purchase action", () => {
    expect(html).toContain("Opening soon.");
    expect(html).toContain("Purchasing isn&#x27;t available yet");
    expect(html).toContain("Coming soon");
    expect(html).toContain("Pricing at launch");
    expect(html).not.toMatch(/concept preview|marketplace preview/i);
    expect(html).not.toMatch(/\$\d/);
    expect(html).not.toMatch(/add to cart|buy now|checkout/i);
  });

  it("lists each featured product once as a card, not again under All products", () => {
    // The product lists must not repeat a featured product.
    const lists = [...html.matchAll(/<ul aria-label="(?:Featured|All) products"[\s\S]*?<\/ul>/g)].map((m) => m[0]).join("");
    for (const p of PREVIEW_PRODUCTS.filter((x) => x.featured)) expect(lists.split(`>${p.title}</h3>`).length - 1, p.title).toBe(1);
    // 3 featured + the first page (12) of the remaining 13; the rest load on demand.
    expect((lists.match(/<article/g) ?? []).length).toBe(15);
  });

  it("offers three curated collections built from existing categories, and the hero illustration", () => {
    expect(COLLECTIONS).toHaveLength(3);
    const ids = new Set<string>(DIGITAL_CATEGORIES.map((c) => c.id));
    for (const c of COLLECTIONS) for (const id of c.categories) expect(ids.has(id), `${c.id}:${id}`).toBe(true);
    expect(html).toContain("Curated collections");
    expect(html.match(/<ul aria-label="Curated collections"[\s\S]*?<\/ul>/)![0].match(/<button/g)).toHaveLength(3);
    // The hero is the supplied illustration, optimised by next/image, with explicit dimensions (no layout shift).
    const img = html.match(/<img[^>]*Sociotix digital marketplace on a laptop[^>]*>/)![0];
    expect(img).toContain('width="1338"');
    expect(img).toContain('height="837"');
    expect(img).toMatch(/digital(%20|\+)products(%20|\+)page(%20|\+)media/);
    expect(html).not.toContain("Concept previews");
  });

  it("filters by collection", () => {
    const plan = COLLECTIONS.find((c) => c.id === "plan-your-month")!;
    expect(filterProducts(PREVIEW_PRODUCTS, { ...base, collection: plan.categories }).every((p) => plan.categories.includes(p.category))).toBe(true);
    expect(filterProducts(PREVIEW_PRODUCTS, { ...base, collection: plan.categories })).toHaveLength(4);
    expect(filterProducts(PREVIEW_PRODUCTS, { ...base, collection: null })).toHaveLength(PREVIEW_PRODUCTS.length);
  });

  it("shows an honest empty state when there are no products", () => {
    const empty = renderToStaticMarkup(createElement(DigitalMarketplace, { products: [], preview: false }));
    expect(empty).toContain("The marketplace is opening soon.");
    expect(empty).not.toContain("aria-pressed");
  });
});

describe("page metadata", () => {
  it("has a title and description within SEO limits, a canonical, and noindex while preview-only", async () => {
    const metadata = await (await import("@/app/digital-products/page")).generateMetadata();
    const title = (metadata.title as { absolute: string }).absolute;
    expect(title.length).toBeLessThanOrEqual(60);
    expect(metadata.description!.length).toBeGreaterThanOrEqual(120);
    expect(metadata.description!.length).toBeLessThanOrEqual(175);
    expect(metadata.alternates?.canonical).toBe("/digital-products");
    expect(metadata.robots).toEqual({ index: false, follow: true });
    expect(`${title} ${metadata.description}`).not.toMatch(/concept|preview/i);
  }, 30_000);
});

describe("live catalogue (published products)", () => {
  const live = (over: Partial<DigitalProduct>) => product(`p-${Math.random().toString(36).slice(2, 8)}`, { source: "admin", availability: "available", ...over });
  it("shows only categories that have products, with honest counts and download notes", () => {
    const html = renderToStaticMarkup(createElement(DigitalMarketplace, { products: [live({ price: { kind: "free" } })], preview: false }));
    expect(html).toContain("1 category · 1 product");
    const group = html.match(/aria-label="Filter products by category"[\s\S]*?<\/div>/)![0];
    expect((group.match(/aria-pressed/g) ?? []).length).toBe(2);
    expect(html).toContain("Free products can be downloaded");
    const paidOnly = renderToStaticMarkup(createElement(DigitalMarketplace, { products: [live({ price: { kind: "paid", cents: 900 } }), live({ category: "ebooks", price: { kind: "paid", cents: 500 } })], preview: false }));
    expect(paidOnly).toContain("2 categories · 2 products");
    expect(paidOnly).not.toContain("Free products can be downloaded");
    expect(paidOnly).toContain("Purchasing isn&#x27;t open yet");
  });
});
