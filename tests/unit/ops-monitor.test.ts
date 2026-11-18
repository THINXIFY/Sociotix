import { describe, expect, it } from "vitest";
import { exitCode, gradeConnections, gradeFailedJobs, gradeStorage, gradeTls, gradeWeb, gradeWorker } from "../../scripts/ops/monitor";

/* OPS-02: alert thresholds used by `npm run ops:check`. */

describe("ops monitor thresholds", () => {
  it("web is ok only for 200 with status ok", () => {
    expect(gradeWeb(200, { status: "ok", checks: {} }).level).toBe("ok");
    expect(gradeWeb(503, { status: "degraded", checks: { database: "unreachable" } })).toMatchObject({ level: "fail", detail: expect.stringContaining("unreachable") });
    expect(gradeWeb(null, null)).toMatchObject({ level: "fail", detail: "unreachable" });
  });

  it("worker fails when stale, unknown or unreachable", () => {
    expect(gradeWorker(200, { worker: "ok" }).level).toBe("ok");
    for (const w of ["stale", "unknown"]) expect(gradeWorker(503, { worker: w })).toMatchObject({ level: "fail", detail: w });
    expect(gradeWorker(null, null).detail).toBe("unreachable");
  });

  it("TLS warns under 21 days and fails under 14 or when missing", () => {
    expect(gradeTls(60).level).toBe("ok");
    expect(gradeTls(20).level).toBe("warn");
    expect(gradeTls(13.9).level).toBe("fail");
    expect(gradeTls(null).level).toBe("fail");
  });

  it("any failed job in the last hour fails", () => {
    expect(gradeFailedJobs([]).level).toBe("ok");
    expect(gradeFailedJobs([{ name: "maintenance.verify-ledger", count: 2 }])).toMatchObject({ level: "fail", detail: "maintenance.verify-ledger=2" });
  });

  it("storage and connections warn at 80% and fail near the limit", () => {
    const mb = 1024 * 1024;
    expect(gradeStorage(500 * mb).level).toBe("ok");
    expect(gradeStorage(700 * mb, 1000).level).toBe("ok");
    expect(gradeStorage(800 * mb, 1000).level).toBe("warn");
    expect(gradeStorage(900 * mb, 1000).level).toBe("fail");
    expect(gradeConnections(50, 100).level).toBe("ok");
    expect(gradeConnections(80, 100).level).toBe("warn");
    expect(gradeConnections(95, 100).level).toBe("fail");
  });

  it("exit code: 0 ok, 1 warnings, 2 any failure", () => {
    const ok = gradeTls(60);
    expect(exitCode([ok])).toBe(0);
    expect(exitCode([ok, gradeTls(20)])).toBe(1);
    expect(exitCode([gradeTls(20), gradeTls(1)])).toBe(2);
  });
});
