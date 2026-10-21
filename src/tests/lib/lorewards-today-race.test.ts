/** @jest-environment node */
/** Today's race: the UTC day's top ten from the WikiOS scoring engine, cached for ten minutes. */
import { beforeEach, describe, expect, it } from "@jest/globals";

jest.mock("~/lib/lorewards/scoring", () => ({ scoreDailyWikiOS: jest.fn() }));

const candidate = (user: string, finalScore: number, over: Record<string, unknown> = {}) => ({
  user,
  page: `${user}'s page`,
  finalScore,
  bytesAdded: 1200,
  editCount: 3,
  ...over,
});

const DAY = Date.UTC(2026, 9, 20, 15, 0, 0);

let getTodayRace: typeof import("~/lib/lorewards/today-race").getTodayRace;
let scoreDailyWikiOS: jest.Mock;

beforeEach(() => {
  jest.resetModules();
  ({ getTodayRace } = require("~/lib/lorewards/today-race"));
  ({ scoreDailyWikiOS } = require("~/lib/lorewards/scoring"));
  scoreDailyWikiOS.mockReset();
  scoreDailyWikiOS.mockResolvedValue({
    date: "2026-10-20",
    candidates: [
      candidate("Ada", 480.4),
      candidate("Bo", 310.6),
      candidate("Cy", 0, { page: "Nothing" }),
    ],
    editCount: 41,
  });
});

describe("getTodayRace", () => {
  it("shares one scoring run between concurrent readers", async () => {
    await Promise.all([getTodayRace(DAY), getTodayRace(DAY), getTodayRace(DAY)]);
    expect(scoreDailyWikiOS).toHaveBeenCalledTimes(1);
  });
});
