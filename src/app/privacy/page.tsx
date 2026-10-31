import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PRIVACY_DESCRIPTION, PRIVACY_TITLE, PrivacyPolicy } from "@/components/legal/privacy-policy";
import { JsonLd } from "@/components/seo/json-ld";
import { Footer } from "@/components/site/footer";
import { Header } from "@/components/site/public-header";
import { PRIVACY_PATH, privacyPolicyPublished } from "@/lib/legal/privacy";
import { breadcrumbs, graph, webPage } from "@/lib/seo/schema";
import { SITE } from "@/lib/seo/site";

const published = privacyPolicyPublished();

export const metadata: Metadata = {
  title: { absolute: PRIVACY_TITLE },
  description: PRIVACY_DESCRIPTION,
  alternates: { canonical: PRIVACY_PATH },
  // A draft is never indexed; publishing (src/lib/legal/privacy.ts) makes it indexable.
  ...(published ? {} : { robots: { index: false, follow: false } }),
  openGraph: { type: "website", url: PRIVACY_PATH, siteName: SITE.name, title: PRIVACY_TITLE, description: PRIVACY_DESCRIPTION },
  twitter: { card: "summary", title: PRIVACY_TITLE, description: PRIVACY_DESCRIPTION },
};

export default function PrivacyPage() {
  // An unapproved legal document is never served in production.
  if (!published && process.env.APP_ENV === "production") notFound();
  return (
    <>
      <Header page="other" />
      <main id="main">
        <PrivacyPolicy />
      </main>
      <Footer page="other" />
      <JsonLd
        data={graph(
          webPage({ path: PRIVACY_PATH, name: PRIVACY_TITLE, description: PRIVACY_DESCRIPTION }),
          breadcrumbs([
            { name: SITE.name, path: "/" },
            { name: "Privacy Policy", path: PRIVACY_PATH },
          ]),
        )}
      />
    </>
  );
}
