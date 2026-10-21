/** @jest-environment node */
// `jest` is the ambient global (not imported from "@jest/globals") because the hoisted jest.mock() factories call
// jest.fn() inline.
//
// Saving a scored WikiOS daily as the winner (`admin.saveLorewardWinnerOverride`) is an override like any other
// (cards refresh §2.4): it goes through `overrideLorewardEntry`, so the places' trophies follow, the entries are
// marked against the syncs, and an omitted field keeps its stored value. The bot is told of it as of
// `lorewards.overrideWinner`, and a bot that is down never fails the saved override.
jest.mock("~/server/modules/cards/cards.trophies", () => ({
  overrideLorewardEntry: jest.fn(),
}));
jest.mock("~/lib/cache", () => ({
  ...jest.requireActual("~/lib/cache"),
  invalidateCache: jest.fn().mockResolvedValue(undefined),
}));

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { adminWikiRouter } from "~/server/api/routers/admin/wiki";
import { overrideLorewardEntry } from "~/server/modules/cards/cards.trophies";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockDb } from "~/tests/helpers/transactional-mock-db";

const createCaller = createCallerFactory(adminWikiRouter);

const caller = (role: "admin" | "user") =>
  createCaller(
    createMockRouterContext({
      auth: { userId: `${role}_1` },
      user: {
        id: `db_${role}`,
        clerkUserId: `${role}_1`,
        role: { name: role, level: role === "admin" ? 10 : 100 },
      },
      db: createMockDb(),
    }) as never
  );

const RESULT = {
  reassigned: 1,
  voided: 0,
  minted: 0,
  mintDeferred: false,
  written: {
    winnerUser: "Cy",
    winnerPage: "Page",
    winnerScore: 12,
    winnerBytes: 340,
    runnerUpUser: null,
    runnerUpPage: null,
    runnerUpScore: null,
    runnerUpBytes: null,
  },
  day: "2026-10-16",
};

const realFetch = global.fetch;
let fetchMock: jest.Mock;

beforeEach(() => {
  jest.mocked(overrideLorewardEntry).mockReset().mockResolvedValue(RESULT);
  fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200 });
  global.fetch = fetchMock as never;
});
afterEach(() => {
  global.fetch = realFetch;
});

describe("admin.saveLorewardWinnerOverride", () => {
  it("leaves out the fields the caller omits, so the override keeps their stored values", async () => {
    await caller("admin").saveLorewardWinnerOverride({
      date: "2026-10-16",
      type: "weekly",
      winnerUser: "Cy",
      winnerPage: "Page",
    });

    const [, , input] = jest.mocked(overrideLorewardEntry).mock.calls[0]!;
    expect(input.fields).toEqual({ winnerUser: "Cy", winnerPage: "Page" });
    expect(input.type).toBe("weekly");
  });
  it("refuses an override date the calendar lacks", async () => {
    for (const date of ["2026-02-30", "2026-04-31"]) {
      await expect(
        caller("admin").saveLorewardWinnerOverride({ date, winnerUser: "Cy", winnerPage: "Page" })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }
    expect(overrideLorewardEntry).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("refuses an ordinary user", async () => {
    await expect(
      caller("user").saveLorewardWinnerOverride({
        date: "2026-10-16",
        winnerUser: "Cy",
        winnerPage: "Page",
      })
    ).rejects.toThrow(/Admin privileges required/);
    expect(overrideLorewardEntry).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
