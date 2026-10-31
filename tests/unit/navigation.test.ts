import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, prefetch: () => {} }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));

const { Header } = await import("@/components/site/header");
const { Footer } = await import("@/components/site/footer");
const { Faq } = await import("@/components/site/faq");
const { Providers } = await import("@/components/providers");

/* Functionality audit: public entry points are real links, never "coming soon" placeholders. */

describe("public navigation entry points", () => {
  it("header Log In and Sign Up link to the real auth pages", () => {
    const html = renderToStaticMarkup(createElement(Header, { page: "other" }));
    expect(html).toMatch(/<a[^>]+href="\/login"[^>]*>Log In<\/a>/);
    expect(html).toMatch(/<a[^>]+href="\/register"[^>]*>Sign Up<\/a>/);
    expect(html).not.toMatch(/coming next/i);
  });

  it("FAQ support actions go to support and the Help Center", () => {
    const html = renderToStaticMarkup(createElement(Faq));
    expect(html).toContain('href="/dashboard/support?new=1"');
    expect(html).toContain('href="/help"');
    expect(html).not.toMatch(/opens in the next phase|next build phase/i);
  });

  it("footer legal items aren't dead buttons: published pages are links, drafts are labelled 'Soon'", async () => {
    const { privacyPolicyPublished } = await import("@/lib/legal/privacy");
    const { termsPublished } = await import("@/lib/legal/terms");
    const html = renderToStaticMarkup(createElement(Providers, null, createElement(Footer, { page: "other" })));
    for (const l of ["Terms of Service", "Privacy Policy"]) {
      expect(html).not.toMatch(new RegExp(`<button[^>]*>${l}`));
      expect(html).toContain(l);
    }
    // Refunds and cancellations live in the Terms of Service; there's no separate refund policy.
    expect(html).not.toMatch(/Refund Policy|Return Policy/);
    expect(/href="\/privacy"/.test(html)).toBe(privacyPolicyPublished());
    expect(/href="\/terms"/.test(html)).toBe(termsPublished());
    expect(html).toContain('href="/help"');
  });
});

describe("More Solutions mega menu", async () => {
  const { SOLUTION_GROUPS } = await import("@/components/site/solutions-menu");
  const all = SOLUTION_GROUPS.flatMap((g) => g.items);

  it("is two compact groups: Explore Solutions and Your Workspace, on existing routes", () => {
    expect(SOLUTION_GROUPS.map((g) => [g.title, g.items.map((i) => `${i.label} ${i.href}`)])).toEqual([
      ["Explore Solutions", ["SMM Marketplace /#services", "AI Tools /ai-tools", "Social Management /social-management"]],
      ["Your Workspace", ["Social Workspace /dashboard/social", "AI Workspace /dashboard/ai", "Automations /dashboard/social/automations"]],
    ]);
  });

  it("lists each destination once, with a short one-line description", () => {
    expect(new Set(all.map((s) => s.href)).size).toBe(all.length);
    for (const s of all) expect(s.description.length, s.label).toBeLessThanOrEqual(40);
  });

  it("adds no top-level header item: still six, with More Solutions as a menu trigger", () => {
    const html = renderToStaticMarkup(createElement(Header, { page: "other" }));
    const primary = html.slice(html.indexOf('aria-label="Primary"'), html.indexOf("</nav>", html.indexOf('aria-label="Primary"')));
    expect((primary.match(/<li/g) ?? []).length).toBe(6);
    expect(primary).toMatch(/<button[^>]*>More Solutions/);
  });
});
