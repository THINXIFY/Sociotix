import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/json-ld";
import { MEDIA_KIT_DESCRIPTION, MEDIA_KIT_TITLE, MediaKit } from "@/components/media-kit/media-kit";
import { Footer } from "@/components/site/footer";
import { Header } from "@/components/site/public-header";
import { breadcrumbs, graph, organization, webPage } from "@/lib/seo/schema";
import { SITE } from "@/lib/seo/site";

export const metadata: Metadata = {
  title: { absolute: MEDIA_KIT_TITLE },
  description: MEDIA_KIT_DESCRIPTION,
  alternates: { canonical: "/media-kit" },
  openGraph: { type: "website", url: "/media-kit", siteName: SITE.name, title: MEDIA_KIT_TITLE, description: MEDIA_KIT_DESCRIPTION },
  twitter: { card: "summary_large_image", title: MEDIA_KIT_TITLE, description: MEDIA_KIT_DESCRIPTION },
};

export default function MediaKitPage() {
  return (
    <>
      <Header page="other" />
      <main id="main">
        <MediaKit />
      </main>
      <Footer page="other" />
      <JsonLd
        data={graph(
          organization(),
          webPage({ path: "/media-kit", name: MEDIA_KIT_TITLE, description: MEDIA_KIT_DESCRIPTION, about: true }),
          breadcrumbs([
            { name: SITE.name, path: "/" },
            { name: "Media Kit", path: "/media-kit" },
          ]),
        )}
      />
    </>
  );
}
