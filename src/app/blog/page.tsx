import type { Metadata } from "next";
import { BLOG_DESCRIPTION, BLOG_TITLE, BlogHome } from "@/components/blog/blog-home";
import { JsonLd } from "@/components/seo/json-ld";
import { Footer } from "@/components/site/footer";
import { Header } from "@/components/site/public-header";
import { articleHref, BLOG_PATH } from "@/lib/blog";
import { breadcrumbs, graph, itemList, webPage } from "@/lib/seo/schema";
import { SITE } from "@/lib/seo/site";
import { allPublishedArticles, allVisibleArticles } from "@/server/blog/public";

export async function generateMetadata(): Promise<Metadata> {
  const published = await allPublishedArticles();
  return {
    title: { absolute: BLOG_TITLE },
    description: BLOG_DESCRIPTION,
    alternates: { canonical: BLOG_PATH },
    // An empty blog has no independent value yet: indexable once at least one article is published.
    ...(published.length ? {} : { robots: { index: false, follow: true } }),
    openGraph: { type: "website", url: BLOG_PATH, siteName: SITE.name, title: BLOG_TITLE, description: BLOG_DESCRIPTION },
    twitter: { card: "summary_large_image", title: BLOG_TITLE, description: BLOG_DESCRIPTION },
  };
}

export default async function BlogPage() {
  const [visible, published] = await Promise.all([allVisibleArticles(), allPublishedArticles()]);
  return (
    <>
      <Header page="other" />
      <main id="main">
        <BlogHome articles={visible} />
      </main>
      <Footer page="other" />
      <JsonLd
        data={graph(
          webPage({ path: BLOG_PATH, name: BLOG_TITLE, description: BLOG_DESCRIPTION, type: "CollectionPage" }),
          breadcrumbs([
            { name: SITE.name, path: "/" },
            { name: "Blog", path: BLOG_PATH },
          ]),
          // Published articles only; drafts are never described to search engines.
          ...(published.length ? [itemList("Sociotix Blog articles", published.map((a) => ({ name: a.title, path: articleHref(a) })))] : []),
        )}
      />
    </>
  );
}
