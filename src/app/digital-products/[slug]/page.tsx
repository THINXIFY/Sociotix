import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductView } from "@/components/digital-products/product-view";
import { JsonLd } from "@/components/seo/json-ld";
import { Footer } from "@/components/site/footer";
import { Header } from "@/components/site/public-header";
import { DIGITAL_PRODUCTS_PATH, type DigitalProduct, productHref } from "@/lib/digital-products";
import { breadcrumbs, graph, webPage } from "@/lib/seo/schema";
import { SITE } from "@/lib/seo/site";
import { findMarketplaceProduct, getMarketplace } from "@/server/digital-products/public";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return (await getMarketplace()).products.map((p) => ({ slug: p.id }));
}

/** Product pages are prerendered, so the page blocks rather than streams; unknown slugs are 404'd by the proxy. */
export const instant = false;

const titleOf = (p: DigitalProduct) => p.seoTitle || `${p.title} | Sociotix`;
const descriptionOf = (p: DigitalProduct, preview: boolean) => (preview ? `${p.description} ${p.type} from the Sociotix Digital Products Marketplace. Coming soon; purchasing isn't open yet.` : p.metaDescription || p.description);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const found = await findMarketplaceProduct((await params).slug);
  if (!found) return {};
  const { product: p, preview } = found;
  const path = productHref(p);
  const title = titleOf(p);
  const description = descriptionOf(p, preview);
  // The social image itself comes from ./opengraph-image (the product's own image when it has one).
  const social = p.social ?? {};
  return {
    title: { absolute: title },
    description,
    ...(p.keywords?.length ? { keywords: p.keywords } : {}),
    alternates: { canonical: path },
    // Concept previews stay out of search results; published products are indexable.
    ...(preview ? { robots: { index: false, follow: true } } : {}),
    openGraph: { type: "website", url: path, siteName: SITE.name, title: social.title || title, description: social.description || description },
    twitter: { card: "summary_large_image", title: social.title || title, description: social.description || description },
  };
}

export default async function ProductPage({ params }: Props) {
  const found = await findMarketplaceProduct((await params).slug);
  if (!found) notFound();
  const { product: p, products, preview } = found;
  const path = productHref(p);
  return (
    <>
      <Header page="other" />
      <main id="main" className="relative isolate">
        <ProductView product={p} products={products} preview={preview} />
      </main>
      <Footer page="other" />
      <JsonLd
        data={graph(
          webPage({ path, name: titleOf(p), description: descriptionOf(p, preview) }),
          breadcrumbs([
            { name: SITE.name, path: "/" },
            { name: "Digital Products", path: DIGITAL_PRODUCTS_PATH },
            { name: p.title, path },
          ]),
        )}
      />
    </>
  );
}
