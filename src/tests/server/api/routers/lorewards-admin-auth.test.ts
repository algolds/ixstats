// `jest` is the ambient global (not imported from "@jest/globals") because the hoisted
// jest.mock() factory below calls jest.fn() inline; see trpc-impersonation.test.ts.
jest.mock("~/lib/lorewards", () => ({
  __esModule: true,
  fullSync: jest.fn().mockResolvedValue({ ok: true }),
  scoreDailyWikiOS: jest.fn().mockResolvedValue({ winner: null, runnerUp: null, candidates: [] }),
}));
jest.mock("~/lib/lorewards/settle", () => ({
  settleLorewardPlaces: jest
    .fn()
    .mockResolvedValue({ minted: 0, granted: 0, paid: 2, refused: 0, payoutsEnabled: true }),
}));
jest.mock("~/server/modules/cards/cards.trophies", () => ({
  overrideLorewardEntry: jest.fn().mockResolvedValue({
    reassigned: 1,
    voided: 0,
    minted: 0,
    mintDeferred: false,
    // What the database now holds: the runner-up the admin left out was kept
    written: {
      winnerUser: "Cy",
      winnerPage: "Page",
      winnerScore: null,
      winnerBytes: null,
      runnerUpUser: "Bee",
      runnerUpPage: "Hive",
      runnerUpScore: 80,
      runnerUpBytes: 800,
    },
    day: "2026-10-20",
  }),
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { lorewardsAdminRouter } from "~/server/api/routers/lorewards/admin";
import { fullSync, scoreDailyWikiOS } from "~/lib/lorewards";
import { overrideLorewardEntry } from "~/server/modules/cards/cards.trophies";
import { settleLorewardPlaces } from "~/lib/lorewards/settle";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockDb } from "~/tests/helpers/transactional-mock-db";

const createCaller = createCallerFactory(lorewardsAdminRouter);

function adminCaller(db = createMockDb()) {
  return createCaller(
    createMockRouterContext({
      auth: { userId: "admin_1" },
      user: { id: "db_admin", clerkUserId: "admin_1", role: { name: "admin", level: 10 } },
      db,
    }) as never
  );
}

function playerCaller(db = createMockDb()) {
  return createCaller(
    createMockRouterContext({
      auth: { userId: "player_1" },
      user: { id: "db_player", clerkUserId: "player_1", role: { name: "user", level: 100 } },
      db,
    }) as never
  );
}

describe("WK-9: Lorewards admin procedures", () => {
  beforeEach(() => {
    (fullSync as jest.Mock).mockClear();
    (scoreDailyWikiOS as jest.Mock).mockClear();
    jest.mocked(overrideLorewardEntry).mockClear();
    jest.mocked(settleLorewardPlaces).mockClear();
  });

  it("pays every unpaid place when an admin presses Pay now", async () => {
    await expect(adminCaller().payNow()).resolves.toEqual({
      minted: 0,
      granted: 0,
      paid: 2,
      refused: 0,
      payoutsEnabled: true,
    });
    expect(settleLorewardPlaces).toHaveBeenCalledTimes(1);
    expect(settleLorewardPlaces).toHaveBeenCalledWith();
  });

  it("refuses Pay now to a player who is not an admin, and pays nothing", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      // adminMiddleware's ForbiddenError, matched by message as the other router gate suites do
      await expect(playerCaller().payNow()).rejects.toThrow(/Admin privileges required/);
      expect(settleLorewardPlaces).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
  it("moves an admin's override's trophies with it, then tells the bot what the entry now holds, to announce", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    const realFetch = global.fetch;
    global.fetch = fetchMock as never;
    const db = createMockDb();
    try {
      const input = {
        date: "2026-10-20",
        type: "daily" as const,
        winnerUser: "Cy",
        winnerPage: "Page",
      };

      await expect(adminCaller(db).overrideWinner(input)).resolves.toEqual({
        success: true,
        trophies: { reassigned: 1, voided: 0, minted: 0, mintDeferred: false },
        botSynced: true,
      });

      expect(overrideLorewardEntry).toHaveBeenCalledWith(
        expect.anything(),
        { dbId: "db_admin", clerkId: "admin_1" },
        { date: "2026-10-20", type: "daily", fields: { winnerUser: "Cy", winnerPage: "Page" } }
      );
      expect(jest.mocked(overrideLorewardEntry).mock.invocationCallOrder[0]).toBeLessThan(
        fetchMock.mock.invocationCallOrder[0]!
      );
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/lorewards\/override$/),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            date: "2026-10-20",
            type: "daily",
            winnerUser: "Cy",
            winnerPage: "Page",
            winnerScore: null,
            winnerBytes: null,
            runnerUpUser: "Bee",
            runnerUpPage: "Hive",
            runnerUpScore: 80,
            runnerUpBytes: 800,
            announce: true,
          }),
        })
      );
    } finally {
      global.fetch = realFetch;
    }
  });

  it("tells the bot of the contest by the first day the override resolved, not the day typed", async () => {
    jest.mocked(overrideLorewardEntry).mockResolvedValueOnce({
      reassigned: 0,
      voided: 0,
      minted: 0,
      mintDeferred: false,
      written: {
        winnerUser: "Cy",
        winnerPage: "Page",
        winnerScore: null,
        winnerBytes: null,
        runnerUpUser: null,
        runnerUpPage: null,
        runnerUpScore: null,
        runnerUpBytes: null,
      },
      day: "2026-10-19",
    });
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    const realFetch = global.fetch;
    global.fetch = fetchMock as never;
    try {
      await adminCaller().overrideWinner({ date: "2026-10-22", type: "weekly", winnerUser: "Cy" });
      const [, init] = fetchMock.mock.calls[0] as [string, { body: string }];
      expect(JSON.parse(init.body)).toMatchObject({ date: "2026-10-19", type: "weekly" });
    } finally {
      global.fetch = realFetch;
    }
  });

  it("reports the override saved, and the bot not told, when the bot is unreachable", async () => {
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const realFetch = global.fetch;
    global.fetch = jest.fn().mockRejectedValue(new TypeError("fetch failed")) as never;
    const db = createMockDb();
    try {
      await expect(
        adminCaller(db).overrideWinner({ date: "2026-10-20", type: "daily", winnerUser: "Cy" })
      ).resolves.toEqual({
        success: true,
        trophies: { reassigned: 1, voided: 0, minted: 0, mintDeferred: false },
        botSynced: false,
      });
      expect(error).toHaveBeenCalledWith(
        "[Lorewards] The override is saved, but the Discord bot was not told:",
        expect.objectContaining({
          message: "Failed to sync override with Discord bot: fetch failed",
        })
      );
      // The override committed, so the audit row records a success
      expect(db.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ action: "overrideWinner", success: true, error: null }),
      });
    } finally {
      global.fetch = realFetch;
      error.mockRestore();
    }
  });
  it("refuses an override date the calendar lacks, or one not given as YYYY-MM-DD", async () => {
    for (const date of ["2026-02-30", "2026-W43", "Oct 22"]) {
      await expect(
        adminCaller().overrideWinner({ date, type: "daily", winnerUser: "Cy" })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }
    await expect(
      adminCaller().overrideWinner({ date: "2026-02-30", type: "daily", winnerUser: "Cy" })
    ).rejects.toThrow(/Enter a real calendar date, as YYYY-MM-DD\./);
    expect(overrideLorewardEntry).not.toHaveBeenCalled();
  });
});
