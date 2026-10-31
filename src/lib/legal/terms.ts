import { PRIVACY_POLICY, privacyPolicyPublished } from "./privacy";

/*
 * Publication gate and owner-only details for the Terms of Service (/terms).
 *
 * Approved and published by the owner on 2026-10-31 (effective 2026-11-01): governed by the
 * laws of Pakistan; liability limited to 12 months of payments. If set back to "draft": it renders outside production with a review banner and `noindex`,
 * returns 404 in production, stays out of the sitemap, isn't linked from the footer, and the old
 * refund-policy URLs don't redirect to it yet. Business name and contact come from the Privacy
 * Policy config so the two pages never disagree.
 */

export const TERMS = {
  status: "published" as "draft" | "published",
  /** ISO date (YYYY-MM-DD) the approved terms take effect. Never earlier than approval. */
  lastUpdated: "2026-11-01" as string | null,
  /** Which country's laws govern the terms and where disputes are heard, e.g. "the laws of England and Wales". */
  governingLaw: "the laws of Pakistan, and any disputes will be handled by the courts of Pakistan" as string | null,
  /** The limit on Sociotix's liability, e.g. "the amount you paid Sociotix in the 12 months before the claim". */
  liabilityCap: "the amount you paid Sociotix in the 12 months before the claim" as string | null,
};

export const TERMS_PATH = "/terms";
/** Anchor for refund and cancellation terms; old refund-policy URLs redirect here once published. */
export const REFUNDS_ANCHOR = "refunds-and-cancellations";
export const REFUND_POLICY_ALIASES = ["/refund", "/refunds", "/refund-policy", "/return-policy", "/returns", "/return-refund-policy"];

/** Business details shared with the Privacy Policy. */
export const LEGAL_CONTACT = { name: PRIVACY_POLICY.controllerName, email: PRIVACY_POLICY.privacyEmail, address: PRIVACY_POLICY.controllerAddress };

export function termsPublished(terms = TERMS): boolean {
  return terms.status === "published" && !!terms.lastUpdated && !!terms.governingLaw && !!terms.liabilityCap && privacyPolicyPublished();
}
