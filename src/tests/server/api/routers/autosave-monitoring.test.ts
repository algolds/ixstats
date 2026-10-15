/** @jest-environment node */
/**
 * Autosave monitoring: the system-wide dashboard is admin only and summarises AuditLog rows
 * correctly.
 */
import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { autosaveMonitoringRouter } from "~/server/api/routers/autosaveMonitoring";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma, type MockPrismaProxy } from "~/tests/helpers/mock-db";

const monitoring = createCallerFactory(autosaveMonitoringRouter);

const USER = { name: "user", level: 100 };
const ADMIN = { name: "admin", level: 10 };

function ctx(db: MockPrismaProxy, id: string | null, role = USER, countryId = "country_mine") {
  return createMockRouterContext({
    db,
    auth: id ? { userId: `clerk_${id}` } : null,
    user: id ? { id, clerkUserId: `clerk_${id}`, countryId, role } : null,
    rateLimitIdentifier: `${id}_${Math.random()}`,
  }) as never;
}

let db: MockPrismaProxy;

beforeEach(() => {
  db = createMockPrisma();
  db.user.findUnique.mockResolvedValue(null);
  db.country.findUnique.mockResolvedValue({ id: "country_other", ownerUserId: "someone_else" });
  db.auditLog.count.mockResolvedValue(0);
  db.auditLog.groupBy.mockResolvedValue([]);
});

describe("autosaveMonitoring", () => {
  it("is admin only", async () => {
    const caller = monitoring(ctx(db, "u1"));
    await expect(caller.getSystemHealth()).rejects.toThrow(/Admin privileges required/);
    await expect(caller.getAutosaveStats({})).rejects.toThrow(/Admin privileges required/);
    await expect(caller.getActiveUsers({})).rejects.toThrow(/Admin privileges required/);
    expect(db.auditLog.findMany).not.toHaveBeenCalled();
  });

  it("computes success rate, average duration and section breakdown", async () => {
    db.auditLog.findMany.mockResolvedValue([
      { userId: "a", action: "autosave:tax", success: true, details: '{"duration":100}' },
      { userId: "a", action: "autosave:tax", success: false, details: "not json" },
      { userId: "b", action: "autosave:identity", success: true, details: '{"duration":300}' },
      { userId: null, action: "autosave:bogus", success: true, details: null },
    ]);

    const stats = await monitoring(ctx(db, "admin", ADMIN)).getAutosaveStats({ timeRange: "7d" });

    expect(stats.totalAutosaves).toBe(4);
    expect(stats.successRate).toBe(75);
    expect(stats.averageDuration).toBe(200);
    expect(stats.mostActiveUsers).toEqual([
      { userId: "a", count: 2 },
      { userId: "b", count: 1 },
    ]);
    expect(stats.sectionBreakdown).toEqual({ identity: 1, government: 0, tax: 2, economy: 0 });
  });

  it("buckets the time series by hour", async () => {
    db.auditLog.findMany.mockResolvedValue([
      { timestamp: new Date("2026-10-01T10:05:00Z"), success: true },
      { timestamp: new Date("2026-10-01T10:55:00Z"), success: false },
      { timestamp: new Date("2026-10-01T11:01:00Z"), success: true },
    ]);

    const { series } = await monitoring(ctx(db, "admin", ADMIN)).getAutosaveTimeSeries({
      granularity: "hour",
    });

    expect(series.map((s) => [s.count, s.successCount, s.failureCount])).toEqual([
      [2, 1, 1],
      [1, 1, 0],
    ]);
  });

  it("groups failures by error and section", async () => {
    db.auditLog.findMany.mockResolvedValue([
      { action: "autosave:tax", error: "timeout" },
      { action: "autosave:tax", error: "timeout" },
      { action: "autosave:government", error: null },
    ]);

    const analysis = await monitoring(ctx(db, "admin", ADMIN)).getFailureAnalysis({});

    expect(analysis.totalFailures).toBe(3);
    expect(analysis.errorTypes[0]).toEqual({
      type: "timeout",
      count: 2,
      percentage: (2 / 3) * 100,
    });
    expect(analysis.failedSections.map((s) => s.section)).toEqual(["tax", "government"]);
  });

  it("reports health from the last five minutes' failure rate", async () => {
    const admin = monitoring(ctx(db, "admin", ADMIN));

    db.auditLog.findMany.mockResolvedValue([]);
    await expect(admin.getSystemHealth()).resolves.toMatchObject({ status: "healthy" });

    db.auditLog.findMany.mockResolvedValue([
      { success: false, details: null },
      { success: true, details: null },
    ]);
    await expect(admin.getSystemHealth()).resolves.toMatchObject({ status: "critical" });

    db.auditLog.findMany.mockResolvedValue([{ success: true, details: '{"duration":9000}' }]);
    await expect(admin.getSystemHealth()).resolves.toMatchObject({
      status: "degraded",
      avgResponseTime: 9000,
    });
  });
});
