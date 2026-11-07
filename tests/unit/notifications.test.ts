import { describe, expect, it } from "vitest";
import { dayGroup, NOTIFICATION_KINDS, relativeTime } from "@/lib/notifications";
import { NOTIFICATION_KIND } from "@/server/db/schema/enums";

describe("notifications", () => {
  it("mirrors the database's categories", () => {
    expect(NOTIFICATION_KINDS.map((k) => k.id).sort()).toEqual([...NOTIFICATION_KIND].sort());
  });

  it("groups by day and phrases times relative to now", () => {
    const now = new Date(2026, 10, 8, 15, 0).getTime();
    const at = (d: number, h: number) => new Date(2026, 10, d, h, 0).toISOString();
    expect(dayGroup(at(8, 9), now)).toBe("Today");
    expect(dayGroup(at(7, 23), now)).toBe("Yesterday");
    expect(dayGroup(at(1, 12), now)).toBe("Earlier");
    expect(relativeTime(new Date(now - 30_000).toISOString(), now)).toBe("Just now");
    expect(relativeTime(new Date(now - 5 * 60_000).toISOString(), now)).toBe("5 min ago");
    expect(relativeTime(at(8, 12), now)).toBe("3 h ago");
    expect(relativeTime(at(7, 12), now)).toBe("Yesterday");
    expect(relativeTime(at(4, 12), now)).toBe("4 days ago");
  });
});
