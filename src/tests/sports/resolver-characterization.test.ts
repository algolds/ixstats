/**
 * The sports resolver corpus. resolveMatch is pinned (plan 315): the full result (scores, key stats, rating deltas,
 * evaluation vector and the play-by-play trace) for fixed seeds, one per sport and modifier path, so a refactor keeps
 * the exact RNG call order and arithmetic. Hockey never ends in a draw and its overtime call reads from the trace
 * (standings points depend on it). A live broadcast reveals only the events up to its minute. simulateAndPersistMatch
 * (plans 345 Step 1 + 320) persists the same result and snapshot whatever the roster order, and the stored snapshot
 * alone replays it; a knockout bout is claimed once and replays the same way. Once-only completion and the points
 * rules are asserted in tests/scenarios/engines/sports-season.test.ts.
 *
 * Folds hockey, live-match and simulate-and-persist.
 */
import { beforeEach, describe, it, expect, jest } from "@jest/globals";
import type { Prisma } from "@prisma/client";
import { createHash } from "crypto";
import { createRNG, resolveMatch } from "~/lib/sports/resolver";
import type { ExtendedMatchResult, TeamRatingVector } from "~/lib/sports/types";
import type { RosterPlayer } from "~/lib/sports/resolvers";
import { runHockeyMatch } from "~/lib/sports/resolvers/hockey";
import type { SportResolverContext } from "~/lib/sports/resolvers/types";
import { decidedAfterRegulation } from "~/lib/sports/match-outcome";
import { computeLiveMatchState, type LiveTraceEvent } from "~/lib/sports/live-match";
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

type ResolveArgs = Parameters<typeof resolveMatch>[0];
type Summary = Omit<ExtendedMatchResult, "trace"> & { traceLength: number };

const strong: TeamRatingVector = {
  overall: 82,
  offense: 84,
  defense: 78,
  form: 70,
  depth: 76,
  coaching: 80,
};
const average: TeamRatingVector = {
  overall: 62,
  offense: 60,
  defense: 64,
  form: 55,
  depth: 58,
  coaching: 60,
};
const weak: TeamRatingVector = {
  overall: 48,
  offense: 45,
  defense: 50,
  form: 40,
  depth: 44,
  coaching: 40,
};

function roster(prefix: string, positions: string[]): RosterPlayer[] {
  return positions.map((position, i) => ({
    id: `${prefix}_${i}`,
    firstName: `${prefix}First${i}`,
    lastName: `${prefix}Last${i}`,
    position,
    ratings: { overall: 55 + ((i * 7) % 30), offense: 60, defense: 58 },
  }));
}

const HOCKEY_POSITIONS = ["G", "D", "D", "D", "D", "C", "C", "LW", "LW", "RW", "RW"];

const CASES: Record<string, ResolveArgs> = {
  soccerDefault: {
    sport: "soccer",
    homeTeam: strong,
    awayTeam: weak,
    archetype: "league",
    seed: 12345,
  },
  soccerDivineDerby: {
    sport: "soccer",
    homeTeam: average,
    awayTeam: strong,
    archetype: "cup",
    seed: 4242,
    context: { isPlayoff: true },
    homeTeamModifiers: { saintName: "St. A", saintBlessing: 3 },
    awayTeamModifiers: { saintName: "St. B", saintBlessing: 2, countryScandal: 4 },
  },
  hockeyPlayoffRosters: {
    sport: "hockey",
    homeTeam: strong,
    awayTeam: average,
    archetype: "division_conference",
    seed: 99,
    context: { isPlayoff: true, homeAdvantage: 60 },
    homeRoster: roster("hh", HOCKEY_POSITIONS),
    awayRoster: roster("ah", HOCKEY_POSITIONS),
  },
  basketballSlidersIntents: {
    sport: "basketball",
    homeTeam: average,
    awayTeam: strong,
    archetype: "league",
    seed: 31337,
    context: { isChampionship: true, homeAdvantage: 45 },
    homeTacticalIntent: "gegenpressing",
    awayTacticalIntent: "tiki_taka",
    homeLineup: { attackFocus: 80, teamIntensity: 70 },
    awayLineup: { attackFocus: 20, teamIntensity: 30 },
  },
  footballScandalCpuTactics: {
    sport: "football",
    homeTeam: weak,
    awayTeam: strong,
    archetype: "league",
    seed: 2024,
    homeTeamModifiers: { countryScandal: 5 },
    awayLineup: { attackFocus: "high", teamIntensity: 90 },
  },
  baseballCounterAttack: {
    sport: "baseball",
    homeTeam: strong,
    awayTeam: weak,
    archetype: "league",
    seed: 5150,
    homeTacticalIntent: "counter_attack",
    awayTacticalIntent: "kick_and_rush",
  },
};

const EXPECTED: Record<string, { summary: Summary; digest: string }> = {
  soccerDefault: {
    summary: {
      homeScore: 4,
      awayScore: 3,
      winner: "home",
      upset: false,
      upsetFactor: 0.6579999999999999,
      keyStats: {
        homeStrength: 79.5,
        awayStrength: 46.6,
        differential: 32.9,
        dominance: 0.62,
        tempo: 0.9,
        volatility: 0.9,
      },
      homeRatingDelta: 7.23,
      awayRatingDelta: -7.23,
      evaluation: { winProbability: 0.55, dominance: 0.62, tempo: 0.9, volatility: 0.9 },
      traceLength: 17,
    },
    digest: "c819ddcbc56bab31c5d4c0118e3e7a592f2aab4a9f1cce7aab67acd68d95f13f",
  },
  soccerDivineDerby: {
    summary: {
      homeScore: 0,
      awayScore: 1,
      winner: "away",
      upset: false,
      upsetFactor: 0.28,
      keyStats: {
        homeStrength: 63.7,
        awayStrength: 77.7,
        differential: -14,
        dominance: 0.44,
        tempo: 0.9,
        volatility: 0.95,
      },
      homeRatingDelta: -11.47,
      awayRatingDelta: 11.47,
      evaluation: { winProbability: 0.48, dominance: 0.44, tempo: 0.9, volatility: 0.95 },
      traceLength: 14,
    },
    digest: "18e03ddc9d4a149ffa685b169b71df41bda7eecc34c1b631b377ca94a144e2c7",
  },
  hockeyPlayoffRosters: {
    summary: {
      homeScore: 0,
      awayScore: 1,
      winner: "away",
      upset: true,
      upsetFactor: 0.375,
      keyStats: {
        homeStrength: 80,
        awayStrength: 61.25,
        differential: 18.75,
        dominance: 0.56,
        tempo: 0.9,
        volatility: 0.94,
      },
      homeRatingDelta: -12.65,
      awayRatingDelta: 12.65,
      evaluation: { winProbability: 0.53, dominance: 0.56, tempo: 0.9, volatility: 0.94 },
      traceLength: 8,
    },
    digest: "2f99139872710e9264a9498278a15b27cd69fb895f81fb6269468f78f39bfde6",
  },
  basketballSlidersIntents: {
    summary: {
      homeScore: 98,
      awayScore: 125,
      winner: "away",
      upset: false,
      upsetFactor: 0.2849999999999997,
      keyStats: {
        homeStrength: 67.55,
        awayStrength: 81.8,
        differential: -14.25,
        dominance: 0.43,
        tempo: 1.05,
        volatility: 0.94,
      },
      homeRatingDelta: -15.14,
      awayRatingDelta: 15.14,
      evaluation: { winProbability: 0.47, dominance: 0.43, tempo: 1.05, volatility: 0.94 },
      traceLength: 136,
    },
    digest: "189916a846cc0d035aef8c0c4791c6a4003a74736befe45d154bab4f7c5c1f19",
  },
  footballScandalCpuTactics: {
    summary: {
      homeScore: 16,
      awayScore: 34,
      winner: "away",
      upset: false,
      upsetFactor: 0.703,
      keyStats: {
        homeStrength: 43.85,
        awayStrength: 79,
        differential: -35.15,
        dominance: 0.38,
        tempo: 1.1,
        volatility: 0.9,
      },
      homeRatingDelta: -7.16,
      awayRatingDelta: 7.16,
      evaluation: { winProbability: 0.45, dominance: 0.38, tempo: 1.1, volatility: 0.9 },
      traceLength: 35,
    },
    digest: "05308d8bff4fa3cc56993aadf5f68649eb32204c93e9828b057df3e9df6b762c",
  },
  baseballCounterAttack: {
    summary: {
      homeScore: 5,
      awayScore: 0,
      winner: "home",
      upset: false,
      upsetFactor: 0.7259999999999998,
      keyStats: {
        homeStrength: 81.9,
        awayStrength: 45.6,
        differential: 36.3,
        dominance: 0.65,
        tempo: 1.5,
        volatility: 0.9,
      },
      homeRatingDelta: 7.23,
      awayRatingDelta: -7.23,
      evaluation: { winProbability: 0.55, dominance: 0.65, tempo: 1.5, volatility: 0.9 },
      traceLength: 10,
    },
    digest: "1e41bb8a6ce2b08c20d9fd0880a03e398f81d8e3302f817dda802cc12149fb2e",
  },
};

function summarize(result: ExtendedMatchResult): Summary {
  const { trace, ...rest } = result;
  return { ...rest, traceLength: trace.length };
}

function digest(value: ExtendedMatchResult): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

describe("resolveMatch characterization (fixed seeds)", () => {
  for (const [name, args] of Object.entries(CASES)) {
    it(`${name} is byte-identical to the pinned result`, () => {
      const result = resolveMatch(args);
      const actual = { summary: summarize(result), digest: digest(result) };
      if (process.env.CHARACTERIZE === "1") {
        console.log(`CHAR ${name} ${JSON.stringify(actual)}`);
        return;
      }
      expect(actual).toEqual(EXPECTED[name]);
    });
  }
});

describe("Ice Hockey 3-Period Match Resolver", () => {
  const createMockContext = (
    seed: number,
    overrides?: Partial<SportResolverContext>
  ): SportResolverContext => ({
    rng: createRNG(seed),
    homeOffense: 75,
    homeDefense: 70,
    awayOffense: 72,
    awayDefense: 74,
    homeTactical: "neutral",
    awayTactical: "neutral",
    homeTeamModified: { overall: 73, offense: 75, defense: 70, form: 50, depth: 50, coaching: 50 },
    awayTeamModified: { overall: 73, offense: 72, defense: 74, form: 50, depth: 50, coaching: 50 },
    isPlayoff: false,
    isChampionship: false,
    archetype: "league",
    homeRoster: [
      {
        id: "h_f1",
        firstName: "Connor",
        lastName: "McPlayer",
        position: "C",
        ratings: { overall: 92, shooting: 90, passing: 95 },
      },
      {
        id: "h_f2",
        firstName: "Leon",
        lastName: "Striker",
        position: "LW",
        ratings: { overall: 88, shooting: 89, passing: 85 },
      },
      {
        id: "h_d1",
        firstName: "Cale",
        lastName: "Blueline",
        position: "D",
        ratings: { overall: 90, defense: 92, skating: 91 },
      },
      {
        id: "h_g1",
        firstName: "Igor",
        lastName: "Netminder",
        position: "G",
        ratings: { overall: 91, defense: 91 },
      },
    ],
    awayRoster: [
      {
        id: "a_f1",
        firstName: "Auston",
        lastName: "Sniper",
        position: "C",
        ratings: { overall: 91, shooting: 93, passing: 84 },
      },
      {
        id: "a_f2",
        firstName: "Mitch",
        lastName: "Playmaker",
        position: "RW",
        ratings: { overall: 87, shooting: 82, passing: 92 },
      },
      {
        id: "a_d1",
        firstName: "Victor",
        lastName: "Anchor",
        position: "D",
        ratings: { overall: 89, defense: 90, skating: 88 },
      },
      {
        id: "a_g1",
        firstName: "Andrei",
        lastName: "Wall",
        position: "G",
        ratings: { overall: 90, defense: 90 },
      },
    ],
    ...overrides,
  });
  it("resolves ties with 3-on-3 Overtime or Shootout without draws", () => {
    // Force tied ratings
    for (let seed = 100; seed <= 150; seed++) {
      const ctx = createMockContext(seed, {
        homeOffense: 50,
        homeDefense: 50,
        awayOffense: 50,
        awayDefense: 50,
      });
      const outcome = runHockeyMatch(ctx);
      // Hockey matches must never end in a draw
      expect(outcome.homeScore).not.toEqual(outcome.awayScore);
    }
  });

  it("reads an overtime / shootout decision from the trace (tied after 60 minutes)", () => {
    let overtimeGames = 0;
    let regulationGames = 0;
    for (let seed = 100; seed <= 150; seed++) {
      const outcome = runHockeyMatch(
        createMockContext(seed, {
          homeOffense: 50,
          homeDefense: 50,
          awayOffense: 50,
          awayDefense: 50,
        })
      );
      const tiedAfterRegulation = outcome.trace.some((e) =>
        e.description.startsWith("END OF REGULATION")
      );
      expect(decidedAfterRegulation("hockey", outcome.trace)).toBe(tiedAfterRegulation);
      // Only hockey awards an overtime-loss point.
      expect(decidedAfterRegulation("soccer", outcome.trace)).toBe(false);
      if (tiedAfterRegulation) overtimeGames++;
      else regulationGames++;
    }
    expect(overtimeGames).toBeGreaterThan(0);
    expect(regulationGames).toBeGreaterThan(0);
  });
});

const trace: LiveTraceEvent[] = [
  { t: 10, type: "goal", team: "home", description: "1-0" },
  { t: 35, type: "card", team: "away", description: "yellow" },
  { t: 55, type: "goal", team: "away", description: "1-1" },
  { t: 80, type: "goal", team: "home", description: "2-1" },
];

const base = {
  trace,
  resolvedIxTime: 1000,
  windowMs: 100, // broadcast spans 100 IxMs; maxMinute = 80
  finalHomeScore: 2,
  finalAwayScore: 1,
};

describe("computeLiveMatchState", () => {
  it("mid-broadcast reveals only events up to the current minute", () => {
    // 50% through 100ms window -> minute 40 of 80 -> first goal (t=10) only
    const s = computeLiveMatchState({ ...base, nowMs: 1050 });
    expect(s.minute).toBe(40);
    expect(s.homeScore).toBe(1);
    expect(s.awayScore).toBe(0);
    expect(s.lastEvent?.type).toBe("card"); // t=35 is the latest <= 40
  });
});

const FIXED_IXTIME = 1_790_000_000_000; // real epoch-ms: sports run on real time
const POSITIONS = ["GK", "CB", "CB", "FB", "FB", "CM", "CM", "CM", "AM", "W", "ST", "ST"];

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
function fakeDb(
  rivalryIntensity: number | null = null,
  meetings: Array<{ homeScore: number; awayScore: number }> = []
) {
  let status = "scheduled";
  let boutStatus = "scheduled";
  const standings = new Map<string, StandingRow>();
  const sportMatch = {
    updateMany: jest.fn(async (args: ClaimArgs) => {
      if (args.where.status !== status) return { count: 0 };
      status = "completed";
      return { count: 1 };
    }),
    findMany: jest.fn(async () => meetings),
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
      rivalryIntensity === null ? null : { id: "rivalry_1", intensity: rivalryIntensity }
    ),
    update: jest.fn(async (_args: unknown) => ({})),
    upsert: jest.fn(async (_args: unknown) => ({})),
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
    jest.spyOn(Date, "now").mockReturnValue(FIXED_IXTIME);
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
    jest.spyOn(Date, "now").mockReturnValue(FIXED_IXTIME);
  });

  it("claims a bout once, persists the same result on every run and replays it from its stored snapshot", async () => {
    const fake = fakeDb();
    const first = await simulateBout(fake);
    expect(await simulateBout(fake)).toBeNull();
    expect(await simulateBout(fakeDb())).toEqual(first);
    expect(fake.sportStanding.upsert).not.toHaveBeenCalled();

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
});
