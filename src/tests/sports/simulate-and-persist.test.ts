/**
 * simulateAndPersistMatch (plans 345 Step 1 + 320): fixed-seed replay and idempotency.
 *
 * - Replay: the same match simulated twice (even with the roster in a different DB
 *   order) persists an identical result + snapshot, and re-running the resolver from
 *   the stored snapshot reproduces the stored score and trace.
 * - Idempotency: completing the same match twice claims it once, so standings,
 *   rating vectors and player stats are only applied once.
 * - Knockout bouts (simulateAndPersistBout) persist the same replayable snapshot.
 * - Hockey standings: 2 for a win, 1 for an overtime / shootout loss, 0 otherwise.
 */
import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import type { Prisma } from "@prisma/client";
import { IxTime } from "~/lib/ixtime";
import { POINTS_FOR_DRAW, POINTS_FOR_WIN, pointsFor } from "~/lib/sports/presets";
import { decidedAfterRegulation } from "~/lib/sports/match-outcome";
import {
  matchSeed,
  resolveFromSnapshot,
  simulateAndPersistBout,
  simulateAndPersistMatch,
  standingDelta,
  type PersistedBoutResult,
  type PersistedMatchStats,
  type SimMatch,
  type SimTeam,
} from "~/lib/sports/simulate-and-persist";

const FIXED_IXTIME = 1_900_000_000_000;
const POSITIONS = ["GK", "CB", "CB", "FB", "FB", "CM", "CM", "CM", "AM", "W", "ST", "ST"];
const HOCKEY_POSITIONS = ["G", "D", "D", "D", "D", "C", "C", "LW", "LW", "RW", "RW", "C"];

function team(
  id: string,
  base: number,
  nationId: string | null,
  positions: string[] = POSITIONS
): SimTeam {
  return {
    id,
    name: `${id} FC`,
    nationId,
    patronSaint: nationId ? "St. Test" : null,
    tacticalIntent: "neutral",
    lineup: null,
    players: positions.map((position, i) => ({
      id: `${id}_p${String(i).padStart(2, "0")}`,
      firstName: `${id}${i}`,
      lastName: "Player",
      position,
      careerStage: "prime",
      isActive: true,
      morale: 40 + i,
      ratings: {
        overall: base + (i % 5),
        shooting: base + 2,
        passing: base,
        pace: base + 1,
        defending: base - 1,
        physical: base,
        composure: base,
      },
    })),
    coaches: [{ isActive: true, ratings: { strategy: 60 } }],
  };
}

function fixture(): SimMatch {
  return {
    id: "match_1",
    seasonId: "season_1",
    matchDay: 4,
    homeTeamId: "home",
    awayTeamId: "away",
    homeTeam: team("home", 64, "nation_h"),
    awayTeam: team("away", 60, null),
  };
}

const LEAGUE = { sportPreset: "soccer", archetype: "league" };

type StandingRow = ReturnType<typeof standingDelta>;
type StandingField = keyof StandingRow;
type ClaimArgs = {
  where: { id: string; status: string };
  data: { homeScore: number; awayScore: number; matchStats: PersistedMatchStats };
};
type BoutClaimArgs = {
  where: { id: string; status: string };
  data: { winnerId: string; status: string; resolvedIxTime: number; result: PersistedBoutResult };
};
type UpsertArgs = {
  where: { seasonId_teamId: { seasonId: string; teamId: string } };
  create: StandingRow & { seasonId: string; teamId: string };
  update: Record<StandingField, { increment: number }>;
};

/** In-memory stand-in for the Prisma calls simulateAndPersistMatch makes. */
function fakeDb(rivalryIntensity: number | null = null) {
  let status = "scheduled";
  let boutStatus = "scheduled";
  const standings = new Map<string, StandingRow>();
  const sportMatch = {
    updateMany: jest.fn(async (args: ClaimArgs) => {
      if (args.where.status !== status) return { count: 0 };
      status = "completed";
      return { count: 1 };
    }),
  };
  const sportBracket = {
    updateMany: jest.fn(async (args: BoutClaimArgs) => {
      if (args.where.status !== boutStatus) return { count: 0 };
      boutStatus = "completed";
      return { count: 1 };
    }),
  };
  const sportStanding = {
    upsert: jest.fn(async (args: UpsertArgs) => {
      const teamId = args.where.seasonId_teamId.teamId;
      const row = standings.get(teamId);
      if (!row) {
        const c = args.create;
        standings.set(teamId, {
          wins: c.wins,
          draws: c.draws,
          losses: c.losses,
          points: c.points,
          pointsFor: c.pointsFor,
          pointsAgainst: c.pointsAgainst,
        });
        return;
      }
      for (const field of Object.keys(args.update) as StandingField[]) {
        row[field] += args.update[field].increment;
      }
    }),
  };
  const sportTeamSeason = { updateMany: jest.fn(async () => ({ count: 1 })) };
  const sportMatchStat = { createMany: jest.fn(async () => ({ count: 1 })) };
  const sportRivalry = {
    findFirst: jest.fn(async () =>
      rivalryIntensity === null ? null : { intensity: rivalryIntensity }
    ),
  };
  const fake = {
    sportMatch,
    sportBracket,
    sportStanding,
    sportTeamSeason,
    sportMatchStat,
    sportRivalry,
    sportPlayer: { updateMany: jest.fn(async () => ({ count: 1 })) },
    storytellerEffect: {
      findMany: jest.fn(async () => [
        {
          id: "effect_1",
          countryId: "nation_h",
          inputType: "sports_saint_blessing",
          value: 2,
          isActive: true,
        },
      ]),
    },
  };
  return {
    db: fake as unknown as Prisma.TransactionClient,
    sportMatch,
    sportBracket,
    sportStanding,
    sportTeamSeason,
    sportMatchStat,
    sportRivalry,
    standings,
  };
}

function claimArgs(fake: ReturnType<typeof fakeDb>): ClaimArgs {
  const call = fake.sportMatch.updateMany.mock.calls[0];
  if (!call) throw new Error("match was never claimed");
  return call[0];
}

describe("simulateAndPersistMatch", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(IxTime, "getCurrentIxTime").mockReturnValue(FIXED_IXTIME);
  });

  it("persists an identical result + snapshot for the same match, whatever the roster order", async () => {
    const first = fakeDb();
    const second = fakeDb();
    const reordered = fixture();
    reordered.homeTeam.players.reverse();
    reordered.awayTeam.players.reverse();

    await simulateAndPersistMatch(first.db, { match: fixture(), league: LEAGUE });
    await simulateAndPersistMatch(second.db, { match: reordered, league: LEAGUE });

    const persisted = claimArgs(first);
    expect(persisted.where).toEqual({ id: "match_1", status: "scheduled" });
    expect(claimArgs(second).data).toEqual(persisted.data);
    expect(second.sportMatchStat.createMany.mock.calls).toEqual(
      first.sportMatchStat.createMany.mock.calls
    );

    const snapshot = persisted.data.matchStats.simulationSnapshot;
    expect(snapshot.seed).toBe(matchSeed(fixture()));
    expect(snapshot.capturedIxTime).toBe(FIXED_IXTIME);
    expect(snapshot.homeTeamSnapshot.roster).toHaveLength(POSITIONS.length);
    expect(snapshot.homeTeamSnapshot.morale).toBe(46); // mean of 40..51, rounded
    expect(snapshot.homeTeamSnapshot.worldModifiers).toMatchObject({
      saintName: "St. Test",
      saintBlessing: 2,
    });
    expect(snapshot.awayTeamSnapshot.worldModifiers).toBeNull();
  });

  it("replays the stored result from the persisted (JSON) snapshot alone", async () => {
    const fake = fakeDb();
    await simulateAndPersistMatch(fake.db, { match: fixture(), league: LEAGUE });
    const persisted = claimArgs(fake).data;
    const stored = JSON.parse(JSON.stringify(persisted.matchStats)) as PersistedMatchStats;

    const replay = resolveFromSnapshot(stored.simulationSnapshot);

    expect(replay.homeScore).toBe(persisted.homeScore);
    expect(replay.awayScore).toBe(persisted.awayScore);
    expect(replay.trace).toEqual(stored.trace);
  });

  it("uses the rivalry intensity for home advantage (one lookup)", async () => {
    const derby = fakeDb(85);
    await simulateAndPersistMatch(derby.db, { match: fixture(), league: LEAGUE });
    expect(claimArgs(derby).data.matchStats.simulationSnapshot.homeAdvantage).toBe(65);
    expect(derby.sportRivalry.findFirst).toHaveBeenCalledTimes(1);

    const normal = fakeDb();
    await simulateAndPersistMatch(normal.db, { match: fixture(), league: LEAGUE });
    expect(claimArgs(normal).data.matchStats.simulationSnapshot.homeAdvantage).toBe(55);
  });

  it("completing the same match twice does not double-count standings", async () => {
    const fake = fakeDb();

    const firstRun = await simulateAndPersistMatch(fake.db, { match: fixture(), league: LEAGUE });
    const secondRun = await simulateAndPersistMatch(fake.db, { match: fixture(), league: LEAGUE });

    expect(firstRun).not.toBeNull();
    expect(secondRun).toBeNull();
    expect(fake.sportMatch.updateMany).toHaveBeenCalledTimes(2);
    expect(fake.sportStanding.upsert).toHaveBeenCalledTimes(2);
    expect(fake.sportTeamSeason.updateMany).toHaveBeenCalledTimes(2);
    expect(fake.sportMatchStat.createMany.mock.calls.length).toBeLessThanOrEqual(1);

    const { homeScore, awayScore } = claimArgs(fake).data;
    expect(fake.standings.get("home")).toEqual(
      standingDelta("soccer", homeScore, awayScore, false)
    );
    expect(fake.standings.get("away")).toEqual(
      standingDelta("soccer", awayScore, homeScore, false)
    );
  });

  it("gives the hockey overtime / shootout loser one point and the winner two", async () => {
    const hockey = { sportPreset: "hockey", archetype: "division_conference" };
    // Find a fixture whose seed takes the game past regulation (the seed is the match id).
    let overtime: { fake: ReturnType<typeof fakeDb>; persisted: ClaimArgs["data"] } | null = null;
    for (let i = 0; i < 200 && !overtime; i++) {
      const fake = fakeDb();
      const match: SimMatch = {
        ...fixture(),
        id: `hockey_${i}`,
        homeTeam: team("home", 62, null, HOCKEY_POSITIONS),
        awayTeam: team("away", 62, null, HOCKEY_POSITIONS),
      };
      await simulateAndPersistMatch(fake.db, { match, league: hockey });
      const persisted = claimArgs(fake).data;
      if (decidedAfterRegulation("hockey", persisted.matchStats.trace)) {
        overtime = { fake, persisted };
      }
    }
    if (!overtime) throw new Error("no hockey fixture went past regulation");

    const { homeScore, awayScore } = overtime.persisted;
    const winner = homeScore > awayScore ? "home" : "away";
    const loser = winner === "home" ? "away" : "home";
    expect(homeScore).not.toBe(awayScore);
    expect(overtime.fake.standings.get(winner)).toMatchObject({ wins: 1, losses: 0, points: 2 });
    expect(overtime.fake.standings.get(loser)).toMatchObject({ wins: 0, losses: 1, points: 1 });
  });
});

describe("simulateAndPersistBout", () => {
  const bout = {
    id: "bout_1",
    seasonId: "season_1",
    round: 2,
    fighter1Id: "home",
    fighter2Id: "away",
  };

  function simulateBout(fake: ReturnType<typeof fakeDb>) {
    const { homeTeam, awayTeam } = fixture();
    return simulateAndPersistBout(fake.db, {
      bout,
      fighter1: homeTeam,
      fighter2: awayTeam,
      sportPreset: "soccer",
    });
  }

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(IxTime, "getCurrentIxTime").mockReturnValue(FIXED_IXTIME);
  });

  it("replays a knockout bout from its stored (JSON) snapshot alone", async () => {
    const fake = fakeDb();
    await simulateBout(fake);
    const call = fake.sportBracket.updateMany.mock.calls[0];
    if (!call) throw new Error("bout was never claimed");
    const { where, data } = call[0];
    const stored = JSON.parse(JSON.stringify(data.result)) as PersistedBoutResult;
    const snapshot = stored.simulationSnapshot;

    expect(where).toEqual({ id: "bout_1", status: "scheduled" });
    expect(snapshot.seed).toBe(matchSeed({ id: "bout_1", seasonId: "season_1", matchDay: 2 }));
    expect(snapshot.archetype).toBe("bracket");
    expect(snapshot.capturedIxTime).toBe(FIXED_IXTIME);
    expect(data.resolvedIxTime).toBe(FIXED_IXTIME);

    const replay = resolveFromSnapshot(snapshot);
    expect(replay.homeScore).toBe(stored.homeScore);
    expect(replay.awayScore).toBe(stored.awayScore);
    expect(replay.trace).toEqual(stored.trace);
    expect(data.winnerId).toBe(replay.winner === "home" ? "home" : "away");
    expect(stored.winner).toBe(data.winnerId);
  });

  it("claims a bout once and persists the same result on every run", async () => {
    const fake = fakeDb();
    const first = await simulateBout(fake);
    const second = await simulateBout(fake);
    const other = fakeDb();
    const rerun = await simulateBout(other);

    expect(first).not.toBeNull();
    expect(second).toBeNull();
    expect(rerun).toEqual(first);
    expect(fake.sportStanding.upsert).not.toHaveBeenCalled();
  });
});

describe("pointsFor", () => {
  it("uses 3 / 1 / 0 outside hockey, where an overtime loss is just a loss", () => {
    expect(pointsFor("soccer", "win")).toBe(POINTS_FOR_WIN);
    expect(pointsFor("soccer", "draw")).toBe(POINTS_FOR_DRAW);
    expect(pointsFor("basketball", "loss")).toBe(0);
    expect(pointsFor("basketball", "overtimeLoss")).toBe(0);
  });

  it("uses 2 for a hockey win, 1 for an overtime loss, 0 for a regulation loss", () => {
    expect(pointsFor("hockey", "win")).toBe(2);
    expect(pointsFor("hockey", "overtimeLoss")).toBe(1);
    expect(pointsFor("hockey", "loss")).toBe(0);
  });
});

describe("standingDelta", () => {
  it("counts a hockey overtime loss as a loss worth one point", () => {
    expect(standingDelta("hockey", 2, 3, true)).toEqual({
      wins: 0,
      draws: 0,
      losses: 1,
      points: 1,
      pointsFor: 2,
      pointsAgainst: 3,
    });
    expect(standingDelta("hockey", 3, 2, true)).toMatchObject({ wins: 1, points: 2 });
    expect(standingDelta("hockey", 1, 4, false)).toMatchObject({ losses: 1, points: 0 });
    expect(standingDelta("soccer", 2, 3, true)).toMatchObject({ losses: 1, points: 0 });
  });

  it("awards POINTS_FOR_WIN / POINTS_FOR_DRAW and tracks goals for/against", () => {
    expect(standingDelta("soccer", 2, 1, false)).toEqual({
      wins: 1,
      draws: 0,
      losses: 0,
      points: POINTS_FOR_WIN,
      pointsFor: 2,
      pointsAgainst: 1,
    });
    expect(standingDelta("soccer", 1, 1, false)).toEqual({
      wins: 0,
      draws: 1,
      losses: 0,
      points: POINTS_FOR_DRAW,
      pointsFor: 1,
      pointsAgainst: 1,
    });
    expect(standingDelta("soccer", 0, 3, false)).toEqual({
      wins: 0,
      draws: 0,
      losses: 1,
      points: 0,
      pointsFor: 0,
      pointsAgainst: 3,
    });
  });
});
