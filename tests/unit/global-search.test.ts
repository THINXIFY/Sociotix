import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { globalSearch, highlightParts, QUICK_LINKS, queryTerms } from "@/lib/global-search";

const first = (q: string, group: string) => globalSearch(q).groups.find((g) => g.group === group)?.items[0];
const everything = () => ["a", "e", "i", "o", "u", "s", "t", "instagram", "help", "order"].flatMap((q) => globalSearch(q).groups.flatMap((g) => g.items));

describe("global search", () => {
  it("finds services by name, platform, category and short forms; New Order opens with the service chosen", () => {
    const s = first("instagram followers", "services")!;
    expect(s.title).toMatch(/followers/i);
    expect(s.meta).toMatch(/^Instagram/);
    expect(s.href).toBe(`/dashboard/new-order?service=${encodeURIComponent(s.service!.id)}`);
    expect(first("ig likes", "services")?.meta).toMatch(/^Instagram/);
    expect(globalSearch("tiktok views").groups.find((g) => g.group === "services")!.items.every((i) => /tiktok/i.test(i.meta))).toBe(true);
  });

  it("finds AI tools, dashboard pages and help, each in its own group", () => {
    expect(first("caption", "tools")?.title).toBe("AI Caption Generator");
    expect(first("wallet", "pages")?.title).toMatch(/Add Funds|Transactions/);
    expect(first("password", "pages")?.href).toBe("/dashboard/security");
    expect(globalSearch("refund").groups.some((g) => g.group === "help")).toBe(true);
    expect(globalSearch("zzzz qqqq").groups).toHaveLength(0);
  });

  it("labels what isn't open yet instead of hiding it", () => {
    const tool = first("hashtag", "tools")!;
    expect(tool.badge).toBe("Coming soon");
  });

  it("caps each group and reports the full count", () => {
    const g = globalSearch("instagram").groups.find((x) => x.group === "services")!;
    expect(g.items.length).toBeLessThanOrEqual(6);
    expect(g.total).toBeGreaterThan(g.items.length);
  });

  it("only links to customer-facing pages that exist — never admin, API or dev routes", () => {
    const items = [...everything(), ...QUICK_LINKS];
    expect(items.length).toBeGreaterThan(20);
    for (const i of items) {
      expect(i.href).toMatch(/^\/(dashboard|ai-tools|help)(\/|\?|$)/);
      expect(i.href).not.toMatch(/^\/(admin|api|dev)/);
      if (i.group === "pages") expect(existsSync(join("src/app", i.href.split("?")[0], "page.tsx")), i.href).toBe(true);
    }
  });

  it("highlights word-start matches and treats the query as plain text", () => {
    expect(highlightParts("Instagram Followers", queryTerms("foll"))).toEqual([
      { text: "Instagram ", match: false },
      { text: "Foll", match: true },
      { text: "owers", match: false },
    ]);
    expect(queryTerms("(.*)[+?] $^")).toEqual([]);
    expect(() => globalSearch("a(b[c")).not.toThrow();
  });
});
