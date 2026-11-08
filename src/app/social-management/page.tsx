import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/json-ld";
import { Footer } from "@/components/site/footer";
import { Header } from "@/components/site/public-header";
import { SOCIAL_DESCRIPTION, SOCIAL_TITLE, SocialLanding, socialFaq } from "@/components/social/landing";
import { SOCIAL_ROUTES } from "@/lib/social/platforms";
import { breadcrumbs, faqPage, graph, webPage } from "@/lib/seo/schema";
import { SITE } from "@/lib/seo/site";
import { socialReadiness } from "@/server/social/readiness";

export const metadata: Metadata = {
  title: { absolute: SOCIAL_TITLE },
  description: SOCIAL_DESCRIPTION,
  alternates: { canonical: SOCIAL_ROUTES.landing },
  openGraph: { type: "website", url: SOCIAL_ROUTES.landing, siteName: SITE.name, title: "Sociotix Social Management — One workspace for your accounts", description: "Bring the social accounts you manage together in one calm, read-only dashboard." },
  twitter: { card: "summary_large_image", title: "Sociotix Social Management — One workspace for your accounts", description: "Bring the social accounts you manage together in one calm, read-only dashboard." },
};

export default function SocialManagementPage() {
  const ready = socialReadiness();
  return (
    <>
      <Header page="other" />
      <main id="main" className="cv-sections">
        <SocialLanding ready={ready} />
      </main>
      <Footer page="other" />
      {/* Matches the visible page: the FAQ answers word for word. No WebApplication: connections aren't live yet. */}
      <JsonLd
        data={graph(
          webPage({ path: SOCIAL_ROUTES.landing, name: SOCIAL_TITLE, description: SOCIAL_DESCRIPTION }),
          breadcrumbs([
            { name: SITE.name, path: "/" },
            { name: SITE.aiName, path: "/ai-tools" },
            { name: "Social Management", path: SOCIAL_ROUTES.landing },
          ]),
          faqPage(socialFaq(ready)),
        )}
      />
    </>
  );
}
