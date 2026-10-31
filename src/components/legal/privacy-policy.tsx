import Link from "next/link";
import { Ban, Cookie, CreditCard, Link2, Mail, ShieldCheck, Sparkles, UserCheck, Users } from "lucide-react";
import { B, External, type GlanceItem, H3, LegalDocument, type LegalSection, legalLink, P, Pending, Status, UL, val } from "@/components/legal/legal-page";
import { PRIVACY_POLICY, privacyPolicyPublished } from "@/lib/legal/privacy";

/*
 * Sociotix Privacy Policy. Server-rendered; no client JavaScript.
 * Every statement reflects the current implementation (verified in
 * docs/legal/SOCIOTIX_PRIVACY_POLICY_REPORT.md). Features that aren't live say so.
 * Owner-only details come from src/lib/legal/privacy.ts and are never invented.
 */

export const PRIVACY_TITLE = "Privacy Policy | Sociotix";
export const PRIVACY_DESCRIPTION =
  "How Sociotix collects, uses, protects and shares personal information, which cookies it uses, how AI and social features handle data, and the choices you have.";

const link = legalLink;

/** The privacy contact as a mailto link (or a marker if it isn't set). */
const privacyEmail = () => (PRIVACY_POLICY.privacyEmail ? <a href={`mailto:${PRIVACY_POLICY.privacyEmail}`} className={link}>{PRIVACY_POLICY.privacyEmail}</a> : <Pending>privacy contact email</Pending>);

/** Short name/purpose/duration rows for cookies and browser storage (a list, not a table). */
function StorageItem({ name, purpose, duration }: { name: React.ReactNode; purpose: string; duration: string }) {
  return (
    <div className="grid gap-1 border-b py-3.5 last:border-b-0 sm:grid-cols-[10rem_1fr] sm:gap-5">
      <dt className="font-medium text-foreground">{name}</dt>
      <dd className="text-[0.97rem] leading-relaxed text-foreground/80">
        {purpose} <span className="text-muted-foreground">{duration}</span>
      </dd>
    </div>
  );
}

function sections(): LegalSection[] {
  const p = PRIVACY_POLICY;
  return [
    {
      id: "who-we-are",
      title: "Who we are and what this policy covers",
      short: "Sociotix is responsible for your personal information. This policy explains what we collect, why, and the choices you have.",
      body: (
        <>
          <P>
            Sociotix is a social growth and marketing platform: a marketplace for social media services, AI marketing tools, a workspace for managing social accounts, and marketing automation. This policy covers the Sociotix website, your dashboard and our related services.
          </P>
          <P>
            The business responsible for your personal information is {val(p.controllerName, "legal business name")}
            {p.controllerAddress ? <>, {p.controllerAddress}</> : null}. You can reach us about privacy at {privacyEmail()}.
          </P>
          <P>
            Sociotix is still being built, so some features aren&apos;t switched on yet. We mark those clearly, and the policy explains what will happen once they are.
          </P>
        </>
      ),
    },
    {
      id: "information-we-collect",
      title: "What we collect",
      short: "What you give us when you use Sociotix, a little technical information to keep accounts secure, and essential cookies. No advertising or analytics tracking.",
      body: (
        <>
          <H3>Information you give us</H3>
          <UL>
            <li>
              <B>Account details:</B> your name, email address and password. We store a secure scrambled version of your password (a hash), never the password itself.
            </li>
            <li>
              <B>Profile details you choose to add:</B> such as your display name, country, business name, website or phone number, plus settings like your time zone and email preferences.
            </li>
            <li>
              <B>What you enter while using Sociotix:</B> order details (such as a link to the profile or post a service is for), support messages, drafts and content plans, and automations you set up.
            </li>
            <li>
              <B>Sign-in security:</B> if two-step verification is on for your account, its secret key and backup codes.
            </li>
            <li>
              <B>Referrals:</B> your referral code, and who referred you if you joined through someone&apos;s link.
            </li>
          </UL>
          <H3>Information collected automatically</H3>
          <UL>
            <li>
              <B>Sign-in sessions:</B> when you sign in, we record your browser type and, where our hosting provides it, your IP address. This keeps you signed in and helps us spot suspicious sign-ins.
            </li>
            <li>
              <B>Activity records:</B> order progress, support history, and a security log of important account actions (such as sign-ins and settings changes).
            </li>
            <li>
              <B>Abuse prevention:</B> short-lived counters that stop things like repeated emails or support tickets in a short time.
            </li>
          </UL>
          <H3 id="cookies">Cookies and browser storage</H3>
          <P>We only use what&apos;s needed to keep you signed in and remember your settings.</P>
          <dl className="mt-3">
            <StorageItem name={<code className="text-[0.9em]">sv_session</code>} purpose="Keeps you signed in. Page scripts can't read it." duration="Ends after 7 days of inactivity, or 30 days at most." />
            <StorageItem name={<code className="text-[0.9em]">sv_staff</code>} purpose="Keeps Sociotix staff signed in to the admin area." duration="Ends after 30 minutes of inactivity, or 12 hours at most." />
            <StorageItem name="Your preferences" purpose="Remembers choices like light or dark mode, saved in your own browser." duration="Until you clear it." />
            <StorageItem name="Unfinished forms" purpose="Keeps what you've typed in some forms while you move between steps." duration="Until you close the tab." />
          </dl>
          <P>
            We don&apos;t use analytics, advertising, remarketing or third-party cookies, so there&apos;s no cookie banner. If we ever wanted to add them, we&apos;d ask for your consent first where the law requires it, and update this policy.
          </P>
        </>
      ),
    },
    {
      id: "how-we-use-information",
      title: "How we use your information",
      short: "To run your account and orders, keep Sociotix safe, help you when you contact us, and meet our legal duties. Never for advertising, and we never sell it.",
      body: (
        <>
          <P>We use your information to:</P>
          <UL>
            <li>create and run your account, and deliver the features you use;</li>
            <li>process and track orders and wallet activity;</li>
            <li>answer support requests;</li>
            <li>send account, security and order emails;</li>
            <li>keep accounts and the platform secure, and prevent fraud and abuse;</li>
            <li>meet legal, tax and accounting duties, and handle disputes.</li>
          </UL>
          <P>
            Where privacy laws require a legal reason (a &ldquo;legal basis&rdquo;), we rely on: <B>our contract with you</B> (to provide Sociotix), <B>legitimate interests</B> (such as security and fraud prevention), <B>legal obligations</B> (such as keeping financial records), and <B>your consent</B> (for example when you connect a social account, which you can withdraw by disconnecting it).
          </P>
          <P>Which privacy laws apply depends on where you live, so some of this may not apply to you, or you may have extra rights.</P>
        </>
      ),
    },
    {
      id: "ai-tools",
      title: "AI tools",
      short: "AI tools aren't generating content yet. When they do, we'll remove personal details from your request first, and we won't store what you type or what's generated.",
      body: (
        <>
          <P>
            <Status live={false}>Not active yet</Status>
            Sociotix AI tools don&apos;t generate content today. Here&apos;s how they&apos;ll handle your information when they launch:
          </P>
          <UL>
            <li>
              <B>Personal details are removed first.</B> Before your request leaves Sociotix, we automatically strip email addresses, phone and card numbers, bank account numbers, and anything that looks like a password or secret key.
            </li>
            <li>
              <B>An AI provider creates the result.</B> We&apos;ll name the provider here, with a link to its terms, before AI tools launch.
            </li>
            <li>
              <B>We don&apos;t keep your request or the result.</B> We only record usage, such as which tool was used, when, how long the text was and whether it worked. That record is linked to a coded identifier rather than your name, so we can apply daily limits.
            </li>
            <li>
              <B>AI can&apos;t act for you.</B> It can&apos;t post to your accounts, place orders or move money, and we don&apos;t send your connected social account data to AI providers.
            </li>
          </UL>
        </>
      ),
    },
    {
      id: "social-connections",
      title: "Connected social accounts, including YouTube",
      short: "Connections are switching on platform by platform. They're read-only, we never see your password, and you can disconnect at any time.",
      body: (
        <>
          <P>
            <Status live={false}>Switching on per platform</Status>
            You&apos;ll be able to connect Instagram, Facebook Pages, TikTok, YouTube, X and LinkedIn accounts once each platform has approved Sociotix. When you connect one:
          </P>
          <UL>
            <li>You sign in on the platform&apos;s own page, so we never see your social media password.</li>
            <li>
              We store your profile name, handle and link, the permissions you gave, the figures the platform shares (such as followers or views) and the access keys it issues. <B>Access keys are encrypted before they&apos;re stored.</B>
            </li>
            <li>Access is read-only: Sociotix can&apos;t post, send messages, change your profile or run ads.</li>
            <li>When you disconnect, we delete the stored access keys straight away and ask the platform to remove our access where it allows.</li>
          </UL>

          <H3 id="google-user-data">YouTube and Google user data</H3>
          <P>
            <Status live={false}>Not active yet</Status>
            Connecting YouTube isn&apos;t available yet. When it is, Sociotix will use YouTube API Services, and the following applies:
          </P>
          <UL>
            <li>
              <B>What we request:</B> read-only access to your YouTube account (the <code className="text-[0.88em]">youtube.readonly</code> permission), so we can see your channel name and link, subscriber count, number of videos and total views. We can&apos;t upload, edit, comment or delete anything.
            </li>
            <li>
              <B>Why:</B> to show your channel alongside your other accounts in your Sociotix workspace.
            </li>
            <li>
              <B>How it&apos;s used and stored:</B> it&apos;s shown only to you in your workspace. Access keys are encrypted. It&apos;s never used for advertising, never sold, and never sent to AI providers. People at Sociotix look at it only if you ask us for help, for security reasons, or where the law requires.
            </li>
            <li>
              <B>Sharing:</B> it isn&apos;t shared with anyone, except the service providers that run Sociotix for us (such as hosting) or where the law requires.
            </li>
            <li>
              <B>Keeping it up to date and deleting it:</B> we refresh or delete stored YouTube data at least every 30 days. If you disconnect YouTube in Sociotix, we delete your YouTube data within 7 days. If you remove our access from your Google Account instead, we delete it within 30 days. You can also email {privacyEmail()} to have it deleted at any time, and we&apos;ll do so within 7 days.
            </li>
            <li>
              <B>Removing access:</B> you can remove Sociotix&apos;s access at any time from your{" "}
              <External href="https://security.google.com/settings/security/permissions">Google security settings</External>.
            </li>
          </UL>
          <P>
            By connecting YouTube, you agree to the <External href="https://www.youtube.com/t/terms">YouTube Terms of Service</External>. Google&apos;s use of your data is covered by the{" "}
            <External href="https://policies.google.com/privacy">Google Privacy Policy</External>. Sociotix&apos;s use and transfer of information received from Google APIs will adhere to the{" "}
            <External href="https://developers.google.com/terms/api-services-user-data-policy">Google API Services User Data Policy</External>, including the Limited Use requirements. Sociotix isn&apos;t affiliated with or endorsed by Google or YouTube.
          </P>
        </>
      ),
    },
    {
      id: "orders-and-payments",
      title: "Orders, payments and your wallet",
      short: "We keep records of your orders and wallet. Payments aren't being taken yet, and Sociotix will never store your card details.",
      body: (
        <UL>
          <li>
            <B>Orders:</B> the service, quantity, target link, price and each progress update, so you and our support team can see where an order stands.
          </li>
          <li>
            <B>Wallet:</B> every balance change is kept as a permanent financial record, which can&apos;t be edited or deleted.
          </li>
          <li>
            <Status live={false}>Not active yet</Status>
            <B>Payments:</B> no payment method is active today. When one is, you&apos;ll enter card or bank details with the payment provider, not with Sociotix. We&apos;ll keep only the amount, currency, method, status and the provider&apos;s reference.
          </li>
          <li>
            <Status live={false}>Not active</Status>
            <B>Referral rewards:</B> referral links are recorded, but rewards are switched off.
          </li>
        </UL>
      ),
    },
    {
      id: "sharing",
      title: "Who we share information with",
      short: "Only the service providers that help us run Sociotix, the platforms you choose to connect, or authorities when the law requires it. We don't sell personal information.",
      body: (
        <>
          <UL>
            <li>
              <B>Service providers</B> that run parts of Sociotix for us: hosting and database, email delivery and, once those features launch, AI, payments and social media service suppliers. Suppliers receive only what an order needs, such as the target link and quantity. We&apos;ll name these providers here before Sociotix launches.
            </li>
            <li>
              <B>Social platforms you connect</B>, to authorize the connection and return the data you&apos;ve allowed.
            </li>
            <li>
              <B>Authorities or others</B> when the law requires it, or to protect people&apos;s rights and safety.
            </li>
            <li>
              <B>A buyer or successor</B> if Sociotix is merged or sold. We&apos;d tell you first.
            </li>
          </UL>
          <P>We don&apos;t sell personal information and don&apos;t share it for advertising.</P>
          <P>
            <B>International transfers:</B> our providers may process information in other countries. We&apos;ll list where Sociotix stores data before launch, and where the law requires it, we&apos;ll use recognised safeguards such as standard contractual clauses.
          </P>
        </>
      ),
    },
    {
      id: "security-and-retention",
      title: "Security, retention and deletion",
      short: "We protect your information with strong safeguards, keep it only as long as needed, and delete or anonymize it when it's no longer required.",
      body: (
        <>
          <H3>How we protect it</H3>
          <UL>
            <li>Passwords and sign-in sessions are stored only in scrambled (hashed) form.</li>
            <li>Sensitive secrets, such as two-step verification keys and connected-account access keys, are encrypted.</li>
            <li>Sign-in cookies are protected from page scripts and cross-site use.</li>
            <li>Staff must use two-step verification, access is limited by role, and important actions are logged.</li>
          </UL>
          <P>No system is completely secure. If a breach affects your information, we&apos;ll tell you and the authorities where the law requires.</P>
          <H3>How long we keep it</H3>
          <UL>
            <li>
              <B>Your account:</B> while it&apos;s open. When it&apos;s closed, we delete or anonymize it, except what we must keep for the reasons below.
            </li>
            <li>
              <B>Financial records</B> (orders, wallet, payments): as long as tax, accounting and other laws require.
            </li>
            <li>
              <B>Support and security records:</B> as long as needed to help you, keep Sociotix secure and resolve disputes, then deleted.
            </li>
            <li>
              <B>AI requests and results</B> aren&apos;t stored at all. <B>Social access keys</B> are deleted as soon as you disconnect.
            </li>
          </UL>
          <H3>Deleting your account</H3>
          <P>
            You can&apos;t delete your account from your dashboard yet. Until you can, email {privacyEmail()} and we&apos;ll delete or anonymize your information, except what the law requires us to keep.
          </P>
        </>
      ),
    },
    {
      id: "children",
      title: "Users of all ages",
      short: "Sociotix welcomes people of all ages. Where the law requires it, younger users need a parent or guardian involved. We don't check ages or collect parental consent yet.",
      body: (
        <>
          <P>Sociotix is for everyone, whatever your age, and we don&apos;t set a minimum age. Privacy laws give children extra protection, so here&apos;s how it works today:</P>
          <UL>
            <li>
              <B>Younger users:</B> in some places, the law requires a parent or guardian to agree before a child shares personal information with an online service (for example under 13 in the US and UK, and under 13 to 16 in parts of Europe). If that applies to you, please use Sociotix with a parent or guardian, who can set up and look after your account with you. We also recommend using features that involve money (orders and the wallet) together.
            </li>
            <li>
              <B>No age checks yet:</B> Sociotix doesn&apos;t currently check ages or have a way to record a parent&apos;s consent. We&apos;ll update this section if we add them.
            </li>
            <li>
              <B>Other services have their own rules:</B> social platforms you connect, and payment providers once payments are available, may set their own age requirements. You&apos;ll need to meet them to use those features.
            </li>
            <li>
              <B>Parents and guardians:</B> email {privacyEmail()} to see, correct or delete your child&apos;s information. If we learn we&apos;ve collected a child&apos;s information without the consent the law requires, we&apos;ll delete it.
            </li>
          </UL>
        </>
      ),
    },
    {
      id: "your-rights",
      title: "Your rights, changes and contact",
      short: "Depending on where you live, you can see, correct, delete or download your information. Questions go to our privacy contact.",
      body: (
        <>
          <P>Depending on the laws that apply to you, you can ask to:</P>
          <UL>
            <li>see the personal information we hold about you and get a copy;</li>
            <li>correct it (you can update most profile details yourself in your settings);</li>
            <li>delete it;</li>
            <li>receive it in a format you can take elsewhere;</li>
            <li>object to or limit some uses, or withdraw consent (for example by disconnecting a social account).</li>
          </UL>
          <P>
            Email {privacyEmail()} to make a request. We may need to confirm it&apos;s you first, and we&apos;ll respond within the time the law requires. You can also complain to your local data protection authority.
          </P>
          <H3>Changes to this policy</H3>
          <P>The &ldquo;Last updated&rdquo; date at the top shows the current version. If we make significant changes, we&apos;ll tell you by email or in your dashboard before they take effect.</P>
          <div id="contact" className="mt-8 rounded-2xl border bg-card p-6 shadow-[0_18px_40px_-34px_rgb(112_71_235/0.5)] sm:p-7 dark:bg-white/[0.03]">
            <div className="flex items-start gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/[0.08] text-primary dark:bg-primary/20 dark:text-[#b9a6ff]">
                <Mail className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="font-heading text-[1.1rem] font-bold">Privacy questions and requests</p>
                <dl className="mt-3 space-y-2 text-[0.98rem] leading-relaxed text-foreground/80">
                  <div>
                    <dt className="inline font-semibold text-foreground">Email: </dt>
                    <dd className="inline">{privacyEmail()}</dd>
                  </div>
                  <div>
                    <dt className="inline font-semibold text-foreground">Business: </dt>
                    <dd className="inline">{val(p.controllerName, "legal business name")}</dd>
                  </div>
                  {p.controllerAddress ? (
                    <div>
                      <dt className="inline font-semibold text-foreground">Address: </dt>
                      <dd className="inline">{p.controllerAddress}</dd>
                    </div>
                  ) : null}
                </dl>
                <p className="mt-4 text-[0.9rem] leading-relaxed text-muted-foreground">
                  For help with orders or your account, the{" "}
                  <Link href="/help" className={link}>
                    Help Center
                  </Link>{" "}
                  is the fastest route.
                </p>
              </div>
            </div>
          </div>
        </>
      ),
    },
  ];
}

/** The top-of-page summary: the essentials in one glance, each linking to the full detail. */
const GLANCE: GlanceItem[] = [
  { icon: Ban, text: "No advertising, no tracking, and we never sell your information.", href: "#how-we-use-information" },
  { icon: Cookie, text: "Only essential cookies, to keep you signed in.", href: "#cookies" },
  { icon: Sparkles, text: "AI tools won't store what you type, and personal details are removed first.", href: "#ai-tools" },
  { icon: Link2, text: "Social connections are read-only, and you can disconnect any time.", href: "#social-connections" },
  { icon: CreditCard, text: "Payments aren't active yet, and we'll never store your card details.", href: "#orders-and-payments" },
  { icon: UserCheck, text: "You can see, correct and delete your information.", href: "#your-rights" },
  { icon: Users, text: "Sociotix welcomes all ages. Younger users may need a parent or guardian involved.", href: "#children" },
];

export function PrivacyPolicy() {
  return (
    <LegalDocument
      label="Privacy Policy"
      icon={ShieldCheck}
      title="Your Privacy"
      accent="Matters."
      intro="Here's what happens to your information at Sociotix, in plain English: what we collect, why we need it, who helps us handle it, and how you stay in control."
      lastUpdated={PRIVACY_POLICY.lastUpdated}
      published={privacyPolicyPublished()}
      reviewNote="This version isn't indexed, linked or served in production until it's approved and the privacy contact is confirmed to be working."
      contentsLabel="Privacy Policy"
      glance={{ title: "Privacy at a glance", items: GLANCE }}
      sections={sections()}
    />
  );
}
