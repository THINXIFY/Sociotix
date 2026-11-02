import "server-only";
import { eq } from "drizzle-orm";
import { productHref } from "@/lib/digital-products";
import { PRODUCT_SLUG_RE } from "@/lib/digital-products/admin";
import { getCustomerSession, getStaffSession } from "../auth";
import { allows } from "../auth/permissions";
import { hit } from "../auth/rate-limit";
import type { Db } from "../db/client";
import { digitalProducts } from "../db/schema";
import { customerCanAccess } from "./library";

/*
 * Who may download a product's files or follow its private links:
 *  - staff with Settings → View (to check what they uploaded, drafts included);
 *  - signed-in customers with a confirmed email, for a published, available, FREE product.
 * Paid products are never released: purchasing isn't open, and no purchase is ever assumed.
 */

export type DownloadDecision =
  | { ok: true; product: typeof digitalProducts.$inferSelect; who: "staff" | "customer"; userId: string }
  | { ok: false; reason: "not_found" | "sign_in" | "verify_email" | "paid" | "not_available"; productPath?: string };

export async function authorizeDownload(db: Db, slug: string): Promise<DownloadDecision> {
  if (!PRODUCT_SLUG_RE.test(slug) || slug.length > 80) return { ok: false, reason: "not_found" };
  const [product] = await db.select().from(digitalProducts).where(eq(digitalProducts.slug, slug));
  if (!product) return { ok: false, reason: "not_found" };

  const staff = await getStaffSession(db).catch(() => null);
  if (staff?.mfaComplete && staff.access && allows(staff.access, "settings:view")) return { ok: true, product, who: "staff", userId: staff.session.userId };

  // Drafts and archived products don't exist publicly.
  if (product.status !== "published") return { ok: false, reason: "not_found" };
  const productPath = productHref({ id: product.slug });
  if (product.pricing !== "free") return { ok: false, reason: "paid", productPath };
  if (product.availability !== "available") return { ok: false, reason: "not_available", productPath };
  const customer = await getCustomerSession(db).catch(() => null);
  if (!customer) return { ok: false, reason: "sign_in", productPath };
  if (!customer.session.user.emailVerifiedAt) return { ok: false, reason: "verify_email", productPath };
  // The checks above spell out why; this is the single rule the library uses too.
  if (!customerCanAccess(product)) return { ok: false, reason: "not_found" };
  return { ok: true, product, who: "customer", userId: customer.session.userId };
}

const MESSAGE: Record<Exclude<DownloadDecision, { ok: true }>["reason"], [number, string]> = {
  not_found: [404, "Not found"],
  sign_in: [401, "Sign in to download this product."],
  verify_email: [403, "Confirm your email address to download this product."],
  paid: [403, "This is a paid product and purchasing isn't open yet, so it can't be downloaded."],
  not_available: [403, "This product isn't released yet."],
};

const NO_STORE = { "cache-control": "private, no-store", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer", "x-robots-tag": "noindex, nofollow" };

/** The response for a refused download. Not signed in → the login page, returning here afterwards. */
export function refusal(request: Request, d: Exclude<DownloadDecision, { ok: true }>): Response {
  if (d.reason === "sign_in") {
    const here = new URL(request.url);
    const login = new URL("/login", here);
    login.searchParams.set("next", d.productPath ?? "/digital-products");
    return new Response(null, { status: 303, headers: { ...NO_STORE, location: login.pathname + login.search } });
  }
  const [status, text] = MESSAGE[d.reason];
  return new Response(text, { status, headers: { ...NO_STORE, "content-type": "text/plain; charset=utf-8" } });
}

export const downloadHeaders = NO_STORE;

/** Customers may download generously, but not flood the audit log: 120 downloads an hour. */
export async function downloadThrottle(db: Db, userId: string): Promise<Response | null> {
  const r = await hit(db, "digital-download", userId, { limit: 120, windowSeconds: 3600 });
  if (r.ok) return null;
  return new Response("Too many downloads in a short time. Please wait a few minutes and try again.", { status: 429, headers: { ...NO_STORE, "content-type": "text/plain; charset=utf-8", "retry-after": String(r.retryAfter) } });
}
