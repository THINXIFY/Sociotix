import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TERMS_DESCRIPTION, TERMS_TITLE, TermsOfService } from "@/components/legal/terms-of-service";
import { JsonLd } from "@/components/seo/json-ld";
import { Footer } from "@/components/site/footer";
import { Header } from "@/components/site/public-header";
import { TERMS_PATH, termsPublished } from "@/lib/legal/terms";
import { breadcrumbs, graph, webPage } from "@/lib/seo/schema";
import { SITE } from "@/lib/seo/site";

const published = termsPublished();

export const metadata: Metadata = {
  title: { absolute: TERMS_TITLE },
  description: TERMS_DESCRIPTION,
  alternates: { canonical: TERMS_PATH },
  // Draft terms are never indexed; publishing (src/lib/legal/terms.ts) makes them indexable.
  ...(published ? {} : { robots: { index: false, follow: false } }),
  openGraph: { type: "website", url: TERMS_PATH, siteName: SITE.name, title: TERMS_TITLE, description: TERMS_DESCRIPTION },
  twitter: { card: "summary", title: TERMS_TITLE, description: TERMS_DESCRIPTION },
};

export default function TermsPage() {
  // Unapproved terms are never served in production.
  if (!published && process.env.APP_ENV === "production") notFound();
  return (
    <>
      <Header page="other" />
      <main id="main">
        <TermsOfService />
      </main>
      <Footer page="other" />
      <JsonLd
        data={graph(
          webPage({ path: TERMS_PATH, name: TERMS_TITLE, description: TERMS_DESCRIPTION }),
          breadcrumbs([
            { name: SITE.name, path: "/" },
            { name: "Terms of Service", path: TERMS_PATH },
          ]),
        )}
      />
    </>
  );
}
