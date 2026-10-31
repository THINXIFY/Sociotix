import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Select } from "@/components/ui/select";

/* The shared dropdown is a drop-in for <select>: same children, value semantics and form behaviour. */

const opts = (labels: string[], withValues = true) => labels.map((l) => h("option", { key: l, ...(withValues ? { value: l.toLowerCase() } : {}) }, l));

describe("shared Select", () => {
  it("shows the selected option's label in a labelled trigger", () => {
    const html = renderToStaticMarkup(h(Select, { id: "sort", value: "oldest", onChange: () => {}, "aria-label": "Sort" }, opts(["Newest", "Oldest"])));
    expect(html).toMatch(/<button[^>]*id="sort"/);
    expect(html).toContain('aria-label="Sort"');
    expect(html).toContain("Oldest");
    expect(html).not.toContain("<select");
  });

  it("uses an option's text as its value when it has no value attribute, like a native select", () => {
    const html = renderToStaticMarkup(h(Select, { value: "Canada", onChange: () => {}, name: "country" }, opts(["Brazil", "Canada"], false)));
    expect(html).toContain("Canada");
    expect(html).toMatch(/name="country"[^>]*value="Canada"|value="Canada"[^>]*name="country"/);
  });

  it("submits its value with forms (hidden input carries the name)", () => {
    const html = renderToStaticMarkup(h(Select, { defaultValue: "b", name: "choice" }, h("option", { value: "a" }, "A"), h("option", { value: "b" }, "B")));
    expect(html).toMatch(/<input[^>]*name="choice"/);
    expect(html).toContain("B");
  });

  it("switches long lists to the searchable variant and keeps the selected label", () => {
    const countries = Array.from({ length: 20 }, (_, i) => `Country ${String.fromCharCode(65 + i)}`);
    const html = renderToStaticMarkup(h(Select, { value: "Country C", onChange: () => {} }, opts(countries, false)));
    expect(html).toContain("Country C");
    expect(html).toMatch(/aria-haspopup="listbox"|role="combobox"/);
  });

  it("supports a custom trigger (icon-only controls) while keeping an accessible name", () => {
    const html = renderToStaticMarkup(h(Select, { value: "a", onChange: () => {}, "aria-label": "Sort services", trigger: h("span", null, "⇅") }, opts(["A", "B"])));
    expect(html).toContain('aria-label="Sort services"');
    expect(html).toContain("⇅");
  });
});
