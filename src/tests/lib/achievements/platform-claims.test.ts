/** @jest-environment node */
/**
 * The platform loaders read the account's wiki names through its APPROVED name claims (hidden ones too: an
 * achievement count names no one), read once per evaluation. Lorewards add up the stats rows of every claimed name,
 * with the longest streak the largest of them; the wiki and Renaissance queries bind the claimed names as one array.
 */
import { describe, expect, it } from "@jest/globals";
import {
  lorewardsLoader,
  renaissanceLoader,
  wikiLoader,
} from "~/lib/achievements/metrics/platform";
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

function fakeDb(names: string[], rows: StatsRow[]) {
  return {
    wikiNameClaim: {
      findMany: jest.fn(async () => names.map((name) => ({ userId: "u1", name }))),
    },
    lorewardUserStats: {
      findMany: jest.fn(async ({ where }: { where: { username: { in: string[] } } }) =>
        rows.filter((r) => where.username.in.includes(r.username))
      ),
    },
    $queryRaw: jest.fn(
      async (_strings: TemplateStringsArray, ..._values: Array<string | string[] | Date>) => []
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

describe("lorewardsLoader on claimed names", () => {
  it("adds up two claimed names' wins, and takes the larger longest streak", async () => {
    const db = fakeDb(
      ["Old name", "New name"],
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
    expect(db.lorewardUserStats.findMany).toHaveBeenCalledWith({
      where: { username: { in: ["Old name", "New name"] } },
    });
  });

  it("reads every approved claim of the account, shown or hidden", async () => {
    const db = fakeDb(["Old name"], []);
    await lorewardsLoader.load(contextOf(db));
    expect(db.wikiNameClaim.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { source: "ixwiki", userId: { in: ["u1"] }, status: "APPROVED" },
      })
    );
  });

  it("reads no stats and counts nothing with no claimed name", async () => {
    const db = fakeDb([], [stats("Old name", { dailyWins: 5 })]);
    expect(await lorewardsLoader.load(contextOf(db))).toEqual({
      lorewardDailyWins: 0,
      lorewardWeeklyWins: 0,
      lorewardMonthlyWins: 0,
      lorewardRunnerUps: 0,
      lorewardWinStreak: 0,
    });
    expect(db.lorewardUserStats.findMany).not.toHaveBeenCalled();
  });
});

describe("the wiki and Renaissance loaders on claimed names", () => {
  it("binds the account id and every claimed name, reading the claims once per evaluation", async () => {
    const db = fakeDb(["Old name", "New name"], []);
    const ctx = contextOf(db);
    await wikiLoader.load(ctx);
    await renaissanceLoader.load(ctx);
    await lorewardsLoader.load(ctx);

    expect(db.wikiNameClaim.findMany).toHaveBeenCalledTimes(1);
    for (const [strings, ...values] of db.$queryRaw.mock.calls) {
      expect(strings.join("?")).toContain(`r.author = ANY(?::text[])`);
      expect(values).toContain("u1");
      expect(values).toContainEqual(["Old name", "New name"]);
    }
    expect(db.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it("binds an empty array with no claimed name, which matches no unattributed revision", async () => {
    const db = fakeDb([], []);
    await wikiLoader.load(contextOf(db));
    const [, ...values] = db.$queryRaw.mock.calls[0]!;
    expect(values).toContainEqual([]);
  });
});
