/** @jest-environment node */
/**
 * The Lorewards trophies procedures: the viewer's own (through their verified wiki link) and any wiki user's
 * public ones, plus the standings. Trophy cards come from the trophy cards the user's account owns.
 */
import { beforeEach, describe, expect, it } from "@jest/globals";

jest.mock("~/lib/lorewards", () => ({ syncCurrentWinners: jest.fn() }));
jest.mock("~/lib/lorewards/today-race", () => ({ getTodayRace: jest.fn() }));
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/server/modules/identity/identity.privacy", () => ({
  loadPassportSettings: jest.fn(),
}));

import { createCallerFactory } from "~/server/api/trpc";
import { lorewardsTrophiesRouter } from "~/server/api/routers/lorewards/trophies";
import { lorewardsLeaderboardsRouter } from "~/server/api/routers/lorewards/leaderboards";
import { getTodayRace } from "~/lib/lorewards/today-race";
import { loadPassportSettings } from "~/server/modules/identity/identity.privacy";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const trophiesCaller = createCallerFactory(lorewardsTrophiesRouter);
const boardsCaller = createCallerFactory(lorewardsLeaderboardsRouter);

const STATS = {
  username: "Ada",
  dailyWins: 6,
  dailyRunnerUps: 2,
  weeklyWins: 1,
  monthlyWins: 0,
  currentStreak: 3,
  longestStreak: 5,
  totalScore: 900,
  totalBytes: 12000,
  lastWinDate: "2026-10-19",
};

const RACE = {
  date: "2026-10-20",
  editCount: 10,
  entries: [
    { rank: 1, user: "Bo", page: "P1", score: 400, bytesAdded: 1, editCount: 1 },
    { rank: 2, user: "ada", page: "P2", score: 300, bytesAdded: 1, editCount: 1 },
  ],
};

const settings = (vaultCards: boolean) =>
  ({ visibility: { vaultCards }, signature: null, pinnedRibbonKeys: [] }) as never;

let db: ReturnType<typeof createMockPrisma>;

function viewer(over: Record<string, unknown> = {}) {
  return trophiesCaller(
    createMockRouterContext({
      auth: { userId: "clerk_1" },
      user: { id: "u1", clerkUserId: "clerk_1" },
      db,
      ...over,
    }) as never
  );
}

const signedOut = () =>
  trophiesCaller(createMockRouterContext({ auth: null, user: null, db }) as never);

beforeEach(() => {
  db = createMockPrisma();
  jest.useRealTimers();
  jest.mocked(getTodayRace).mockResolvedValue(RACE);
  jest.mocked(loadPassportSettings).mockResolvedValue(settings(true));
  db.wikiAccountLink.findFirst.mockResolvedValue({ username: "Ada", userId: "u1" });
  db.lorewardUserStats.findFirst.mockResolvedValue(STATS);
  db.cardOwnership.findMany.mockResolvedValue([
    {
      cards: {
        id: "card1",
        title: "Seastead Law",
        lorewardEdition: "winner",
        metadata: { contest: "weekly" },
      },
    },
    {
      cards: {
        id: "card2",
        title: "Tide Charts",
        lorewardEdition: "runner-up",
        metadata: { contest: "daily" },
      },
    },
  ]);
  db.vaultTransaction.aggregate.mockResolvedValue({ _sum: { credits: 2150 } });
});

describe("lorewards.getMyTrophies", () => {
  it("returns the viewer's wins, runner-ups, streak, payouts, trophy cards and rank in today's race", async () => {
    const mine = await viewer().getMyTrophies();

    expect(mine).toEqual({
      wikiUsername: "Ada",
      wins: { daily: 6, weekly: 1, monthly: 0 },
      runnerUps: 2,
      streak: 3,
      paid: 2150,
      cards: [
        { id: "card1", title: "Seastead Law", contest: "weekly", place: "winner" },
        { id: "card2", title: "Tide Charts", contest: "daily", place: "runner-up" },
      ],
      todayRank: 2,
    });
  });

  it("reads the cards the viewer's account owns, and the payouts of their Loreward bonuses", async () => {
    await viewer().getMyTrophies();

    expect(db.cardOwnership.findMany.mock.calls[0]![0].where).toMatchObject({
      ownerId: "u1",
      cards: { lorewardEntryId: { not: null } },
    });
    expect(db.vaultTransaction.aggregate.mock.calls[0]![0].where).toMatchObject({
      type: "EARN_BONUS",
      source: { startsWith: "bonus:loreward:" },
      vault: { userId: "u1" },
    });
  });

  it("has no rank when the viewer is outside today's top ten", async () => {
    jest.mocked(getTodayRace).mockResolvedValue({ ...RACE, entries: [RACE.entries[0]!] });
    expect((await viewer().getMyTrophies()).todayRank).toBeNull();
  });

  it("still returns the trophies and payouts when today's race fails", async () => {
    jest.mocked(getTodayRace).mockRejectedValue(new Error("scoring weights unreadable"));

    const mine = await viewer().getMyTrophies();
    expect(mine).toMatchObject({ wikiUsername: "Ada", paid: 2150, todayRank: null });
    expect(mine.cards).toHaveLength(2);
  });

  it("does not wait on a cold race: the rank is left out after two seconds", async () => {
    jest.useFakeTimers();
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    jest.mocked(getTodayRace).mockReturnValue(new Promise(() => undefined));

    const pending = viewer().getMyTrophies();
    await jest.advanceTimersByTimeAsync(2_000);
    expect(await pending).toMatchObject({ paid: 2150, todayRank: null });
    logSpy.mockRestore();
  });

  it("keeps the trophies of a viewer with no link under the name their WikiOS edits carry", async () => {
    db.wikiAccountLink.findFirst.mockResolvedValue(null);
    db.wikiRevision.findFirst.mockResolvedValue({ author: "Ada" });
    db.vaultTransaction.aggregate.mockResolvedValue({ _sum: { credits: 500 } });

    const mine = await viewer().getMyTrophies();
    expect(mine.wikiUsername).toBe("Ada");
    expect(mine.wins.daily).toBe(6);
    expect(db.wikiRevision.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { authorId: "u1", author: { not: null } } })
    );
  });

  it("is empty, with no wiki name, for a viewer with no link and no wiki edits", async () => {
    db.wikiAccountLink.findFirst.mockResolvedValue(null);
    db.wikiRevision.findFirst.mockResolvedValue(null);

    expect(await viewer().getMyTrophies()).toEqual({
      wikiUsername: null,
      wins: { daily: 0, weekly: 0, monthly: 0 },
      runnerUps: 0,
      streak: 0,
      paid: 0,
      cards: [],
      todayRank: null,
    });
    expect(db.lorewardUserStats.findFirst).not.toHaveBeenCalled();
  });

  it("counts a linked viewer with no stats row as zero", async () => {
    db.lorewardUserStats.findFirst.mockResolvedValue(null);
    db.cardOwnership.findMany.mockResolvedValue([]);
    db.vaultTransaction.aggregate.mockResolvedValue({ _sum: { credits: null } });

    const mine = await viewer().getMyTrophies();
    expect(mine).toMatchObject({ wikiUsername: "Ada", runnerUps: 0, paid: 0, cards: [] });
  });

  it("needs a signed-in viewer", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    await expect(signedOut().getMyTrophies()).rejects.toThrow(/Authentication required/);
    warnSpy.mockRestore();
  });
});

describe("lorewards.getTrophies", () => {
  it("serves a wiki user's public trophies, owned cards included, without payouts", async () => {
    const theirs = await signedOut().getTrophies({ username: "ada" });

    expect(theirs).toEqual({
      wins: { daily: 6, weekly: 1, monthly: 0 },
      runnerUps: 2,
      streak: 3,
      cards: [
        { id: "card1", title: "Seastead Law", contest: "weekly", place: "winner" },
        { id: "card2", title: "Tide Charts", contest: "daily", place: "runner-up" },
      ],
    });
    expect(db.vaultTransaction.aggregate).not.toHaveBeenCalled();
  });

  it("returns the counts but no cards when the owner hides Vault cards on their passport", async () => {
    jest.mocked(loadPassportSettings).mockResolvedValue(settings(false));

    const theirs = await signedOut().getTrophies({ username: "Ada" });
    expect(loadPassportSettings).toHaveBeenCalledWith("u1");
    expect(theirs).toMatchObject({
      wins: { daily: 6, weekly: 1, monthly: 0 },
      runnerUps: 2,
      streak: 3,
    });
    expect(theirs.cards).toEqual([]);
    expect(db.cardOwnership.findMany).not.toHaveBeenCalled();
  });

  it("shows no cards for a wiki name with no verified link", async () => {
    db.wikiAccountLink.findFirst.mockResolvedValue(null);
    const theirs = await signedOut().getTrophies({ username: "Ada" });
    expect(theirs.cards).toEqual([]);
    expect(theirs.wins.daily).toBe(6);
  });

  it("skips a trophy card whose contest was not recorded", async () => {
    db.cardOwnership.findMany.mockResolvedValue([
      { cards: { id: "c9", title: "Odd", lorewardEdition: "winner", metadata: null } },
    ]);
    expect((await signedOut().getTrophies({ username: "Ada" })).cards).toEqual([]);
  });
});

describe("lorewards.getTodayRace", () => {
  it("serves the cached race", async () => {
    expect(await signedOut().getTodayRace()).toEqual(RACE);
  });
});

describe("lorewards.getStandings", () => {
  it("lists the top players by total score", async () => {
    db.lorewardUserStats.findMany.mockResolvedValue([
      { ...STATS, username: "Bo", totalScore: 1200 },
      STATS,
    ]);
    const standings = await boardsCaller(
      createMockRouterContext({ auth: null, user: null, db }) as never
    ).getStandings({ limit: 10 });

    expect(db.lorewardUserStats.findMany.mock.calls[0]![0]).toMatchObject({
      orderBy: [{ totalScore: "desc" }, { username: "asc" }],
      take: 10,
    });
    expect(standings).toEqual([
      {
        rank: 1,
        username: "Bo",
        totalScore: 1200,
        dailyWins: 6,
        weeklyWins: 1,
        monthlyWins: 0,
        currentStreak: 3,
      },
      {
        rank: 2,
        username: "Ada",
        totalScore: 900,
        dailyWins: 6,
        weeklyWins: 1,
        monthlyWins: 0,
        currentStreak: 3,
      },
    ]);
  });
});
