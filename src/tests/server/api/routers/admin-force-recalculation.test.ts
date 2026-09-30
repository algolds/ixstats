// `jest` is the ambient global (not imported from "@jest/globals") because the hoisted
// jest.mock() factories below call jest.fn() inline.
jest.mock("~/server/cron/stat-progression", () => ({
  __esModule: true,
  runStatProgression: jest.fn(),
}));
jest.mock("~/lib/system/job-lock", () => ({
  __esModule: true,
  withJobLock: jest.fn(),
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { adminSystemRouter } from "~/server/api/routers/admin/system";
import { runStatProgression } from "~/server/cron/stat-progression";
import { withJobLock } from "~/lib/system/job-lock";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockDb } from "~/tests/helpers/transactional-mock-db";

/**
 * MC-7: the admin "force recalculation" button runs the same stat-progression job the cron
 * runs (forced, under the same job lock) instead of its own copy of the projection loop.
 */
const createCaller = createCallerFactory(adminSystemRouter);

function adminCaller() {
  return createCaller(
    createMockRouterContext({
      auth: { userId: "admin_1" },
      user: { id: "db_admin", clerkUserId: "admin_1", role: { name: "admin", level: 10 } },
      db: createMockDb(),
    }) as never
  );
}

describe("admin.forceRecalculation", () => {
  beforeEach(() => {
    (runStatProgression as jest.Mock).mockReset();
    (withJobLock as jest.Mock).mockReset();
  });

  it("runs stat progression forced, under the stat-progression lock", async () => {
    (runStatProgression as jest.Mock).mockResolvedValue({ updated: 7, executionTimeMs: 12 });
    (withJobLock as jest.Mock).mockImplementation(async (_db, _name, fn: () => unknown) => ({
      ran: true,
      result: await fn(),
    }));

    const result = await adminCaller().forceRecalculation();

    expect((withJobLock as jest.Mock).mock.calls[0]![1]).toBe("stat-progression");
    expect(runStatProgression).toHaveBeenCalledWith(
      expect.objectContaining({ force: true, note: "Manual recalculation from admin panel" })
    );
    expect(result).toEqual({
      success: true,
      message: "Updated 7 countries in 12ms",
      countriesUpdated: 7,
      executionTimeMs: 12,
    });
  });

  it("refuses to run while the cron job holds the lock", async () => {
    (withJobLock as jest.Mock).mockResolvedValue({ ran: false });

    await expect(adminCaller().forceRecalculation()).rejects.toThrow(/already running/);
    expect(runStatProgression).not.toHaveBeenCalled();
  });
});
