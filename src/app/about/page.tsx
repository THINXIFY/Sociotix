import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/json-ld";
import { ABOUT_DESCRIPTION, ABOUT_TITLE, AboutPage, aboutFaq } from "@/components/site/about";
import { Footer } from "@/components/site/footer";
import { Header } from "@/components/site/public-header";
import { SOCIAL_PLATFORMS } from "@/lib/social/platforms";
import { breadcrumbs, faqPage, graph, organization, webPage } from "@/lib/seo/schema";
import { SITE } from "@/lib/seo/site";
import { socialReadiness } from "@/server/social/readiness";

const OG_TITLE = "About Sociotix — Smarter Social. Bigger Impact.";
const OG_DESCRIPTION = "One platform for social media services, AI marketing tools, social media management and automation, honest about what's live today.";

export const metadata: Metadata = {
  title: { absolute: ABOUT_TITLE },
  description: ABOUT_DESCRIPTION,
  alternates: { canonical: "/about" },
  openGraph: { type: "website", url: "/about", siteName: SITE.name, title: OG_TITLE, description: OG_DESCRIPTION },
  twitter: { card: "summary_large_image", title: OG_TITLE, description: OG_DESCRIPTION },
};

export default function About() {
  const ready = socialReadiness();
  const liveSocial = SOCIAL_PLATFORMS.filter((p) => ready[p.id]).map((p) => p.name);
  return (
    <>
      <Header page="other" />
      <main id="main">
        <AboutPage liveSocial={liveSocial} />
      </main>
      <Footer page="other" />
      {/* AboutPage about the Organization (only facts the page shows). The FAQ matches the visible answers word for word. */}
      <JsonLd
        data={graph(
          organization(),
          webPage({ path: "/about", name: ABOUT_TITLE, description: ABOUT_DESCRIPTION, type: "AboutPage", about: true }),
          breadcrumbs([
            { name: SITE.name, path: "/" },
            { name: "About", path: "/about" },
          ]),
          faqPage(aboutFaq(liveSocial)),
        )}
      />
    </>
  );
}
