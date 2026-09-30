/**
 * Characterization test for resolveMatch (plan 315).
 *
 * Pins the full result object (scores, key stats, rating deltas, evaluation
 * vector and the complete play-by-play trace) for fixed seeds, so refactors of
 * the resolver must keep the exact same RNG call order and arithmetic.
 */
import { describe, it, expect } from "@jest/globals";
import { createHash } from "crypto";
import { resolveMatch } from "~/lib/sports/resolver";
import type { ExtendedMatchResult, TeamRatingVector } from "~/lib/sports/types";
import type { RosterPlayer } from "~/lib/sports/resolvers";

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

const SOCCER_POSITIONS = ["GK", "DF", "DF", "DF", "DF", "MF", "MF", "MF", "FW", "FW", "FW"];
const HOCKEY_POSITIONS = ["G", "D", "D", "D", "D", "C", "C", "LW", "LW", "RW", "RW"];

const CASES: Record<string, ResolveArgs> = {
  soccerDefault: {
    sport: "soccer",
    homeTeam: strong,
    awayTeam: weak,
    archetype: "league",
    seed: 12345,
  },
  soccerEvenWithRosters: {
    sport: "soccer",
    homeTeam: average,
    awayTeam: average,
    archetype: "league",
    seed: 777,
    homeRoster: roster("h", SOCCER_POSITIONS),
    awayRoster: roster("a", SOCCER_POSITIONS),
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
  unknownSportFallsBackToSoccer: {
    sport: "curling",
    homeTeam: weak,
    awayTeam: weak,
    archetype: "league",
    seed: 1,
    awayTacticalIntent: "all_out_attack",
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
  soccerEvenWithRosters: {
    summary: {
      homeScore: 1,
      awayScore: 0,
      winner: "home",
      upset: false,
      upsetFactor: 0.01,
      keyStats: {
        homeStrength: 61.15,
        awayStrength: 60.65,
        differential: 0.5,
        dominance: 0.5,
        tempo: 1,
        volatility: 1,
      },
      homeRatingDelta: 8,
      awayRatingDelta: -8,
      evaluation: { winProbability: 0.5, dominance: 0.5, tempo: 1, volatility: 1 },
      traceLength: 14,
    },
    digest: "9a92e2fe7576f79cc77056897d51e2caeb85192d2b39c9bfe4f33d165c141268",
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
  unknownSportFallsBackToSoccer: {
    summary: {
      homeScore: 0,
      awayScore: 2,
      winner: "away",
      upset: true,
      upsetFactor: 0.03,
      keyStats: {
        homeStrength: 47.1,
        awayStrength: 45.6,
        differential: 1.5,
        dominance: 0.51,
        tempo: 0.9,
        volatility: 1,
      },
      homeRatingDelta: -8,
      awayRatingDelta: 8,
      evaluation: { winProbability: 0.5, dominance: 0.51, tempo: 0.9, volatility: 1 },
      traceLength: 13,
    },
    digest: "eab18e28e51b17dae7c642e3e0c7015a7be52fe1d942631c8441343fd95dee9f",
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

  it("is deterministic for the same seed", () => {
    const args = CASES.hockeyPlayoffRosters!;
    expect(digest(resolveMatch(args))).toBe(digest(resolveMatch(args)));
  });
});
