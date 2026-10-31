import Link from "next/link";
import { Ban, FileCheck2, Mail, RotateCcw, Scale, Sparkles, Users, Wallet } from "lucide-react";
import { B, External, type GlanceItem, LegalContactCard, LegalDocument, type LegalSection, legalLink, P, Pending, Status, UL, val } from "@/components/legal/legal-page";
import { PRIVACY_PATH } from "@/lib/legal/privacy";
import { LEGAL_CONTACT, REFUNDS_ANCHOR, TERMS, termsPublished } from "@/lib/legal/terms";

/*
 * Sociotix Terms of Service. Server-rendered; no client JavaScript.
 * Rules mirror the implementation (order cancellation, wallet, refunds review, disabled payments
 * and AI) and the Help Center; see docs/legal/SOCIOTIX_TERMS_OF_SERVICE_REPORT.md.
 * Owner-only details render as "REQUIRES OWNER APPROVAL" until set in src/lib/legal/terms.ts.
 */

export const TERMS_TITLE = "Terms of Service | Sociotix";
export const TERMS_DESCRIPTION =
  "The terms for using Sociotix: your account, social media services, orders, wallet, refunds and cancellations, AI tools, acceptable use and our responsibilities.";

const email = () => (LEGAL_CONTACT.email ? <a href={`mailto:${LEGAL_CONTACT.email}`} className={legalLink}>{LEGAL_CONTACT.email}</a> : <Pending>contact email</Pending>);
const privacy = (label = "Privacy Policy") => (
  <Link href={PRIVACY_PATH} className={legalLink}>
    {label}
  </Link>
);

function sections(): LegalSection[] {
  return [
    {
      id: "about",
      title: "About these terms",
      short: "These terms are the agreement between you and Sociotix when you use the website, your dashboard and our services.",
      body: (
        <>
          <P>
            Sociotix is a social growth and marketing platform: a marketplace for social media services, AI marketing tools, a workspace for managing social accounts, and marketing automation. These terms are an agreement between you and {val(LEGAL_CONTACT.name, "business name")} (&ldquo;Sociotix&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;).
          </P>
          <P>By creating an account or using Sociotix, you agree to these terms and to our {privacy()}. If you don&apos;t agree, please don&apos;t use Sociotix.</P>
          <P>Sociotix is still being built, so some features aren&apos;t switched on yet. We mark those clearly, and the parts of these terms that cover them apply once they&apos;re live.</P>
        </>
      ),
    },
    {
      id: "accounts",
      title: "Your account",
      short: "Keep your details accurate and your sign-in secure. You're responsible for what happens in your account.",
      body: (
        <UL>
          <li>Give accurate information when you sign up, and keep it up to date.</li>
          <li>Keep your password safe and don&apos;t share your account. We recommend turning on two-step verification where it&apos;s available.</li>
          <li>You&apos;re responsible for activity in your account. Tell us straight away at {email()} if you think someone else has accessed it.</li>
          <li>
            You can stop using Sociotix at any time. To close your account, email us. Self-service deletion isn&apos;t available yet (see our {privacy()}).
          </li>
          <li>We may suspend or close an account that breaks these terms, puts others at risk or is used unlawfully. Where it&apos;s appropriate, we&apos;ll tell you why.</li>
        </UL>
      ),
    },
    {
      id: "age",
      title: "Users of all ages",
      short: "Sociotix welcomes users of all ages. Where the law requires it, a parent or guardian needs to be involved for younger users.",
      body: (
        <>
          <P>Sociotix is for people of all ages. We don&apos;t set a minimum age, and we don&apos;t currently check ages or collect parental consent.</P>
          <UL>
            <li>
              Where the law requires it (for example, to agree to a contract or to share personal information), a younger user needs a parent&apos;s or guardian&apos;s permission. In that case, the parent or guardian accepts these terms on the younger user&apos;s behalf and is responsible for their use of Sociotix.
            </li>
            <li>We recommend that younger users use features involving money (orders and the wallet) with a parent or guardian.</li>
            <li>Social platforms you connect, and payment providers once payments are available, set their own age requirements. You must meet them to use those features or order a service for that platform.</li>
          </UL>
          <P>How we handle younger users&apos; information is explained in the {privacy("children section of our Privacy Policy")}.</P>
        </>
      ),
    },
    {
      id: "services",
      title: "Social media services",
      short: "Each service explains what's included and how it's delivered. Results are never guaranteed, and you must follow each platform's rules.",
      body: (
        <>
          <P>
            <Status live={false}>Ordering not open yet</Status>
            You can browse and compare services today. Each service becomes orderable only once its pricing, fulfilment and compliance are verified, and it then shows a price and a Ready to order label.
          </P>
          <UL>
            <li>Each service page explains what&apos;s included, how it&apos;s delivered and what you need to provide. Please read it before you order.</li>
            <li>
              <B>Results aren&apos;t guaranteed.</B> Outcomes such as reach, retention and timing depend on the platform, and platforms can change, limit or remove content and accounts at any time.
            </li>
            <li>You&apos;re responsible for making sure a service, and how you use it, fits the rules of the platform it&apos;s for.</li>
            <li>Give correct details, such as the right link, and keep the profile or post accessible while the order is delivered.</li>
            <li>We may decline or reject an order, for example if details are missing or the order would break these terms or a platform&apos;s rules.</li>
          </UL>
        </>
      ),
    },
    {
      id: "orders-and-payments",
      title: "Orders, wallet and payments",
      short: "Orders are paid from your Sociotix wallet. Payments aren't being taken yet, and prices only appear once they're set.",
      body: (
        <UL>
          <li>Orders are paid from your Sociotix wallet balance. The price is shown before you confirm, and we never display placeholder prices.</li>
          <li>
            <Status live={false}>Not active yet</Status>
            Adding funds needs an approved payment method, and none is active today. When one is, you&apos;ll pay through the payment provider, under its terms.
          </li>
          <li>Your wallet balance can be used for Sociotix services. Withdrawing it as cash isn&apos;t available.</li>
          <li>Every wallet change is kept as a permanent financial record, and you can see your transactions in your dashboard.</li>
        </UL>
      ),
    },
    {
      id: REFUNDS_ANCHOR,
      title: "Refunds and cancellations",
      short: "Cancel before work starts and the full amount goes back to your wallet. Once work has started, refunds are reviewed case by case and are never automatic.",
      body: (
        <>
          <UL>
            <li>
              <B>Cancelling:</B> you can cancel an order from your dashboard while it&apos;s Awaiting review or Needs your information. The full amount goes back to your wallet straight away.
            </li>
            <li>
              <B>Rejected or cancelled by us before work starts:</B> the full amount goes back to your wallet.
            </li>
            <li>
              <B>Failed orders:</B> if an order fails before work starts, the full amount goes back to your wallet. If it fails after work has started, our team reviews what you&apos;re owed.
            </li>
            <li>
              <B>After work has started:</B> an order can&apos;t be cancelled from your dashboard. Open a support ticket linked to the order, and our team will review it. Refunds at this stage aren&apos;t automatic, and nothing here promises one.
            </li>
            <li>
              <B>How refunds are paid:</B> approved refunds go back to your Sociotix wallet, never more than you paid for the order.
            </li>
          </UL>
          <P>
            Nothing in these terms limits any rights you have under consumer law where you live. For step-by-step help, see{" "}
            <Link href="/help/refunds-and-cancellations" className={legalLink}>
              How do refunds and cancellations work?
            </Link>
          </P>
        </>
      ),
    },
    {
      id: "ai-tools",
      title: "AI tools",
      short: "AI tools aren't generating content yet. When they do, check what they produce before you use it. You're responsible for what you publish.",
      body: (
        <>
          <P>
            <Status live={false}>Not active yet</Status>
            When Sociotix AI tools launch, these rules apply:
          </P>
          <UL>
            <li>AI results can be inaccurate, incomplete or similar to content made for others. Review and edit them before you use them.</li>
            <li>You&apos;re responsible for what you publish, including making sure it&apos;s accurate and follows the law and each platform&apos;s rules.</li>
            <li>Don&apos;t enter other people&apos;s personal information or anything confidential. We remove some personal details automatically, but please don&apos;t rely on that.</li>
            <li>Free daily allowances apply per account and reset at midnight UTC. We may change or limit them, for example to prevent abuse.</li>
            <li>AI tools can&apos;t post to your accounts, place orders or move money.</li>
          </UL>
        </>
      ),
    },
    {
      id: "acceptable-use",
      title: "Acceptable use",
      short: "Use Sociotix lawfully and fairly. Don't misuse it, harm others or try to break it.",
      body: (
        <>
          <P>When using Sociotix, you must not:</P>
          <UL>
            <li>break the law, or help anyone else to;</li>
            <li>promote content, accounts or links you don&apos;t have the right to promote;</li>
            <li>harass, deceive or harm others, or promote hateful, violent or sexual content involving minors;</li>
            <li>use Sociotix for fraud, spam or misleading activity;</li>
            <li>infringe anyone&apos;s intellectual property or privacy;</li>
            <li>try to access accounts or systems without permission, get around security or usage limits, or disrupt the service;</li>
            <li>copy, scrape or resell Sociotix, its catalog or its content without our written permission.</li>
          </UL>
          <P>If you break these rules, we may cancel orders, suspend or close your account, and report illegal activity to the authorities.</P>
        </>
      ),
    },
    {
      id: "privacy-and-third-parties",
      title: "Privacy and third-party services",
      short: "Our Privacy Policy explains how we handle your information. Social platforms and other providers have their own terms.",
      body: (
        <UL>
          <li>Our {privacy()} explains how we collect and use your information, and forms part of these terms.</li>
          <li>Social platforms (such as Instagram, TikTok, YouTube, Facebook, X and LinkedIn) have their own terms, and you must follow them. Sociotix isn&apos;t affiliated with or endorsed by these platforms.</li>
          <li>
            When YouTube connections are available, connecting YouTube means you also agree to the <External href="https://www.youtube.com/t/terms">YouTube Terms of Service</External>.
          </li>
          <li>We aren&apos;t responsible for what third-party platforms or providers do, such as changing their features, removing content or suspending accounts.</li>
        </UL>
      ),
    },
    {
      id: "liability",
      title: "Our responsibilities and liability",
      short: "We work hard to keep Sociotix reliable, but we can't promise it will always be available or error-free. Our liability is limited where the law allows.",
      body: (
        <>
          <UL>
            <li>Sociotix is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;. We don&apos;t promise it will always be uninterrupted or error-free, or that any service will achieve a particular result.</li>
            <li>We aren&apos;t liable for indirect or consequential losses, such as lost profits, lost followers or reputational harm, to the extent the law allows.</li>
            <li>
              Our total liability to you is limited to {val(TERMS.liabilityCap, "liability limit")}, to the extent the law allows.
            </li>
            <li>Nothing in these terms excludes or limits liability that can&apos;t be excluded or limited by law, or your statutory rights as a consumer.</li>
          </UL>
          <P>
            These terms are governed by {val(TERMS.governingLaw, "governing law and where disputes are heard")}. If you have a problem, please contact us first so we can try to resolve it.
          </P>
        </>
      ),
    },
    {
      id: "changes-and-contact",
      title: "Changes and contact",
      short: "We'll update these terms as Sociotix grows, and tell you before significant changes take effect.",
      body: (
        <>
          <P>
            The &ldquo;Last updated&rdquo; date at the top shows the current version. If we make significant changes, we&apos;ll tell you by email or in your dashboard before they take effect. If you keep using Sociotix after that, the updated terms apply.
          </P>
          <LegalContactCard
            icon={Mail}
            title="Questions about these terms"
            footnote={
              <>
                For help with orders or your account, the{" "}
                <Link href="/help" className={legalLink}>
                  Help Center
                </Link>{" "}
                is the fastest route.
              </>
            }
          >
            <div>
              <dt className="inline font-semibold text-foreground">Email: </dt>
              <dd className="inline">{email()}</dd>
            </div>
            <div>
              <dt className="inline font-semibold text-foreground">Business: </dt>
              <dd className="inline">{val(LEGAL_CONTACT.name, "business name")}</dd>
            </div>
            {LEGAL_CONTACT.address ? (
              <div>
                <dt className="inline font-semibold text-foreground">Address: </dt>
                <dd className="inline">{LEGAL_CONTACT.address}</dd>
              </div>
            ) : null}
          </LegalContactCard>
        </>
      ),
    },
  ];
}

const GLANCE: GlanceItem[] = [
  { icon: Users, text: "Sociotix welcomes all ages. Younger users may need a parent or guardian involved.", href: "#age" },
  { icon: FileCheck2, text: "Each service explains what's included. Results are never guaranteed.", href: "#services" },
  { icon: Wallet, text: "Orders are paid from your wallet. Payments aren't active yet.", href: "#orders-and-payments" },
  { icon: RotateCcw, text: "Cancel before work starts for a full return to your wallet.", href: `#${REFUNDS_ANCHOR}` },
  { icon: Sparkles, text: "Check AI results before you use them. You're responsible for what you publish.", href: "#ai-tools" },
  { icon: Ban, text: "Use Sociotix lawfully, and follow each platform's rules.", href: "#acceptable-use" },
  { icon: Scale, text: "Your rights under consumer law aren't affected.", href: "#liability" },
];

export function TermsOfService() {
  return (
    <LegalDocument
      label="Terms of Service"
      icon={FileCheck2}
      title="Clear Terms,"
      accent="Fair Use."
      intro="The rules for using Sociotix, written to be read: what you can expect from us, what we expect from you, and how orders, refunds and cancellations work."
      lastUpdated={TERMS.lastUpdated}
      published={termsPublished()}
      reviewNote="These terms aren't indexed, linked or served in production until they're approved. Items marked as needing owner approval must be confirmed first."
      contentsLabel="Terms of Service"
      glance={{ title: "Terms at a glance", items: GLANCE }}
      sections={sections()}
    />
  );
}
