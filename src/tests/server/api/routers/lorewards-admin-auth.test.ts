// `jest` is the ambient global (not imported from "@jest/globals") because the hoisted
// jest.mock() factory below calls jest.fn() inline; see trpc-impersonation.test.ts.
jest.mock("~/lib/lorewards", () => ({
  __esModule: true,
  fullSync: jest.fn().mockResolvedValue({ ok: true }),
  scoreDailyWikiOS: jest.fn().mockResolvedValue({ winner: null, runnerUp: null, candidates: [] }),
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { lorewardsAdminRouter } from "~/server/api/routers/lorewards/admin";
import { fullSync, scoreDailyWikiOS } from "~/lib/lorewards";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockDb } from "~/tests/helpers/transactional-mock-db";

const createCaller = createCallerFactory(lorewardsAdminRouter);

function userCaller() {
  return createCaller(
    createMockRouterContext({
      auth: { userId: "user_1" },
      user: { id: "db1", clerkUserId: "user_1", role: { name: "user", level: 100 } },
      db: createMockDb(),
    }) as never
  );
}

describe("WK-9: Lorewards admin procedures", () => {
  beforeEach(() => {
    (fullSync as jest.Mock).mockClear();
    (scoreDailyWikiOS as jest.Mock).mockClear();
  });

  it("rejects an ordinary user triggering a full sync", async () => {
    await expect(userCaller().triggerSync()).rejects.toThrow(/Admin privileges required/);
    expect(fullSync).not.toHaveBeenCalled();
  });

  it("rejects an ordinary user running a cross-validation", async () => {
    await expect(userCaller().crossValidate({ date: "2026-09-01" })).rejects.toThrow(
      /Admin privileges required/
    );
    expect(scoreDailyWikiOS).not.toHaveBeenCalled();
  });

  it("lets an admin trigger a sync", async () => {
    const caller = createCaller(
      createMockRouterContext({
        auth: { userId: "admin_1" },
        user: { id: "db_admin", clerkUserId: "admin_1", role: { name: "admin", level: 10 } },
        db: createMockDb(),
      }) as never
    );
    await expect(caller.triggerSync()).resolves.toEqual({ ok: true });
  });

  it("does not serve the blacklist to signed-out callers", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const caller = createCaller(
      createMockRouterContext({ auth: null, user: null, db: createMockDb() }) as never
    );
    await expect(caller.getBlacklist()).rejects.toThrow(/Authentication required/);
    warnSpy.mockRestore();
  });

  it("does not serve the blacklist to an ordinary user", async () => {
    await expect(userCaller().getBlacklist()).rejects.toThrow(/Admin privileges required/);
  });

  it("does not serve cross-validation history to an ordinary user", async () => {
    await expect(userCaller().getCrossValidationHistory({ limit: 10, offset: 0 })).rejects.toThrow(
      /Admin privileges required/
    );
  });
});
