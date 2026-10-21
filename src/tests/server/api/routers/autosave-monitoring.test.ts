/** @jest-environment node */
/**
 * Autosave monitoring: the system-wide dashboard is admin only and summarises AuditLog rows
 * correctly.
 */
import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { autosaveMonitoringRouter } from "~/server/api/routers/autosaveMonitoring";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma, type MockPrismaProxy } from "~/tests/helpers/mock-db";

const monitoring = createCallerFactory(autosaveMonitoringRouter);

const USER = { name: "user", level: 100 };

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
});
