/*
 * Publication gate and owner-supplied details for the Privacy Policy (/privacy).
 *
 * History: the first text was approved on 2026-10-31, effective 2026-11-01 (controller "Sociotix", contact
 * hello@sociotix.com, no minimum age, no address yet). The policy was then rewritten for
 * clarity (10 sections, Privacy at a Glance, expanded Google/YouTube and children's sections),
 * and the owner approved and published the revised text on 2026-10-31 (effective 2026-11-01),
 * confirming the privacy inbox works. If it's ever set back to "draft", it renders outside
 * production with a review banner and `noindex`, returns 404 in production, leaves the sitemap
 * and loses its footer link.
 */

export const PRIVACY_POLICY = {
  status: "published" as "draft" | "published",
  /** ISO date (YYYY-MM-DD) the approved text takes effect. Set when the revised text is approved; never earlier. */
  lastUpdated: "2026-11-01" as string | null,
  /** Name of the business responsible for personal data (the controller). */
  controllerName: "Sociotix" as string | null,
  /** Registered or postal address. Optional: when absent, the policy gives email-only contact. */
  controllerAddress: null as string | null,
  /** A monitored inbox for privacy requests. */
  privacyEmail: "hello@sociotix.com" as string | null,
  /**
   * The owner has confirmed the privacy inbox receives mail (confirmed 2026-10-31). Note: a DNS check
   * that day found no records for sociotix.com; the owner confirmed it works or will before launch.
   */
  contactVerified: true,
  /** Minimum age to create an account, or "none" when the owner sets no minimum (owner decision, 2026-11-01). */
  minimumAge: "none" as number | "none" | null,
};

export const PRIVACY_PATH = "/privacy";

export function privacyPolicyPublished(policy = PRIVACY_POLICY): boolean {
  return policy.status === "published" && !!policy.lastUpdated && !!policy.controllerName && !!policy.privacyEmail && policy.contactVerified && policy.minimumAge != null;
}
