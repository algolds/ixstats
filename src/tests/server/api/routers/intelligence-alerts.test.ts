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
import { cleanAlertTitle, severityRank } from "~/server/api/routers/intelligence/alerts";
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
  it("lists the owner's open alerts, most severe first, with clean titles and counts", async () => {
    const db = makeDb();
    const result = await caller(ctxFor(db, "owner")).getMyAlerts({ countryId: COUNTRY });

    expect(result.alerts.map((a) => a.id)).toEqual(["a_critical", "a_medium"]);
    expect(result.alerts[0]!.title).toBe("securityScore breached critical threshold");
    expect(result.openCount).toBe(2);
    expect(result.unreadCount).toBe(1);
    expect(db.intelligenceAlert.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { countryId: COUNTRY, isActive: true, isResolved: false },
      })
    );
  });

  it("includes resolved alerts only when asked", async () => {
    const db = makeDb();
    await caller(ctxFor(db, "owner")).getMyAlerts({ countryId: COUNTRY, includeResolved: true });
    expect(db.intelligenceAlert.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { countryId: COUNTRY } })
    );
  });

  it("marks an unread alert read once, and leaves a read one alone", async () => {
    const db = makeDb();
    await caller(ctxFor(db, "owner")).markAlertRead({ id: "a_medium" });
    expect(db.intelligenceAlert.update).toHaveBeenCalledWith({
      where: { id: "a_medium" },
      data: { readAt: expect.any(Date) },
    });

    db.intelligenceAlert.update.mockClear();
    await caller(ctxFor(db, "owner")).markAlertRead({ id: "a_critical" });
    expect(db.intelligenceAlert.update).not.toHaveBeenCalled();
  });

  it("marks every unread open alert of the nation read", async () => {
    const db = makeDb();
    const result = await caller(ctxFor(db, "owner")).markAllAlertsRead({ countryId: COUNTRY });
    expect(result.count).toBe(1);
    expect(db.intelligenceAlert.updateMany).toHaveBeenCalledWith({
      where: { countryId: COUNTRY, isResolved: false, readAt: null },
      data: { readAt: expect.any(Date) },
    });
  });

  it("dismisses an alert by resolving it, keeping the first read time", async () => {
    const db = makeDb();
    await caller(ctxFor(db, "owner")).dismissAlert({ id: "a_critical" });
    expect(db.intelligenceAlert.update).toHaveBeenCalledWith({
      where: { id: "a_critical" },
      data: {
        isResolved: true,
        isActive: false,
        resolvedAt: expect.any(Date),
        readAt: rows[1]!.readAt,
      },
    });
  });

  it("lets a privileged role read any nation's alerts", async () => {
    const db = makeDb();
    await expect(
      caller(ctxFor(db, "admin")).getMyAlerts({ countryId: COUNTRY })
    ).resolves.toBeDefined();
  });

  it("returns NOT_FOUND for an unknown alert", async () => {
    const db = makeDb();
    // An unknown id has no country to check, so only a privileged caller reaches NOT_FOUND.
    await expect(caller(ctxFor(db, "admin")).dismissAlert({ id: "nope" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
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

describe("alert helpers", () => {
  it("strips a leading emoji from legacy titles", () => {
    expect(cleanAlertTitle("\u{1F6A8} tradeBalance breached high threshold")).toBe(
      "tradeBalance breached high threshold"
    );
    expect(cleanAlertTitle("plain title")).toBe("plain title");
  });

  it("ranks severities in either case, unknown last", () => {
    expect(severityRank("CRITICAL")).toBeLessThan(severityRank("high"));
    expect(severityRank("medium")).toBeLessThan(severityRank("LOW"));
    expect(severityRank("other")).toBe(4);
  });
});
