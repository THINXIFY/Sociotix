import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PlanComparison } from "@/components/ai-workspace/plans";

/* QA-03: a <dl> may only contain <dt>/<dd> groups, so the plan name on the mobile cards sits outside the list. */
describe("plan comparison markup", () => {
  const html = renderToStaticMarkup(h(PlanComparison));

  it("never puts a paragraph directly inside a description list", () => {
    expect(html).not.toMatch(/<dl[^>]*>\s*<p[\s>]/);
  });

  it("keeps every term and definition inside a description list", () => {
    const outside = html.replace(/<dl[\s\S]*?<\/dl>/g, "");
    expect(outside).not.toMatch(/<(dt|dd)[\s>]/);
  });

  it("still lists each plan's rows on the mobile cards", () => {
    expect((html.match(/<dl/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(html).toContain("Free");
  });
});
