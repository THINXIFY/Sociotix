import type { MetadataRoute } from "next";
import { isIndexableTool } from "@/lib/ai/guides";
import { AI_TOOLS, aiToolHref } from "@/lib/ai/registry";
import { AI_ROUTES } from "@/lib/ai/workspace";
import { articleHref, BLOG_PATH } from "@/lib/blog";
import { DIGITAL_PRODUCTS_PATH, productHref } from "@/lib/digital-products";
import { HELP_ARTICLES, helpHref } from "@/lib/help/articles";
import { PRIVACY_PATH, privacyPolicyPublished } from "@/lib/legal/privacy";
import { TERMS_PATH, termsPublished } from "@/lib/legal/terms";
import { SOCIAL_ROUTES } from "@/lib/social/platforms";
import { absoluteUrl } from "@/lib/seo/site";
import { allPublishedArticles } from "@/server/blog/public";
import { liveDigitalProducts } from "@/server/digital-products/public";

/**
 * XML sitemap (SEO-01): only canonical, indexable public pages. Tool pages
 * without a guide are noindex and left out. No lastmod, changefreq or
 * priority: Google ignores the latter two, and lastmod is only useful when
 * it's accurate.
 */
/** The blog index and its articles (files and admin posts), once at least one is published. Drafts and scheduled posts never appear. */
async function blogPaths() {
  const published = await allPublishedArticles();
  return published.length ? [BLOG_PATH, ...published.map(articleHref)] : [];
}

/** The marketplace and its published products, once at least one is published. Drafts, archived products and concept previews never appear. */
async function digitalProductPaths() {
  const live = await liveDigitalProducts();
  return live.length ? [DIGITAL_PRODUCTS_PATH, ...live.map(productHref)] : [];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const tools = AI_TOOLS.filter((t) => isIndexableTool(t.id)).map((t) => aiToolHref(t));
  return ["/", "/about", "/media-kit", "/ai-tools", ...tools, SOCIAL_ROUTES.landing, AI_ROUTES.pricing, "/help", ...HELP_ARTICLES.map((a) => helpHref(a.slug)), ...(privacyPolicyPublished() ? [PRIVACY_PATH] : []), ...(termsPublished() ? [TERMS_PATH] : []), ...(await blogPaths()), ...(await digitalProductPaths())].map((path) => ({ url: absoluteUrl(path) }));
}
