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
  it("scores today's UTC date and ranks the scoring candidates", async () => {
    const race = await getTodayRace(DAY);

    expect(scoreDailyWikiOS).toHaveBeenCalledWith("2026-10-20");
    expect(race.date).toBe("2026-10-20");
    expect(race.editCount).toBe(41);
    expect(race.entries).toEqual([
      { rank: 1, user: "Ada", page: "Ada's page", score: 480, bytesAdded: 1200, editCount: 3 },
      { rank: 2, user: "Bo", page: "Bo's page", score: 311, bytesAdded: 1200, editCount: 3 },
    ]);
  });

  it("keeps only the top ten", async () => {
    scoreDailyWikiOS.mockResolvedValue({
      date: "2026-10-20",
      candidates: Array.from({ length: 14 }, (_, i) => candidate(`U${i}`, 100 - i)),
      editCount: 90,
    });
    expect((await getTodayRace(DAY)).entries).toHaveLength(10);
  });

  it("serves the cached race for ten minutes, then scores again", async () => {
    await getTodayRace(DAY);
    await getTodayRace(DAY + 9 * 60_000);
    expect(scoreDailyWikiOS).toHaveBeenCalledTimes(1);

    await getTodayRace(DAY + 10 * 60_000 + 1);
    expect(scoreDailyWikiOS).toHaveBeenCalledTimes(2);
  });

  it("scores the new day at the UTC midnight, whatever the cache holds", async () => {
    await getTodayRace(Date.UTC(2026, 9, 20, 23, 59, 0));
    await getTodayRace(Date.UTC(2026, 9, 21, 0, 1, 0));
    expect(scoreDailyWikiOS).toHaveBeenLastCalledWith("2026-10-21");
  });

  it("shares one scoring run between concurrent readers", async () => {
    await Promise.all([getTodayRace(DAY), getTodayRace(DAY), getTodayRace(DAY)]);
    expect(scoreDailyWikiOS).toHaveBeenCalledTimes(1);
  });

  it("does not cache a failed run", async () => {
    scoreDailyWikiOS.mockRejectedValueOnce(new Error("db down"));
    await expect(getTodayRace(DAY)).rejects.toThrow("db down");
    await expect(getTodayRace(DAY)).resolves.toMatchObject({ date: "2026-10-20" });
  });
});
