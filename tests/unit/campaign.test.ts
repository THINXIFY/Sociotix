import { describe, expect, it } from "vitest";
import { addDays, daysBetween, dueFrom, dueState, formatBudget, formatRange, isDate, milestoneProgress, parseBudget, percent, statusNote, structureOf, type CampaignView } from "@/lib/campaign";

/* CP-01: the pure helpers behind the Campaign Planner. */

describe("dates", () => {
  it("accepts only real calendar dates", () => {
    expect(isDate("2030-02-28")).toBe(true);
    expect(isDate("2028-02-29")).toBe(true);
    for (const bad of ["2030-02-29", "2030-13-01", "2030-1-1", "30-01-01", "", null, undefined, "1999-12-31", "2030-01-01T00:00"]) expect(isDate(bad as string), String(bad)).toBe(false);
  });

  it("does plain date arithmetic without time zones", () => {
    expect(addDays("2030-01-31", 1)).toBe("2030-02-01");
    expect(addDays("2030-03-01", -1)).toBe("2030-02-28");
    expect(daysBetween("2030-03-30", "2030-04-02")).toBe(3);
    expect(dueFrom("2030-01-01", 9)).toBe("2030-01-10");
    expect(dueFrom(null, 9)).toBeNull();
    expect(dueFrom("2030-01-01", null)).toBeNull();
    expect(formatRange(null, null)).toBe("No dates yet");
    expect(formatRange("2030-01-01", null)).toBe("From Jan 1, 2030");
  });

  it("classifies due dates relative to today", () => {
    const today = "2030-05-10";
    expect(dueState("2030-05-09", today)).toBe("overdue");
    expect(dueState("2030-05-10", today)).toBe("today");
    expect(dueState("2030-05-17", today)).toBe("soon");
    expect(dueState("2030-05-18", today)).toBe("later");
    expect(dueState(null, today)).toBe("none");
    expect(dueState("2030-05-01", today, true)).toBe("none");
  });

  it("notes when a status no longer matches the dates, without changing it", () => {
    const today = "2030-05-10";
    expect(statusNote({ status: "active", startDate: "2030-05-01", endDate: "2030-05-31" }, today)).toBeNull();
    expect(statusNote({ status: "active", startDate: "2030-05-01", endDate: "2030-05-09" }, today)).toMatch(/end date has passed/);
    expect(statusNote({ status: "planned", startDate: "2030-05-01", endDate: null }, today)).toMatch(/start date has passed/);
    expect(statusNote({ status: "completed", startDate: "2030-01-01", endDate: "2030-01-02" }, today)).toBeNull();
  });
});

describe("progress", () => {
  it("is counted only from real tasks", () => {
    expect(percent(0, 0)).toBeNull();
    expect(percent(1, 3)).toBe(33);
    const tasks = [
      { milestoneId: "m1", completedAt: "x" },
      { milestoneId: "m1", completedAt: null },
      { milestoneId: "m2", completedAt: "x" },
    ];
    expect(milestoneProgress("m1", tasks)).toEqual({ total: 2, done: 1, reached: false });
    expect(milestoneProgress("m2", tasks)).toEqual({ total: 1, done: 1, reached: true });
    expect(milestoneProgress("m3", tasks)).toEqual({ total: 0, done: 0, reached: false });
  });
});

describe("budget", () => {
  it("parses customer-entered amounts and formats them", () => {
    expect(parseBudget("")).toBeNull();
    expect(parseBudget("1,250.5")).toBe(125050);
    expect(parseBudget("99")).toBe(9900);
    for (const bad of ["-1", "1.234", "abc", "1e5", "9999999999"]) expect(parseBudget(bad), bad).toBeNaN();
    expect(formatBudget(125050, "USD")).toBe("$1,250.50");
    expect(formatBudget(100000, "EUR")).toBe("€1,000");
  });
});

describe("templates", () => {
  it("turns due dates into offsets from the start date", () => {
    const c: Pick<CampaignView, "startDate" | "milestones" | "tasks"> = {
      startDate: "2030-01-01",
      milestones: [
        { id: "b", title: "Second", dueDate: null, position: 1, version: 1 },
        { id: "a", title: "First", dueDate: "2030-01-05", position: 0, version: 1 },
      ],
      tasks: [
        { id: "t2", milestoneId: null, title: "Loose", notes: "", dueDate: null, priority: "low", completedAt: "x", position: 1, version: 1 },
        { id: "t1", milestoneId: "b", title: "Do", notes: "n", dueDate: "2029-12-31", priority: "high", completedAt: null, position: 0, version: 1 },
      ],
    };
    expect(structureOf(c)).toEqual({
      milestones: [
        { title: "First", offsetDays: 4 },
        { title: "Second", offsetDays: null },
      ],
      tasks: [
        { title: "Do", notes: "n", priority: "high", milestone: 1, offsetDays: -1 },
        { title: "Loose", notes: "", priority: "low", milestone: null, offsetDays: null },
      ],
    });
    expect(structureOf({ ...c, startDate: null }).milestones[0]!.offsetDays).toBeNull();
  });
});
