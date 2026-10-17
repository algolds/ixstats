/** @jest-environment node */
/**
 * The Lorewards trophies procedures: the viewer's own (their verified wiki link's record, else only the places whose
 * winning edits are all theirs) and any wiki user's public ones, plus the standings. Trophy cards come from the trophy cards the user's account owns.
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
    { rank: 2, user: "Ada", page: "P2", score: 300, bytesAdded: 1, editCount: 1 },
  ],
};

/** A recorded place: a daily on `date` unless `over` says otherwise. */
const entry = (date: string, over: Record<string, unknown> = {}) => ({
  type: "daily",
  date,
  dateStart: null,
  dateEnd: null,
  winnerUser: "Bo",
  winnerPage: null,
  runnerUpUser: null,
  runnerUpPage: null,
  ...over,
});

/** The places recorded under the linked viewer's name "Ada": a weekly win, a daily win, a daily runner-up. */
const ADA_PLACES = [
  entry("2026-10-12", { type: "weekly", winnerUser: "Ada" }),
  entry("2026-10-19", { winnerUser: "Ada", winnerPage: "Tide Charts" }),
  entry("2026-10-18", { runnerUpUser: "Ada" }),
];

const IXNAY = { id: "default", slug: "ixnay", name: "Ixnay", emblemUrl: null, isSystem: false };

/** A trophy copy the account holds, with the fields its face reads. */
const trophyRow = (
  id: string,
  title: string,
  lorewardEdition: string,
  metadata: Record<string, string> | null
) => ({
  id: `own-${id}`,
  finish: "SERIALISED",
  serialNumber: 1,
  level: 1,
  cards: {
    id,
    title,
    rarity: "LEGENDARY",
    cardType: "TROPHY",
    artwork: `https://art/${id}.png`,
    isRetired: false,
    collectorNumber: 4,
    season: null,
    nsSeason: null,
    realm: IXNAY,
    lorewardEdition,
    metadata,
  },
});

/** The summary of a trophy row, its face showing its art. */
const summary = (id: string, title: string, contest: string, place: string) => ({
  id,
  title,
  contest,
  place,
  face: {
    cardId: id,
    title,
    rarity: "LEGENDARY",
    cardType: "TROPHY",
    realm: { id: "default", slug: "ixnay", name: "Ixnay", crestUrl: null, isSystem: false },
    artwork: `https://art/${id}.png`,
    silhouette: false,
    number: 4,
    season: null,
    isRetired: false,
    copy: { ownershipId: `own-${id}`, finish: "SERIALISED", serialNumber: 1, level: 1 },
  },
});

const CARD_SUMMARIES = [
  summary("card1", "Seastead Law", "weekly", "winner"),
  summary("card2", "Tide Charts", "daily", "runner-up"),
];

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
  db.lorewardEntry.findMany.mockResolvedValue(ADA_PLACES);
  // No WikiOS edits by the viewer; today's race rows were mirrored from MediaWiki (no authorId).
  db.wikiRevision.groupBy.mockImplementation(async ({ by }: { by: string[] }) =>
    by[0] === "author" ? [] : [{ authorId: null }]
  );
  db.lorewardUserStats.findFirst.mockResolvedValue(STATS);
  db.cardOwnership.findMany.mockResolvedValue([
    trophyRow("card1", "Seastead Law", "winner", { contest: "weekly" }),
    trophyRow("card2", "Tide Charts", "runner-up", { contest: "daily" }),
  ]);
  db.user.findUnique.mockResolvedValue({ handle: "ann" });
  db.vaultTransaction.aggregate.mockResolvedValue({ _sum: { credits: 2150 } });
});

describe("lorewards.getMyTrophies", () => {
  it("returns the viewer's wins, runner-ups, streak, payouts, trophy cards and rank in today's race", async () => {
    const mine = await viewer().getMyTrophies();

    // Counted from the places under the verified name, not from the name's stats row.
    expect(mine).toEqual({
      wikiUsername: "Ada",
      verified: true,
      unmatched: 0,
      wins: { daily: 1, weekly: 1, monthly: 0 },
      runnerUps: 1,
      streak: expect.any(Number),
      paid: 2150,
      cards: CARD_SUMMARIES,
      // The viewer's own trophies open in Mine, through no holder.
      holderHandle: null,
      todayRank: 2,
    });
    expect(db.user.findUnique).not.toHaveBeenCalled();
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

  it("keeps the rank lookup inside the same two seconds as the race", async () => {
    jest.useFakeTimers();
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    // The race is ready, but reading the scored edits of the viewer's entry never answers.
    db.wikiRevision.groupBy.mockImplementation(({ by }: { by: string[] }) =>
      by[0] === "author" ? Promise.resolve([]) : new Promise(() => undefined)
    );

    const pending = viewer().getMyTrophies();
    await jest.advanceTimersByTimeAsync(2_000);
    expect(await pending).toMatchObject({ paid: 2150, todayRank: null });
    logSpy.mockRestore();
  });

  /**
   * An unlinked viewer whose WikiOS edits carry "Ada": a daily win recorded as `winnerUser`, whose edits under the
   * label group as `authors`.
   */
  function unlinkedAda(winnerUser: string, authors: Array<string | null>) {
    db.wikiAccountLink.findFirst.mockResolvedValue(null);
    db.lorewardEntry.findMany.mockResolvedValue([
      entry("2026-10-20", { winnerUser, winnerPage: "Seneca front" }),
    ]);
    db.wikiRevision.groupBy.mockImplementation(async ({ by }: { by: string[] }) =>
      by[0] === "author"
        ? [
            {
              author: "Ada",
              _min: { createdAt: new Date("2026-10-01T00:00:00Z") },
              _max: { createdAt: new Date("2026-10-20T10:00:00Z") },
            },
          ]
        : authors.map((authorId) => ({ authorId }))
    );
  }

  it("counts an unlinked viewer's wikios> wins their WikiOS edits made, not the name's stats row", async () => {
    unlinkedAda("wikios>Ada", ["u1"]);
    db.vaultTransaction.aggregate.mockResolvedValue({ _sum: { credits: 500 } });

    const mine = await viewer().getMyTrophies();
    expect(mine).toMatchObject({
      wikiUsername: "Ada",
      verified: false,
      unmatched: 0,
      wins: { daily: 1, weekly: 0, monthly: 0 },
      paid: 500,
    });
    expect(db.lorewardUserStats.findFirst).not.toHaveBeenCalled();
    expect(db.wikiRevision.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ["authorId"],
        where: expect.objectContaining({
          author: "Ada",
          article: { source: "ixwiki", title: "Seneca front", redirectTargetSlug: null },
        }),
      })
    );
  });

  it("tells an unlinked viewer how many classic-wiki places under their name a link could claim", async () => {
    // A plain name is a MediaWiki editor: only a verified link ties it, whatever the WikiOS edits say.
    unlinkedAda("Ada", ["u1"]);

    expect(await viewer().getMyTrophies()).toMatchObject({
      wikiUsername: "Ada",
      verified: false,
      unmatched: 1,
      wins: { daily: 0, weekly: 0, monthly: 0 },
    });
    expect(db.lorewardUserStats.findFirst).not.toHaveBeenCalled();
  });

  it("is empty, with no wiki name, for a viewer with no link and no wiki edits", async () => {
    db.wikiAccountLink.findFirst.mockResolvedValue(null);

    expect(await viewer().getMyTrophies()).toEqual({
      wikiUsername: null,
      verified: false,
      unmatched: 0,
      wins: { daily: 0, weekly: 0, monthly: 0 },
      runnerUps: 0,
      streak: 0,
      paid: 0,
      cards: [],
      holderHandle: null,
      todayRank: null,
    });
    expect(db.lorewardUserStats.findFirst).not.toHaveBeenCalled();
  });

  it("counts a linked viewer with no recorded places as zero", async () => {
    db.lorewardEntry.findMany.mockResolvedValue([]);
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
      cards: CARD_SUMMARIES,
      holderHandle: "ann",
    });
    expect(theirs.cards[0]!.face.cardId).toBe("card1");
    expect(db.user.findUnique).toHaveBeenCalledWith({
      where: { id: "u1" },
      select: { handle: true },
    });
    expect(db.vaultTransaction.aggregate).not.toHaveBeenCalled();
  });

  it("reads each trophy with the fields of its face and of the copy held", async () => {
    await signedOut().getTrophies({ username: "Ada" });
    const { select } = db.cardOwnership.findMany.mock.calls[0]![0];
    expect(select).toMatchObject({ id: true, finish: true, serialNumber: true, level: true });
    expect(select.cards.select).toMatchObject({
      id: true,
      title: true,
      rarity: true,
      artwork: true,
      isRetired: true,
      lorewardEdition: true,
      metadata: true,
      realm: expect.anything(),
    });
  });

  it("keeps a retired trophy on the shelf with the placeholder face", async () => {
    const retired = trophyRow("card3", "Old Charter", "winner", { contest: "monthly" });
    db.cardOwnership.findMany.mockResolvedValue([
      { ...retired, cards: { ...retired.cards, isRetired: true } },
    ]);
    const [card] = (await signedOut().getTrophies({ username: "Ada" })).cards;
    expect(card!.face).toMatchObject({ cardId: "card3", artwork: null, isRetired: true });
  });

  it("keeps the cards and the holder's handle for a name with no stats row", async () => {
    db.lorewardUserStats.findFirst.mockResolvedValue(null);
    expect(await signedOut().getTrophies({ username: "Ada" })).toEqual({
      wins: { daily: 0, weekly: 0, monthly: 0 },
      runnerUps: 0,
      streak: 0,
      cards: CARD_SUMMARIES,
      holderHandle: "ann",
    });
  });

  it("has a holder handle of null when the account that verified the name has none", async () => {
    db.user.findUnique.mockResolvedValue({ handle: null });
    expect((await signedOut().getTrophies({ username: "Ada" })).holderHandle).toBeNull();
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
    expect(theirs.holderHandle).toBeNull();
    expect(db.cardOwnership.findMany).not.toHaveBeenCalled();
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });

  it("shows no cards for a wiki name with no verified link", async () => {
    db.wikiAccountLink.findFirst.mockResolvedValue(null);
    const theirs = await signedOut().getTrophies({ username: "Ada" });
    expect(theirs.cards).toEqual([]);
    expect(theirs.holderHandle).toBeNull();
    expect(theirs.wins.daily).toBe(6);
  });

  it("reads the stats row of the exact name: only its first letter is case-insensitive", async () => {
    await signedOut().getTrophies({ username: "ada_lovelace" });
    await signedOut().getTrophies({ username: "OstroZava" });
    expect(db.lorewardUserStats.findFirst.mock.calls.map(([args]) => args.where)).toEqual([
      { username: "Ada lovelace" },
      { username: "OstroZava" },
    ]);
  });

  it("finds the name's verified link by an exact match on the normalized name", async () => {
    await signedOut().getTrophies({ username: "ada_lovelace" });
    expect(db.wikiAccountLink.findFirst).toHaveBeenCalledWith({
      where: { source: "ixwiki", username: "Ada lovelace", verifiedAt: { not: null } },
      select: { userId: true },
    });
  });

  it("skips a trophy card whose contest was not recorded", async () => {
    db.cardOwnership.findMany.mockResolvedValue([trophyRow("c9", "Odd", "winner", null)]);
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
