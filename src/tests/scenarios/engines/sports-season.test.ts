/** @jest-environment node */
/**
 * A hockey season from first face-off to the next season. The league manager starts the season; two players stake
 * Sovereigns on the opening match (one on each side) and on the second (both on a draw, which hockey never gives). A
 * stranger cannot run the match day. The manager runs it: the match completes once, standings follow hockey's 2/1/0
 * rule, the winning side takes the whole pool. Running it again pays and counts nothing. The manager overrides the
 * result: the rebuilt table matches the simulated one, then follows the new score. Each club collects its match
 * revenue once. The clock moves on, the cron plays the rest of the season, refunds the drawn pool, crowns a champion
 * (whose owner gets the Trophy) and starts season 2 with standings, a rookie class, a schedule and aged players. Two
 * known bugs are pinned with it.failing: the draft into a short roster breaks the season transition, and two
 * settlements of one match both pay. On Postgres: the settlement race, and two revenue collections racing.
 *
 * Folds recalculate-standings (2/1/0 and 3/1/0 points, rank never a position column), transition (aging and the
 * off-season loop, as rows), sports-match-revenue (ticket, base fee and win bonus, paid once, foreign club refused,
 * the row lock), predictions (parimutuel split and the void refund), the points cases of simulate-and-persist and the
 * plain stake debit of sports-predictions.
 */
let mockDb: unknown;
jest.mock("~/server/db", () => ({
  get db() {
    return mockDb;
  },
}));
jest.mock("~/lib/sports/feed-post", () => ({ postMatchDayBulletin: jest.fn() }));
jest.mock("~/lib/sports/club-notify", () => ({ notifyClubMatchResult: jest.fn() }));
jest.mock("~/lib/sports/commentary/narrator", () => ({
  narrateEvents: jest.fn(async () => []),
  generateAudioBroadcast: jest.fn(async () => null),
  generateSeasonSummary: jest.fn(async () => ""),
}));
jest.mock("~/lib/notifications/api", () => ({ notificationAPI: { create: jest.fn() } }));

import type { PrismaClient } from "@prisma/client";
import { IxTime } from "~/lib/ixtime";
import { advanceSportsSeasons } from "~/lib/sports/season-cron";
import { decidedAfterRegulation } from "~/lib/sports/match-outcome";
import { outcomeFromScores, resolveMatchPredictions } from "~/lib/sports/predictions";
import { createCallerFactory } from "~/server/api/trpc";
import { matchDaySimulationRouter } from "~/server/api/routers/sports/seasons/matches/matchDay";
import { sportsSeasonsLifecycleRouter } from "~/server/api/routers/sports/seasons/lifecycle";
import { leaguesScheduleRouter } from "~/server/api/routers/sports/leagues/schedule";
import { sportsPredictionsRouter } from "~/server/api/routers/sports/predictions";
import { createMemoryPrisma, type MemoryPrisma } from "~/tests/helpers/memory-prisma";
import {
  addLeague,
  addPerson,
  asPerson,
  removeSportsWorld,
  sovereignLedgerOf,
  sovereignsOf,
  type Person,
} from "~/tests/helpers/sports-world";
import { describeWithDb, prefix, scenarioDb } from "~/tests/helpers/scenario-db";
import type { EventTraceStep } from "~/lib/sports/types";

const matchDay = createCallerFactory(matchDaySimulationRouter);
const lifecycle = createCallerFactory(sportsSeasonsLifecycleRouter);
const schedule = createCallerFactory(leaguesScheduleRouter);
const predictions = createCallerFactory(sportsPredictionsRouter);

const START = Date.UTC(2042, 2, 1);
const TICKETS = 5000 * 15 * 0.6 * 0.5; // capacity × price × 0.6 × popularity share, per home match
const BASE_FEE = 1000;
const WIN_BONUS = 500;

interface World {
  db: PrismaClient;
  p: string;
  manager: Person;
  ana: Person;
  ben: Person;
  cleo: Person;
  dev: Person;
  stranger: Person;
  leagueId: string;
  north: string;
  south: string;
}

/** A two-club hockey league: Cleo owns North, Dev owns South; Ana, Ben and Cleo hold 500 Sovereigns each. */
async function seed(db: PrismaClient, p: string, rosterSize = 20): Promise<World> {
  const manager = await addPerson(db, `${p}manager`);
  const ana = await addPerson(db, `${p}ana`, 500);
  const ben = await addPerson(db, `${p}ben`, 500);
  const cleo = await addPerson(db, `${p}cleo`, 500);
  const dev = await addPerson(db, `${p}dev`);
  const stranger = await addPerson(db, `${p}stranger`);
  const north = `${p}north`;
  const south = `${p}south`;
  await addLeague(db, {
    id: `${p}league`,
    managerId: manager.id,
    sportPreset: "hockey",
    clubs: [
      { id: north, ownerUserId: cleo.id, base: 66, rosterSize },
      { id: south, ownerUserId: dev.id, base: 60, rosterSize },
    ],
  });
  return { db, p, manager, ana, ben, cleo, dev, stranger, leagueId: `${p}league`, north, south };
}

type StandingRow = { teamId: string; wins: number; draws: number; losses: number; points: number };
const table = async (db: PrismaClient, seasonId: string) =>
  db.sportStanding.findMany({
    where: { seasonId },
    select: {
      teamId: true,
      wins: true,
      draws: true,
      losses: true,
      points: true,
      pointsFor: true,
      pointsAgainst: true,
    },
    orderBy: { teamId: "asc" },
  });

/** Hockey: 2 for a win, 1 for an overtime or shootout loss, 0 for a regulation loss; never a draw. */
function expectHockeyPoints(
  rows: StandingRow[],
  match: { homeTeamId: string; awayTeamId: string; homeScore: number; awayScore: number },
  trace: EventTraceStep[]
) {
  const homeWon = match.homeScore > match.awayScore;
  const [winner, loser] = homeWon
    ? [match.homeTeamId, match.awayTeamId]
    : [match.awayTeamId, match.homeTeamId];
  const loserPoints = decidedAfterRegulation("hockey", trace) ? 1 : 0;
  expect(match.homeScore).not.toBe(match.awayScore);
  expect(rows.find((r) => r.teamId === winner)).toMatchObject({ wins: 1, losses: 0, points: 2 });
  expect(rows.find((r) => r.teamId === loser)).toMatchObject({
    wins: 0,
    losses: 1,
    points: loserPoints,
  });
}

beforeEach(() => {
  jest.spyOn(console, "log").mockImplementation(() => undefined);
  if (!process.env.DEBUG_SCN) jest.spyOn(console, "error").mockImplementation(() => undefined);
  jest.spyOn(console, "info").mockImplementation(() => undefined);
});
afterEach(() => {
  IxTime.clearTimeOverride();
  jest.restoreAllMocks();
});

describe("sports-season (memory)", () => {
  let db: MemoryPrisma;
  let w: World;

  beforeEach(async () => {
    db = createMemoryPrisma();
    db.store.onRaw(/SELECT pg_advisory_xact_lock\(hashtext\(\?\)\)/, () => 1);
    db.store.onRaw(/SELECT id FROM "sport_teams" WHERE id = \? FOR UPDATE/, ([id]) => [{ id }]);
    mockDb = db;
    IxTime.setTimeOverride(START);
    w = await seed(db as never, "m-");
    await db.realm.create({
      data: { id: "default", slug: "ixnay", name: "Ixnay", ownerId: "system" },
    });
  });

  it("plays a season: one settlement, one payout per club, a rebuilt table, then season 2", async () => {
    const { manager, ana, ben, cleo, dev, stranger } = w;
    const season = await lifecycle(asPerson(db as never, manager)).startSeason({
      leagueId: w.leagueId,
    });
    const fixtures = await db.sportMatch.findMany({
      where: { seasonId: season.id },
      orderBy: { matchDay: "asc" },
    });
    const [opener, second] = fixtures;
    expect(opener!.matchDay).toBe(1);
    expect(await db.sportStanding.count({ where: { seasonId: season.id } })).toBe(2);

    // Stakes are debited as they are placed: Ana and Cleo back the away side, Ben the home side; then Ana and Ben
    // both back a draw on the second match
    const stake = (
      who: Person,
      matchId: string,
      outcome: "home" | "away" | "draw",
      amount: number
    ) =>
      predictions(asPerson(db as never, who)).placePrediction({ matchId, outcome, stake: amount });
    const opening = { ana: 100, cleo: 40, ben: 60 };
    await stake(ana, opener!.id, "away", opening.ana);
    await stake(cleo, opener!.id, "away", opening.cleo);
    await stake(ben, opener!.id, "home", opening.ben);
    await stake(ana, second!.id, "draw", 20);
    await stake(ben, second!.id, "draw", 40);
    const staked = { [ana.id]: 380, [ben.id]: 400, [cleo.id]: 460 };
    expect(await sovereignsOf(db as never, [ana.id, ben.id, cleo.id])).toEqual(staked);
    expect(await sovereignLedgerOf(db as never, ana.id)).toEqual([
      { sovereigns: -100, type: "PREDICTION_STAKE", source: `PREDICTION_STAKE:${opener!.id}` },
      { sovereigns: -20, type: "PREDICTION_STAKE", source: `PREDICTION_STAKE:${second!.id}` },
    ]);

    // Only the league's manager runs the match day
    await expect(
      matchDay(asPerson(db as never, stranger)).simulateMatchDay({
        seasonId: season.id,
        matchDay: 1,
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const day = await matchDay(asPerson(db as never, manager)).simulateMatchDay({
      seasonId: season.id,
      matchDay: 1,
    });
    expect(day.results).toHaveLength(1);
    const played = await db.sportMatch.findUniqueOrThrow({ where: { id: opener!.id } });
    expect(played.status).toBe("completed");
    const trace = (played.matchStats as Record<string, unknown>).trace as EventTraceStep[];
    const afterDay = await table(db as never, season.id);
    expectHockeyPoints(afterDay, played as never, trace);

    // Parimutuel: the winning side splits the whole pool (200) by stake; the other side's stakes are lost
    const outcome = outcomeFromScores(played.homeScore!, played.awayScore!);
    const sides = { ana: "away", cleo: "away", ben: "home" } as const;
    const winningPool = Object.entries(opening)
      .filter(([who]) => sides[who as keyof typeof sides] === outcome)
      .reduce((sum, [, amount]) => sum + amount, 0);
    const bets = await db.sportPrediction.findMany({ where: { matchId: opener!.id } });
    const paid = await sovereignsOf(db as never, [ana.id, ben.id, cleo.id]);
    for (const [name, who] of [
      ["ana", ana],
      ["cleo", cleo],
      ["ben", ben],
    ] as const) {
      const bet = bets.find((b) => b.userId === who.clerkUserId)!;
      const payout = sides[name] === outcome ? (opening[name] * 200) / winningPool : 0;
      expect(bet).toMatchObject({ status: payout > 0 ? "won" : "lost", payout });
      expect(paid[who.id]).toBe(staked[who.id]! + payout);
      if (payout > 0) {
        expect((await sovereignLedgerOf(db as never, who.id)).at(-1)).toEqual({
          sovereigns: payout,
          type: "PREDICTION_PAYOUT",
          source: `PREDICTION_WIN:${bet.id}`,
        });
      }
    }

    // Running the day again pays and counts nothing
    const again = await matchDay(asPerson(db as never, manager)).simulateMatchDay({
      seasonId: season.id,
      matchDay: 1,
    });
    expect(again).toMatchObject({ alreadyResolved: true });
    expect(await table(db as never, season.id)).toEqual(afterDay);
    expect(await sovereignsOf(db as never, [ana.id, ben.id, cleo.id])).toEqual(paid);

    // The override rebuilds the same table from the stored result, ranked, with no position column
    const override = (homeScore: number, awayScore: number, who = manager) =>
      schedule(asPerson(db as never, who)).overrideMatchResult({
        matchId: opener!.id,
        homeScore,
        awayScore,
      });
    await expect(override(1, 0, stranger)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await override(played.homeScore!, played.awayScore!);
    expect(await table(db as never, season.id)).toEqual(afterDay);
    const ranked = await db.sportStanding.findMany({ where: { seasonId: season.id } });
    expect(ranked.map((r) => r.rank).sort()).toEqual([1, 2]);
    expect(ranked[0]).not.toHaveProperty("position");
    // A flipped score: the new winner has 2, the loser follows the stored trace's overtime call
    const [low, high] = [Math.min(played.homeScore!, played.awayScore!), 9];
    const homeNowWins = outcome !== "home";
    await override(homeNowWins ? high : low, homeNowWins ? low : high);
    const flipped = await db.sportMatch.findUniqueOrThrow({ where: { id: opener!.id } });
    expectHockeyPoints(await table(db as never, season.id), flipped as never, trace);
    // Decided in overtime (a goal after minute 60 in the stored trace), the loser keeps a point
    const overtime = [...trace, { t: 63, type: "goal", description: "Overtime winner" }];
    await db.sportMatch.update({
      where: { id: opener!.id },
      data: {
        matchStats: { ...(flipped.matchStats as object), trace: overtime.map((step) => ({ ...step })) },
      },
    });
    await override(flipped.homeScore!, flipped.awayScore!);
    expectHockeyPoints(
      await table(db as never, season.id),
      flipped as never,
      overtime as EventTraceStep[]
    );
    expect((await table(db as never, season.id)).map((r) => r.points).sort()).toEqual([1, 2]);

    // Each club collects once: the home club its tickets, base fee and any win bonus; the away club its win bonus
    const collect = (who: Person, teamId: string) =>
      lifecycle(asPerson(db as never, who)).collectMatchRevenue({ teamId });
    const homeClub =
      flipped.homeTeamId === w.north ? { who: cleo, id: w.north } : { who: dev, id: w.south };
    const awayClub =
      homeClub.id === w.north ? { who: dev, id: w.south } : { who: cleo, id: w.north };
    await expect(collect(stranger, homeClub.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const homeWins = flipped.homeScore! > flipped.awayScore!;
    expect(await collect(homeClub.who, homeClub.id)).toMatchObject({
      matchesCollected: 1,
      total: TICKETS + BASE_FEE + (homeWins ? WIN_BONUS : 0),
      budget: 100_000 + TICKETS + BASE_FEE + (homeWins ? WIN_BONUS : 0),
    });
    expect(await collect(awayClub.who, awayClub.id)).toMatchObject({
      matchesCollected: 1,
      total: homeWins ? 0 : WIN_BONUS,
    });
    expect(await collect(homeClub.who, homeClub.id)).toMatchObject({ matchesCollected: 0 });
    expect(
      await db.sportMatch.findUniqueOrThrow({
        where: { id: opener!.id },
        select: { homeRevenueCollectedAt: true, awayRevenueCollectedAt: true },
      })
    ).toEqual({
      homeRevenueCollectedAt: expect.any(Date),
      awayRevenueCollectedAt: expect.any(Date),
    });

    // The cron plays the rest, refunds the drawn pool (hockey has no draws) and turns the season over
    const players = await db.sportPlayer.findMany({ select: { id: true, age: true } });
    IxTime.setTimeOverride(START + 365 * 86_400_000);
    await advanceSportsSeasons(db as never);

    const refunds = await db.sportPrediction.findMany({ where: { matchId: second!.id } });
    expect(refunds.map((r) => [r.status, r.payout]).sort()).toEqual([
      ["void", 20],
      ["void", 40],
    ]);
    expect((await sovereignLedgerOf(db as never, ben.id)).at(-1)).toEqual({
      sovereigns: 40,
      type: "PREDICTION_PAYOUT",
      source: `PREDICTION_REFUND:${refunds.find((r) => r.userId === ben.clerkUserId)!.id}`,
    });

    const finished = await db.sportSeason.findUniqueOrThrow({ where: { id: season.id } });
    expect(finished.status).toBe("completed");
    expect([w.north, w.south]).toContain(finished.championTeamId);
    const next = await db.sportSeason.findFirstOrThrow({
      where: { leagueId: w.leagueId, seasonNumber: 2 },
    });
    expect(next.status).toBe("in_progress");
    expect(await db.sportStanding.count({ where: { seasonId: next.id } })).toBe(2);
    expect(await db.sportRookieClass.count({ where: { seasonId: next.id } })).toBe(1);
    expect(await db.sportMatch.count({ where: { seasonId: next.id } })).toBeGreaterThan(0);
    for (const before of players) {
      const after = await db.sportPlayer.findUniqueOrThrow({ where: { id: before.id } });
      if (after.careerStage !== "retired") expect(after.age).toBe(before.age + 1);
    }
    expect(
      await db.sportCoach.findMany({ where: { id: { endsWith: "-coach" } }, select: { age: true } })
    ).toEqual([{ age: 51 }, { age: 51 }]);
    // The champion's owner holds the season's one Trophy, Serialised
    const champion = await db.sportTeam.findUniqueOrThrow({
      where: { id: finished.championTeamId! },
    });
    const trophies = await db.cardOwnership.findMany({
      where: { cards: { cardType: "TROPHY" } },
      select: { ownerId: true, finish: true },
    });
    expect(trophies).toEqual([{ ownerId: champion.ownerUserId, finish: "SERIALISED" }]);
  });

  it("pays 3 for a soccer win and 1 to each side of a draw, on the match day and on an override", async () => {
    await addLeague(db as never, {
      id: "m-soccer",
      managerId: w.manager.id,
      sportPreset: "soccer",
      clubs: [
        { id: "m-reds", ownerUserId: null, base: 64 },
        { id: "m-blues", ownerUserId: null, base: 62 },
      ],
    });
    const manager = asPerson(db as never, w.manager);
    const season = await lifecycle(manager).startSeason({ leagueId: "m-soccer" });
    await matchDay(manager).simulateMatchDay({ seasonId: season.id, matchDay: 1 });
    const [played] = await db.sportMatch.findMany({
      where: { seasonId: season.id, matchDay: 1 },
    });
    const points = async () =>
      Object.fromEntries(
        (await table(db as never, season.id)).map((r) => [
          r.teamId,
          [r.wins, r.draws, r.losses, r.points],
        ])
      );
    const rule = (home: number, away: number) =>
      home === away
        ? { [played!.homeTeamId]: [0, 1, 0, 1], [played!.awayTeamId]: [0, 1, 0, 1] }
        : home > away
          ? { [played!.homeTeamId]: [1, 0, 0, 3], [played!.awayTeamId]: [0, 0, 1, 0] }
          : { [played!.homeTeamId]: [0, 0, 1, 0], [played!.awayTeamId]: [1, 0, 0, 3] };
    expect(await points()).toEqual(rule(played!.homeScore!, played!.awayScore!));
    const override = (homeScore: number, awayScore: number) =>
      schedule(manager).overrideMatchResult({ matchId: played!.id, homeScore, awayScore });
    await override(1, 1);
    expect(await points()).toEqual(rule(1, 1));
    await override(0, 2);
    expect(await points()).toEqual(rule(0, 2));
  });

  it.failing(
    // BUG (src/lib/sports/transition.ts runAutoDraft): the draft writes SportDraftPick rows with originalTeamId and
    // currentTeamId, which the model does not have, and without its required teamId. Any club short of a full roster
    // makes the season transition throw and roll back, so the league never gets its next season (the cron only logs
    // it). Remove .failing once the draft writes teamId.
    "drafts rookies into short rosters when the season turns over",
    async () => {
      const short = createMemoryPrisma();
      mockDb = short;
      const s = await seed(short as never, "s-", 12);
      const season = await lifecycle(asPerson(short as never, s.manager)).startSeason({
        leagueId: s.leagueId,
      });
      IxTime.setTimeOverride(START + 365 * 86_400_000);
      await advanceSportsSeasons(short as never);
      expect(await short.sportSeason.findUniqueOrThrow({ where: { id: season.id } })).toMatchObject(
        {
          status: "completed",
        }
      );
      const next = await short.sportSeason.findFirstOrThrow({
        where: { leagueId: s.leagueId, seasonNumber: 2 },
      });
      expect(await short.sportDraftPick.count({ where: { seasonId: next.id } })).toBeGreaterThan(0);
    }
  );

  it.failing(
    // BUG (src/lib/sports/predictions.ts): resolveMatchPredictions reads the open predictions without a lock and
    // credits them with no idempotency key, so two settlements of one match (the match-day button and the cron, or a
    // retry) both pay every winner. Remove .failing once settlement claims its rows.
    "pays each winner once when two settlements of one match race",
    async () => {
      await raceSettlement(w);
    }
  );
});

/** A completed match 3-1 to the home side, with Ana (home 100), Ben (away 60) and Cleo (home 40) still open. */
async function settledMatch(w: World) {
  const season = await w.db.sportSeason.create({
    data: { leagueId: w.leagueId, seasonNumber: 1, status: "in_progress", startIxTime: START },
  });
  const match = await w.db.sportMatch.create({
    data: {
      seasonId: season.id,
      matchDay: 1,
      homeTeamId: w.north,
      awayTeamId: w.south,
      homeScore: 3,
      awayScore: 1,
      status: "completed",
      scheduledIxTime: START,
    },
  });
  await w.db.sportPrediction.createMany({
    data: [
      [w.ana, "home", 100],
      [w.ben, "away", 60],
      [w.cleo, "home", 40],
    ].map(([who, outcome, stake]) => ({
      matchId: match.id,
      seasonId: season.id,
      userId: (who as Person).clerkUserId,
      outcome: outcome as string,
      stake: stake as number,
      createdIxTime: START,
    })),
  });
  return match;
}

async function raceSettlement(w: World) {
  const match = await settledMatch(w);
  await Promise.all([
    resolveMatchPredictions(w.db, match.id, "home"),
    resolveMatchPredictions(w.db, match.id, "home"),
  ]);
  // The pool of 200 goes to the home backers pro rata, once: Ana 100/140, Cleo 40/140
  expect(await sovereignsOf(w.db, [w.ana.id, w.ben.id, w.cleo.id])).toEqual({
    [w.ana.id]: 500 + (100 * 200) / 140,
    [w.ben.id]: 500,
    [w.cleo.id]: 500 + (40 * 200) / 140,
  });
  const settled = await w.db.sportPrediction.findMany({ where: { matchId: match.id } });
  expect(settled.map((s) => s.status).sort()).toEqual(["lost", "won", "won"]);
}

describeWithDb("sports-season (Postgres)", () => {
  const db = scenarioDb();
  let w: World;

  beforeEach(async () => {
    mockDb = db;
    w = await seed(db, prefix());
  });
  afterEach(() => removeSportsWorld(db, w.p));
  afterAll(() => db.$disconnect());

  it.failing(
    // BUG (src/lib/sports/predictions.ts): no row lock and no idempotency key on the payout; see the memory case.
    "pays each winner once when two settlements of one match race",
    async () => {
      await raceSettlement(w);
    }
  );

  it("pays a club's match revenue once when two collections race (the row lock)", async () => {
    const match = await settledMatch(w);
    const collect = () => lifecycle(asPerson(db, w.cleo)).collectMatchRevenue({ teamId: w.north });
    const results = await Promise.all([collect(), collect()]);
    expect(results.map((r) => r.matchesCollected).sort()).toEqual([0, 1]);
    const club = await db.sportTeam.findUniqueOrThrow({ where: { id: w.north } });
    expect(club.budget).toBe(100_000 + TICKETS + BASE_FEE + WIN_BONUS);
    expect(
      await db.sportMatch.findUniqueOrThrow({
        where: { id: match.id },
        select: { homeRevenueCollectedAt: true, awayRevenueCollectedAt: true },
      })
    ).toEqual({ homeRevenueCollectedAt: expect.any(Date), awayRevenueCollectedAt: null });
  });
});
