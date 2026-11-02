import type { Metadata } from "next";
import { DigitalMarketplace } from "@/components/digital-products/marketplace";
import { JsonLd } from "@/components/seo/json-ld";
import { Footer } from "@/components/site/footer";
import { Header } from "@/components/site/public-header";
import { DIGITAL_PRODUCTS_PATH } from "@/lib/digital-products";
import { breadcrumbs, graph, webPage } from "@/lib/seo/schema";
import { SITE } from "@/lib/seo/site";
import { getMarketplace } from "@/server/digital-products/public";

const TITLE = "Digital Products Marketplace | Sociotix";
const DESCRIPTION = "Templates, prompts, planners, guides and creative toolkits for social media work, from Sociotix.";
const PREVIEW_DESCRIPTION = `${DESCRIPTION} Browse what is coming; purchasing opens soon.`;
const LIVE_DESCRIPTION = `${DESCRIPTION} Browse products and download the free ones.`;

export async function generateMetadata(): Promise<Metadata> {
  const { preview } = await getMarketplace();
  const description = preview ? PREVIEW_DESCRIPTION : LIVE_DESCRIPTION;
  return {
    title: { absolute: TITLE },
    description,
    alternates: { canonical: DIGITAL_PRODUCTS_PATH },
    // Concept listings have no independent value: indexable once real products are published.
    ...(preview ? { robots: { index: false, follow: true } } : {}),
    openGraph: { type: "website", url: DIGITAL_PRODUCTS_PATH, siteName: SITE.name, title: TITLE, description },
    twitter: { card: "summary_large_image", title: TITLE, description },
  };
}

export default async function DigitalProductsPage() {
  const { products, preview } = await getMarketplace();
  return (
    <>
      <Header page="other" />
      <main id="main">
        <DigitalMarketplace products={products} preview={preview} />
      </main>
      <Footer page="other" />
      <JsonLd
        data={graph(
          webPage({ path: DIGITAL_PRODUCTS_PATH, name: TITLE, description: preview ? PREVIEW_DESCRIPTION : LIVE_DESCRIPTION, type: "CollectionPage" }),
          breadcrumbs([
            { name: SITE.name, path: "/" },
            { name: "Digital Products", path: DIGITAL_PRODUCTS_PATH },
          ]),
        )}
      />
    </>
  );
}
