import { NextRequest } from "next/server";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import sitemap from "@/app/sitemap";
import { PREVIEW_PRODUCTS, productHref, relatedProducts } from "@/lib/digital-products";

const getProduct = (slug: string) => PREVIEW_PRODUCTS.find((p) => p.id === slug) ?? null;

/* DP-02: product detail pages at /digital-products/[slug]. */

// The site header and footer need the App Router and app providers; they're covered elsewhere, so stub them here.
vi.mock("@/components/site/public-header", () => ({ Header: () => null }));
vi.mock("@/components/site/footer", () => ({ Footer: () => null }));

const page = () => import("@/app/digital-products/[slug]/page");
const render = async (slug: string) => {
  const { default: Page } = await page();
  return renderToStaticMarkup(await Page({ params: Promise.resolve({ slug }) }));
};

describe("product helpers", () => {
  it("links each product to its own page and finds it by slug", () => {
    expect(productHref({ id: "monthly-content-calendar" })).toBe("/digital-products/monthly-content-calendar");
    expect(getProduct("monthly-content-calendar")?.title).toBe("Monthly Content Calendar");
    expect(getProduct("nope")).toBeNull();
  });

  it("relates same-category products first and never the product itself", () => {
    const p = getProduct("monthly-content-calendar")!;
    const related = relatedProducts(p, PREVIEW_PRODUCTS);
    expect(related).toHaveLength(3);
    expect(related[0].id).toBe("campaign-workbook");
    expect(related.some((r) => r.id === p.id)).toBe(false);
  });
});

describe("product page", () => {
  it("renders breadcrumbs, one H1, availability, a disabled purchase and honest details", async () => {
    const html = await render("monthly-content-calendar");
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toMatch(/<h1[^>]*>Monthly Content Calendar<\/h1>/);
    const crumbs = html.slice(html.indexOf('aria-label="Breadcrumb"'), html.indexOf("</nav>", html.indexOf('aria-label="Breadcrumb"')));
    expect(crumbs).toContain('href="/"');
    expect(crumbs).toContain('href="/digital-products"');
    expect(crumbs).toContain('aria-current="page"');
    expect(html).toContain("Coming soon, not available to buy yet");
    expect(html).toContain("To be announced");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>[\s\S]*?Purchase unavailable/);
    expect(html).toContain('href="mailto:hello@sociotix.com?subject=');
    expect(html.match(/Notify Me When Available/g)).toHaveLength(1);
    expect(html).toContain("Overview");
    expect(html).toContain("Planned contents");
    expect(html).toContain("Weekly review sheet");
    expect(html).toContain("will be published with the product");
  });

  it("invents nothing: no prices, formats, licences, ratings or checkout", async () => {
    const html = await render("monthly-content-calendar");
    expect(html).not.toMatch(/\$\d/);
    expect(html).not.toMatch(/<dt[^>]*>(File formats|Compatibility|Requirements|License)<\/dt>/);
    expect(html).not.toMatch(/add to cart|buy now|checkout|★|rating/i);
    expect(html).not.toMatch(/concept preview|marketplace preview/i);
  });

  it("has a gallery with thumbnails, full screen and an illustrative-artwork note", async () => {
    const html = await render("carousel-storytelling");
    expect(html).toContain('aria-label="Product gallery"');
    expect((html.match(/aria-label="Show image \d of 3"/g) ?? []).length).toBe(3);
    expect(html).toContain("Full screen");
    expect(html).toContain("Illustrative cover artwork");
  });

  it("shows three related products that link to their own pages", async () => {
    const html = await render("monthly-content-calendar");
    const list = html.match(/<ul aria-label="Related products"[\s\S]*?<\/ul>/)![0];
    expect((list.match(/<article/g) ?? []).length).toBe(3);
    expect(list).toContain('href="/digital-products/campaign-workbook"');
    expect(list).not.toContain('href="/digital-products/monthly-content-calendar"');
  });

  it("returns a 404 for unknown slugs", async () => {
    const { default: Page } = await page();
    await expect(Page({ params: Promise.resolve({ slug: "does-not-exist" }) })).rejects.toThrow();
  });
});

describe("product page SEO", () => {
  it("prerenders every product, with titles and descriptions within limits, a canonical and noindex", async () => {
    const { generateMetadata, generateStaticParams } = await page();
    expect((await generateStaticParams()).map((x) => x.slug)).toEqual(PREVIEW_PRODUCTS.map((p) => p.id));
    for (const p of PREVIEW_PRODUCTS) {
      const m = await generateMetadata({ params: Promise.resolve({ slug: p.id }) });
      const title = (m.title as { absolute: string }).absolute;
      expect(title.length, p.id).toBeLessThanOrEqual(60);
      expect(m.description!.length, p.id).toBeGreaterThanOrEqual(120);
      expect(m.description!.length, p.id).toBeLessThanOrEqual(175);
      expect(m.alternates?.canonical).toBe(productHref(p));
      expect(m.robots).toEqual({ index: false, follow: true });
    }
  });

  it("keeps product pages out of the sitemap while the catalog is a preview", async () => {
    expect((await sitemap()).some((e) => e.url.includes("/digital-products/"))).toBe(false);
  });

  it("the proxy 404s unknown product slugs and lets real ones through", async () => {
    const { proxy } = await import("@/proxy");
    const ok = await proxy(new NextRequest("http://localhost:3000/digital-products/monthly-content-calendar"));
    expect(ok.headers.get("x-middleware-next")).toBe("1");
    const og = await proxy(new NextRequest("http://localhost:3000/digital-products/monthly-content-calendar/opengraph-image"));
    expect(og.headers.get("x-middleware-next")).toBe("1");
    const indexOg = await proxy(new NextRequest("http://localhost:3000/digital-products/opengraph-image"));
    expect(indexOg.headers.get("x-middleware-next")).toBe("1");
    const missing = await proxy(new NextRequest("http://localhost:3000/digital-products/does-not-exist"));
    expect(missing.headers.get("x-middleware-rewrite")).toContain("/__not-found");
  });
}, 60_000);
