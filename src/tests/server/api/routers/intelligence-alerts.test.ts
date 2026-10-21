/** @jest-environment node */
// MC-17: the threshold alerts written by intelligence-alert-thresholds.ts have a reader. The
// nation's owner (or a privileged role) lists them, marks them read and dismisses them; other
// players get FORBIDDEN, signed-out callers UNAUTHORIZED, and the DB write is never reached.
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: { user: { findUnique: jest.fn() }, auditLog: { create: jest.fn() } },
  isDatabaseReadOnly: true,
}));
jest.mock("~/lib/auth", () => ({
  __esModule: true,
  isSystemOwner: () => false,
  UserManagementService: jest.fn(),
}));
jest.mock("~/lib/auth/system-owner-constants", () => ({
  __esModule: true,
  isSystemOwner: () => false,
}));

import { describe, it, expect } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { intelligenceRouter } from "~/server/api/routers/intelligence";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const COUNTRY = "country_owned";

const baseAlert = {
  countryId: COUNTRY,
  description: "Current value: 1.00",
  category: "ECONOMIC",
  alertType: "threshold_breach",
  currentValue: 1,
  expectedValue: 2,
  isResolved: false,
  resolvedAt: null,
};

const rows = [
  {
    ...baseAlert,
    id: "a_medium",
    title: "gdpGrowthRate breached medium threshold",
    severity: "MEDIUM",
    detectedAt: new Date("2026-10-04T00:00:00Z"),
    readAt: null,
  },
  {
    ...baseAlert,
    id: "a_critical",
    title: "\u{1F6A8} securityScore breached critical threshold",
    severity: "CRITICAL",
    detectedAt: new Date("2026-10-01T00:00:00Z"),
    readAt: new Date("2026-10-02T00:00:00Z"),
  },
];

function makeDb() {
  return {
    user: {
      findUnique: jest.fn(async ({ where }: { where: { clerkUserId: string } }) =>
        where.clerkUserId === "owner_clerk"
          ? { id: "owner_db", countryId: COUNTRY, role: { name: "member" } }
          : { id: "other_db", countryId: "country_other", role: { name: "member" } }
      ),
      update: jest.fn(async () => ({})),
    },
    country: { findUnique: jest.fn(async () => ({ id: COUNTRY })) },
    intelligenceAlert: {
      findMany: jest.fn(async (_args: object) => rows),
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        const row = rows.find((r) => r.id === where.id);
        return row
          ? {
              id: row.id,
              countryId: row.countryId,
              readAt: row.readAt,
              isResolved: row.isResolved,
            }
          : null;
      }),
      count: jest.fn(async ({ where }: { where: Record<string, unknown> }) =>
        "readAt" in where ? 1 : 2
      ),
      update: jest.fn(async (_args: object) => ({})),
      updateMany: jest.fn(async (_args: object) => ({ count: 1 })),
    },
  };
}

type Db = ReturnType<typeof makeDb>;

const ctxFor = (db: Db, who: "owner" | "other" | "admin" | "signedOut") => {
  if (who === "signedOut") return createMockRouterContext({ db, auth: null, user: null }) as never;
  const user = {
    owner: {
      id: "owner_db",
      clerkUserId: "owner_clerk",
      countryId: COUNTRY,
      role: { name: "member" },
    },
    other: {
      id: "other_db",
      clerkUserId: "other_clerk",
      countryId: "country_other",
      role: { name: "member" },
    },
    admin: { id: "admin_db", clerkUserId: "admin_clerk", countryId: null, role: { name: "admin" } },
  }[who];
  return createMockRouterContext({ db, auth: { userId: user.clerkUserId }, user }) as never;
};

const caller = createCallerFactory(intelligenceRouter);

describe("intelligence alerts (MC-17)", () => {
  it("lets a privileged role read any nation's alerts", async () => {
    const db = makeDb();
    await expect(
      caller(ctxFor(db, "admin")).getMyAlerts({ countryId: COUNTRY })
    ).resolves.toBeDefined();
  });
  it.each([
    ["getMyAlerts", (c: any) => c.getMyAlerts({ countryId: COUNTRY })],
    ["markAlertRead", (c: any) => c.markAlertRead({ id: "a_medium" })],
    ["markAllAlertsRead", (c: any) => c.markAllAlertsRead({ countryId: COUNTRY })],
    ["dismissAlert", (c: any) => c.dismissAlert({ id: "a_medium" })],
  ])("%s: other players get FORBIDDEN, signed-out callers UNAUTHORIZED", async (_n, call) => {
    const db = makeDb();
    await expect(call(caller(ctxFor(db, "other")))).rejects.toMatchObject({ code: "FORBIDDEN" });
    // authMiddleware throws an AppError; the errorFormatter sends its code over the wire.
    await expect(call(caller(ctxFor(db, "signedOut")))).rejects.toMatchObject({
      cause: { code: "UNAUTHORIZED" },
    });
    expect(db.intelligenceAlert.update).not.toHaveBeenCalled();
    expect(db.intelligenceAlert.updateMany).not.toHaveBeenCalled();
  });
});
