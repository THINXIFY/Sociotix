import { type NextRequest, NextResponse } from "next/server";
import { AI_TOOL_BY_SLUG } from "./lib/ai/registry";
import { getArticle } from "./lib/blog";
import { HELP_ARTICLE_BY_SLUG } from "./lib/help/articles";
import { resolvePublicSlug } from "./server/blog/posts";
import { getDb } from "./server/db/client";
import { EnvError } from "./server/env";
import { AppError } from "./server/errors";

/**
 * Optimistic routing only (Next.js 16 Proxy). It looks at whether a session
 * cookie *exists* to redirect early and marks private responses no-store. It
 * is NOT the security boundary: every page, server action and route handler
 * validates the session and permissions against the database itself.
 */

const CUSTOMER_COOKIES = ["sv_session", "__Host-sv_session"];
const STAFF_COOKIES = ["sv_staff", "__Host-sv_staff"];
const ADMIN_PUBLIC = /^\/admin\/(login|setup|mfa)(\/|$)/;

/** Blog: file articles first; otherwise a live admin post, or an old slug that permanently redirects to its post. */
async function blogRoute(request: NextRequest, pathname: string) {
  const [slug, ...rest] = pathname.slice("/blog/".length).split("/");
  // The blog index's own social image lives at /blog/opengraph-image.
  if (getArticle(slug) || (slug === "opengraph-image" && !rest.length)) return NextResponse.next();
  try {
    const found = await resolvePublicSlug(getDb(), slug);
    if (found?.kind === "live") return NextResponse.next();
    if (found?.kind === "redirect") return NextResponse.redirect(new URL(["/blog", found.slug, ...rest].join("/"), request.url), 308);
  } catch (e) {
    // No database configured means no admin posts; an outage shouldn't turn live posts into 404s (the page decides from its cache).
    if (!(e instanceof EnvError || e instanceof AppError)) return NextResponse.next();
  }
  return NextResponse.rewrite(new URL("/__not-found", request.url));
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  // Public AI pages: unknown tools are a real 404 (streamed pages can't change status later); known ones pass through untouched and stay indexable.
  if (pathname.startsWith("/ai-tools/")) {
    // The first segment names the tool; deeper paths (e.g. its opengraph-image) are resolved, or 404'd, by Next itself.
    const slug = pathname.slice("/ai-tools/".length).split("/")[0];
    return Object.hasOwn(AI_TOOL_BY_SLUG, slug) ? NextResponse.next() : NextResponse.rewrite(new URL("/__not-found", request.url));
  }
  // Help articles (5G-A): same rule, so an unknown article is a real 404 on its very first request.
  if (pathname.startsWith("/help/")) {
    const slug = pathname.slice("/help/".length).split("/")[0];
    return Object.hasOwn(HELP_ARTICLE_BY_SLUG, slug) ? NextResponse.next() : NextResponse.rewrite(new URL("/__not-found", request.url));
  }
  // Blog articles: same rule; file drafts count as unknown wherever they aren't previewable (production).
  if (pathname.startsWith("/blog/")) return blogRoute(request, pathname);
  const has = (names: string[]) => names.some((n) => request.cookies.has(n));

  if (pathname.startsWith("/dashboard") && !has(CUSTOMER_COOKIES)) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  if (pathname.startsWith("/admin") && !ADMIN_PUBLIC.test(pathname) && !has(STAFF_COOKIES)) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  const res = NextResponse.next();
  // Never let a shared cache store a signed-in page or private API response.
  res.headers.set("Cache-Control", "private, no-store, max-age=0");
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  res.headers.set("Referrer-Policy", "same-origin");
  return res;
}

export const config = {
  matcher: ["/ai-tools/:path+", "/help/:path+", "/blog/:path+", "/dashboard/:path*", "/admin/:path*", "/api/account/:path*", "/api/admin/:path*", "/api/social/:path*", "/login", "/register", "/forgot-password", "/reset-password", "/verify-email", "/dev/:path*"],
};
