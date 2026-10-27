/** @jest-environment node */
/** The Lorewards stats of several wiki names added up, for the Passport stat. */
import { lorewardStatsOfNames } from "~/lib/lorewards/stats-of-names";

const row = (username: string, over: Record<string, number>) => ({
  username,
  totalScore: 0,
  totalBytes: 0,
  dailyWins: 0,
  dailyRunnerUps: 0,
  weeklyWins: 0,
  monthlyWins: 0,
  currentStreak: 0,
  longestStreak: 0,
  ...over,
});

const dbOf = (rows: ReturnType<typeof row>[]) => {
  const findMany = jest.fn().mockResolvedValue(rows);
  return { db: { lorewardUserStats: { findMany } } as never, findMany };
};

it("adds up the rows of two names, the streaks the larger, in one query", async () => {
  const { db, findMany } = dbOf([
    row("Foo_bar", {
      totalScore: 300,
      totalBytes: 4000,
      dailyWins: 3,
      dailyRunnerUps: 2,
      weeklyWins: 1,
      monthlyWins: 1,
      currentStreak: 2,
      longestStreak: 9,
    }),
    row("wikios>alpha", {
      totalScore: 120,
      totalBytes: 500,
      dailyWins: 1,
      dailyRunnerUps: 1,
      weeklyWins: 2,
      currentStreak: 4,
      longestStreak: 5,
    }),
  ]);

  await expect(lorewardStatsOfNames(db, ["Foo bar", "wikios>alpha"])).resolves.toEqual({
    totalScore: 420,
    totalBytes: 4500,
    dailyWins: 4,
    dailyRunnerUps: 3,
    weeklyWins: 3,
    monthlyWins: 1,
    currentStreak: 4,
    longestStreak: 9,
  });
  expect(findMany).toHaveBeenCalledTimes(1);
  expect(findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { username: { in: ["Foo bar", "Foo_bar", "wikios>alpha"] } },
    })
  );
});

it("reads a lower-cased plain name under MediaWiki's spellings too", async () => {
  const { db, findMany } = dbOf([]);
  await lorewardStatsOfNames(db, ["foo bar"]);
  expect(findMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: { username: { in: ["foo bar", "Foo bar", "Foo_bar"] } } })
  );
});

it("is null when no name has a row", async () => {
  const { db } = dbOf([]);
  await expect(lorewardStatsOfNames(db, ["Foo bar"])).resolves.toBeNull();
});

it("is null, reading nothing, for no names", async () => {
  const { db, findMany } = dbOf([]);
  await expect(lorewardStatsOfNames(db, [])).resolves.toBeNull();
  expect(findMany).not.toHaveBeenCalled();
});
