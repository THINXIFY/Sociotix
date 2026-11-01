import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleView } from "@/components/blog/article-view";
import { JsonLd } from "@/components/seo/json-ld";
import { Footer } from "@/components/site/footer";
import { Header } from "@/components/site/public-header";
import { ALL_ARTICLES, articleCategoryName, articleHref, isPublished } from "@/lib/blog";
import { blogPosting, breadcrumbs, graph, organization, webPage } from "@/lib/seo/schema";
import { absoluteUrl, SITE } from "@/lib/seo/site";
import { allVisibleArticles, findPublicArticle, liveAdminArticles } from "@/server/blog/public";

type Props = { params: Promise<{ slug: string }> };

/** File articles plus admin posts live at build time; posts published later render on first request (unknown slugs are 404'd by the proxy). */
export async function generateStaticParams() {
  return [...ALL_ARTICLES, ...(await liveAdminArticles())].map((a) => ({ slug: a.slug }));
}

/** Articles are fully prerendered, so the page blocks rather than streams; an unknown slug is then always a real 404. */
export const instant = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const a = await findPublicArticle((await params).slug);
  if (!a) return {};
  const path = articleHref(a);
  const title = a.seoTitle ?? `${a.title} | Sociotix Blog`;
  const description = a.metaDescription || a.description;
  return {
    title: { absolute: title },
    description,
    ...(a.keywords?.length ? { keywords: a.keywords } : {}),
    alternates: { canonical: path },
    // Drafts are previews only: never indexed.
    ...(isPublished(a) ? {} : { robots: { index: false, follow: false } }),
    openGraph: { type: "article", url: path, siteName: SITE.name, title: a.social?.title ?? a.title, description: a.social?.description ?? description, ...(a.publishedAt ? { publishedTime: a.publishedAt, modifiedTime: a.updatedAt ?? a.publishedAt } : {}), section: articleCategoryName(a), tags: a.tags },
    twitter: { card: "summary_large_image", title: a.social?.title ?? a.title, description: a.social?.description ?? description },
  };
}

export default async function ArticlePage({ params }: Props) {
  const a = await findPublicArticle((await params).slug);
  if (!a) notFound();
  const path = articleHref(a);
  const pool = await allVisibleArticles();
  return (
    <>
      <Header page="other" />
      <main id="main">
        <ArticleView a={a} url={absoluteUrl(path)} pool={pool} />
      </main>
      <Footer page="other" />
      {isPublished(a) ? (
        <JsonLd
          data={graph(
            organization(),
            webPage({ path, name: a.title, description: a.metaDescription || a.description }),
            blogPosting({ path, headline: a.title, description: a.metaDescription || a.description, datePublished: a.publishedAt!, dateModified: a.updatedAt, image: a.image?.src ?? `${path}/opengraph-image`, author: a.author, keywords: a.keywords?.length ? a.keywords : a.tags }),
            breadcrumbs([
              { name: SITE.name, path: "/" },
              { name: "Blog", path: "/blog" },
              { name: a.title, path },
            ]),
          )}
        />
      ) : null}
    </>
  );
}
