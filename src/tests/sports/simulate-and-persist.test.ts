/**
 * simulateAndPersistMatch (plans 345 Step 1 + 320): fixed-seed replay and idempotency.
 *
 * - Replay: the same match simulated twice (even with the roster in a different DB
 *   order) persists an identical result + snapshot, and re-running the resolver from
 *   the stored snapshot reproduces the stored score and trace.
 * - Idempotency: completing the same match twice claims it once, so standings,
 *   rating vectors and player stats are only applied once.
 */
import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import type { Prisma } from "@prisma/client";
import { IxTime } from "~/lib/ixtime";
import { POINTS_FOR_DRAW, POINTS_FOR_WIN } from "~/lib/sports/presets";
import {
  matchSeed,
  resolveFromSnapshot,
  simulateAndPersistMatch,
  standingDelta,
  type PersistedMatchStats,
  type SimMatch,
  type SimTeam,
} from "~/lib/sports/simulate-and-persist";

const FIXED_IXTIME = 1_900_000_000_000;
const POSITIONS = ["GK", "CB", "CB", "FB", "FB", "CM", "CM", "CM", "AM", "W", "ST", "ST"];

function team(id: string, base: number, nationId: string | null): SimTeam {
  return {
    id,
    name: `${id} FC`,
    nationId,
    patronSaint: nationId ? "St. Test" : null,
    tacticalIntent: "neutral",
    lineup: null,
    players: POSITIONS.map((position, i) => ({
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
type UpsertArgs = {
  where: { seasonId_teamId: { seasonId: string; teamId: string } };
  create: StandingRow & { seasonId: string; teamId: string };
  update: Record<StandingField, { increment: number }>;
};

/** In-memory stand-in for the Prisma calls simulateAndPersistMatch makes. */
function fakeDb(rivalryIntensity: number | null = null) {
  let status = "scheduled";
  const standings = new Map<string, StandingRow>();
  const sportMatch = {
    updateMany: jest.fn(async (args: ClaimArgs) => {
      if (args.where.status !== status) return { count: 0 };
      status = "completed";
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
    expect(fake.standings.get("home")).toEqual(standingDelta(homeScore, awayScore));
    expect(fake.standings.get("away")).toEqual(standingDelta(awayScore, homeScore));
  });
});

describe("standingDelta", () => {
  it("awards POINTS_FOR_WIN / POINTS_FOR_DRAW and tracks goals for/against", () => {
    expect(standingDelta(2, 1)).toEqual({
      wins: 1,
      draws: 0,
      losses: 0,
      points: POINTS_FOR_WIN,
      pointsFor: 2,
      pointsAgainst: 1,
    });
    expect(standingDelta(1, 1)).toEqual({
      wins: 0,
      draws: 1,
      losses: 0,
      points: POINTS_FOR_DRAW,
      pointsFor: 1,
      pointsAgainst: 1,
    });
    expect(standingDelta(0, 3)).toEqual({
      wins: 0,
      draws: 0,
      losses: 1,
      points: 0,
      pointsFor: 0,
      pointsAgainst: 3,
    });
  });
});
