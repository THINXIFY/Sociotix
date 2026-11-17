import { describe, expect, it } from "vitest";
import { buildBrandContext, contrastRatio, findAvoided, hasVoice, normalizeHex, normalizeWebsite, readableOn, summaryOf, type BrandView } from "@/lib/brand";

/* BR-01: the pure helpers behind the Brand Kit. */

const brand = (over: Partial<BrandView> = {}): BrandView => ({
  id: "b1",
  name: "Acme",
  description: "",
  website: null,
  industry: "",
  logoMediaId: null,
  coverMediaId: null,
  primaryColor: null,
  secondaryColor: null,
  accentColor: null,
  personality: [],
  toneOfVoice: "",
  audience: "",
  demographics: "",
  platforms: [],
  keywords: [],
  hashtags: [],
  writingGuidelines: "",
  preferredPhrases: [],
  avoidWords: [],
  isDefault: false,
  postCount: 0,
  version: 1,
  createdAt: "2030-01-01T00:00:00.000Z",
  updatedAt: "2030-01-01T00:00:00.000Z",
  ...over,
});

describe("colors", () => {
  it("normalises hex colors and rejects everything else", () => {
    expect(normalizeHex("#7047EB")).toBe("#7047eb");
    expect(normalizeHex("7047eb")).toBe("#7047eb");
    expect(normalizeHex(" #c8f ")).toBe("#cc88ff");
    for (const bad of ["", "#12345", "#1234567", "#ggg", "rgb(1,2,3)", "red", "#7047eb; background:url(x)", null, undefined]) expect(normalizeHex(bad as string)).toBeNull();
  });

  it("measures contrast and picks readable text", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(contrastRatio("#7047eb", "#7047eb")).toBeCloseTo(1, 5);
    expect(readableOn("#7047eb")).toBe("#ffffff");
    expect(readableOn("#c8ff52")).toBe("#111111");
    expect(readableOn("#ffffff")).toBe("#111111");
    expect(readableOn("#000000")).toBe("#ffffff");
  });
});

describe("websites", () => {
  it("accepts web addresses and adds https", () => {
    expect(normalizeWebsite("example.com")).toBe("https://example.com");
    expect(normalizeWebsite(" https://www.example.com/shop/ ")).toBe("https://www.example.com/shop");
    expect(normalizeWebsite("http://example.co.uk/a?b=1")).toBe("http://example.co.uk/a?b=1");
    expect(normalizeWebsite("")).toBeNull();
  });

  it("refuses anything that is not an http(s) address", () => {
    for (const bad of ["javascript:alert(1)", "data:text/html,hi", "ftp://example.com", "file:///etc/passwd", "localhost", "not a url", "https://user:pw@example.com"]) expect(normalizeWebsite(bad), bad).toBeNull();
  });
});

describe("words to avoid", () => {
  it("finds whole words in any case and ignores parts of other words", () => {
    expect(findAvoided("Our CHEAP deals, and a discount!", ["cheap", "discount", "free"])).toEqual(["cheap", "discount"]);
    expect(findAvoided("Cheaper than ever", ["cheap"])).toEqual([]);
    expect(findAvoided("a.b (c+d) $5", ["a.b", "c+d", "$5"])).toEqual(["a.b", "c+d", "$5"]);
    expect(findAvoided("café crème", ["café"])).toEqual(["café"]);
    expect(findAvoided("", ["x"])).toEqual([]);
    expect(findAvoided("x", [])).toEqual([]);
  });
});

describe("structured context", () => {
  it("carries the brand's voice and rules and nothing private", () => {
    const b = brand({ name: "Bean", industry: "Food", personality: ["Warm"], toneOfVoice: "Kind", audience: "Students", platforms: ["instagram"], avoidWords: ["cheap"], preferredPhrases: ["fresh"], writingGuidelines: "Short.", hashtags: ["bean"], keywords: ["coffee"], logoMediaId: "00000000-0000-0000-0000-000000000001" });
    const ctx = buildBrandContext(b);
    expect(ctx).toMatchObject({ brandId: "b1", name: "Bean", personality: ["Warm"], toneOfVoice: "Kind", audience: "Students", platforms: ["instagram"], writing: { guidelines: "Short.", preferredPhrases: ["fresh"], avoidWords: ["cheap"] } });
    // No customer, media or bookkeeping fields leak into the context.
    expect(Object.keys(ctx).sort()).toEqual(["audience", "brandId", "demographics", "description", "hashtags", "industry", "keywords", "name", "personality", "platforms", "toneOfVoice", "website", "writing"]);
  });

  it("knows when a brand has no voice yet", () => {
    expect(hasVoice(brand())).toBe(false);
    expect(hasVoice(brand({ avoidWords: ["x"] }))).toBe(true);
    expect(summaryOf(brand({ name: "S", isDefault: true, primaryColor: "#112233", postCount: 3 }))).toEqual({ id: "b1", name: "S", isDefault: true, primaryColor: "#112233", logoMediaId: null, postCount: 3 });
  });
});
