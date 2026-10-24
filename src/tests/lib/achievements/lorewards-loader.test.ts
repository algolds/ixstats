/** @jest-environment node */
/**
 * The Lorewards achievements read the stats of every name the account holds: its approved claimed names (shown or
 * hidden) and the `wikios>` names only its own WikiOS edits carry (design decision 22), so wins credited to
 * `wikios>handle` count. The streak is the largest of them, not a sum.
 */
import { describe, expect, it } from "@jest/globals";
import { lorewardsLoader } from "~/lib/achievements/metrics/platform";
import type { MetricContext } from "~/lib/achievements/metrics/registry";

interface StatsRow {
  username: string;
  dailyWins: number;
  weeklyWins: number;
  monthlyWins: number;
  dailyRunnerUps: number;
  longestStreak: number;
}

const stats = (username: string, over: Partial<StatsRow> = {}): StatsRow => ({
  username,
  dailyWins: 0,
  weeklyWins: 0,
  monthlyWins: 0,
  dailyRunnerUps: 0,
  longestStreak: 0,
  ...over,
});

const statsTotal = (row: StatsRow) => ({
  totalScore: 0,
  totalBytes: 0,
  currentStreak: 0,
  dailyWins: row.dailyWins,
  weeklyWins: row.weeklyWins,
  monthlyWins: row.monthlyWins,
  dailyRunnerUps: row.dailyRunnerUps,
  longestStreak: row.longestStreak,
});

/** A db with the account's claimed names, the edit labels only it carries, and the stats rows. */
function fakeDb(claimed: string[], labels: string[], rows: StatsRow[]) {
  return {
    wikiNameClaim: {
      findMany: jest.fn(
        async (_query: { where: { source: string; userId: { in: string[] }; status: string } }) =>
          claimed.map((name) => ({ userId: "u1", name }))
      ),
    },
    lorewardUserStats: {
      findMany: jest.fn(async ({ where }: { where: { username: { in: string[] } } }) =>
        rows.filter((r) => where.username.in.includes(r.username)).map(statsTotal)
      ),
    },
    $queryRaw: jest.fn(async (_strings: TemplateStringsArray, ..._values: string[]) =>
      labels.map((author) => ({ author }))
    ),
  };
}

const contextOf = (db: ReturnType<typeof fakeDb>): MetricContext => ({
  db: db as never,
  clerkUserId: "clerk_1",
  userId: "u1",
  countryId: null,
  now: new Date("2026-10-23T12:00:00.000Z"),
});

const ZERO = {
  lorewardDailyWins: 0,
  lorewardWeeklyWins: 0,
  lorewardMonthlyWins: 0,
  lorewardRunnerUps: 0,
  lorewardWinStreak: 0,
};

describe("lorewardsLoader", () => {
  it("adds a claimed name's wins to the wins of the account's own wikios> name", async () => {
    const db = fakeDb(
      ["Old name"],
      ["alpha"],
      [
        stats("Old name", { dailyWins: 2, longestStreak: 2 }),
        stats("wikios>alpha", { dailyWins: 1, weeklyWins: 1, longestStreak: 3 }),
        stats("wikios>beta", { dailyWins: 9, longestStreak: 9 }),
      ]
    );
    expect(await lorewardsLoader.load(contextOf(db))).toEqual({
      ...ZERO,
      lorewardDailyWins: 3,
      lorewardWeeklyWins: 1,
      lorewardWinStreak: 3,
    });
    expect(db.lorewardUserStats.findMany.mock.calls[0]?.[0]).toMatchObject({
      where: { username: { in: ["Old name", "Old_name", "wikios>alpha"] } },
    });
  });

  it("adds up two claimed names, and takes the larger longest streak", async () => {
    const db = fakeDb(
      ["Old name", "New name"],
      [],
      [
        stats("Old name", { dailyWins: 2, weeklyWins: 1, dailyRunnerUps: 3, longestStreak: 4 }),
        stats("New name", { dailyWins: 1, monthlyWins: 1, dailyRunnerUps: 1, longestStreak: 2 }),
        stats("Someone else", { dailyWins: 9, longestStreak: 9 }),
      ]
    );
    expect(await lorewardsLoader.load(contextOf(db))).toEqual({
      lorewardDailyWins: 3,
      lorewardWeeklyWins: 1,
      lorewardMonthlyWins: 1,
      lorewardRunnerUps: 4,
      lorewardWinStreak: 4,
    });
  });

  it("counts wins under the account's wikios> name with no claimed name", async () => {
    const db = fakeDb([], ["alpha"], [stats("wikios>alpha", { dailyWins: 2 })]);
    expect(await lorewardsLoader.load(contextOf(db))).toEqual({ ...ZERO, lorewardDailyWins: 2 });
  });

  it("reads every approved claim of the account, shown or hidden", async () => {
    const db = fakeDb(["Old name"], [], []);
    await lorewardsLoader.load(contextOf(db));
    expect(db.wikiNameClaim.findMany.mock.calls[0]?.[0]).toMatchObject({
      where: { source: "ixwiki", userId: { in: ["u1"] }, status: "APPROVED" },
    });
  });

  it("reads no stats and counts nothing with neither a claimed name nor a WikiOS edit", async () => {
    const db = fakeDb([], [], [stats("Old name", { dailyWins: 5 })]);
    expect(await lorewardsLoader.load(contextOf(db))).toEqual(ZERO);
    expect(db.lorewardUserStats.findMany).not.toHaveBeenCalled();
  });
});
