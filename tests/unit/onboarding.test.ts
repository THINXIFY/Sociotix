import { describe, expect, it } from "vitest";
import { cleanChoices, INTEREST_IDS, ONBOARDING_STATES, recommend } from "@/lib/onboarding";
import { ONBOARDING_INTEREST, ONBOARDING_STATE } from "@/server/db/schema/enums";

describe("onboarding", () => {
  it("mirrors the database's allowed values", () => {
    expect(INTEREST_IDS).toEqual([...ONBOARDING_INTEREST]);
    expect(ONBOARDING_STATES).toEqual(ONBOARDING_STATE);
  });

  it("suggests two or three steps that follow the chosen goals, without duplicates", () => {
    expect(recommend({ interests: [], platforms: [] })).toHaveLength(3);
    const one = recommend({ interests: ["ai"], platforms: [] });
    expect(one.length).toBeGreaterThanOrEqual(2);
    expect(one[0].href).toBe("/dashboard/ai/welcome");
    const many = recommend({ interests: ["services", "grow", "content"], platforms: [] });
    expect(many.map((r) => r.id)).toEqual(["finder", "calendar", "digital"]);
    for (const set of [one, many]) expect(new Set(set.map((r) => r.href.split("?")[0])).size).toBe(set.length);
  });

  it("starts the Service Finder on a single chosen platform and names up to two", () => {
    const [r] = recommend({ interests: ["grow"], platforms: ["tiktok"] });
    expect(r.href).toBe("/dashboard/service-finder?goal=audience&platform=tiktok");
    expect(r.title).toContain("TikTok");
    expect(recommend({ interests: ["grow"], platforms: ["tiktok", "youtube"] })[0].href).toBe("/dashboard/service-finder?goal=audience");
    expect(recommend({ interests: ["grow"], platforms: ["tiktok", "youtube", "x"] })[0].title).toBe("Find the right growth service");
  });

  it("labels what isn't switched on yet", () => {
    const all = recommend({ interests: ["content", "ai", "manage"], platforms: [] }, 6);
    expect(all.find((r) => r.id === "captions")?.status).toBe("soon");
    expect(all.find((r) => r.id === "ai")?.status).toBe("preview");
    for (const r of all) expect(r.note.length).toBeGreaterThan(5);
  });

  it("keeps only known choices", () => {
    expect(cleanChoices({ interests: ["manage", "x", "grow", 3], platforms: ["instagram", "nope", "instagram"] })).toEqual({ interests: ["grow", "manage"], platforms: ["instagram"] });
    expect(cleanChoices({ interests: "grow", platforms: null })).toEqual({ interests: [], platforms: [] });
  });
});
