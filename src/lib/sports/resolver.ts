/**
 * Deterministic seeded PRNG using the mulberry32 algorithm.
 * Returns a function that produces pseudo-random floats in [0, 1).
 */
export function createRNG(seed: number): () => number {
  let state = seed | 0;
  return function mulberry32(): number {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface TeamRatingVector {
  overall: number;
  offense: number;
  defense: number;
  form: number;
  depth: number;
  coaching: number;
}

export interface MatchResult {
  homeScore: number;
  awayScore: number;
  winner: "home" | "away" | "draw";
  upset: boolean;
  upsetFactor: number;
  keyStats: Record<string, number>;
  homeRatingDelta: number;
  awayRatingDelta: number;
}

export interface RaceResult {
  positions: Array<{
    driverId: string;
    teamId: string;
    finishPosition: number;
    points: number;
    fastestLap: boolean;
  }>;
  dnfDriverIds: string[];
  weatherEffect: number;
}

export const F1_POINTS: Record<number, number> = {
  1: 25,
  2: 18,
  3: 15,
  4: 12,
  5: 10,
  6: 8,
  7: 6,
  8: 4,
  9: 2,
  10: 1,
};

function computeStrength(team: TeamRatingVector): number {
  return (
    team.overall * 0.35 +
    team.offense * 0.2 +
    team.defense * 0.2 +
    team.form * 0.15 +
    team.depth * 0.05 +
    team.coaching * 0.05
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function computeEloDelta(
  rating: number,
  opponentRating: number,
  actualScore: number,
  kFactor: number,
): number {
  const expected = 1 / (1 + Math.pow(10, (opponentRating - rating) / 400));
  return kFactor * (actualScore - expected);
}

export function resolveMatch(args: {
  sport: string;
  homeTeam: TeamRatingVector;
  awayTeam: TeamRatingVector;
  archetype: string;
  seed: number;
  context?: {
    isPlayoff?: boolean;
    isChampionship?: boolean;
    homeAdvantage?: number;
  };
}): MatchResult {
  const rng = createRNG(args.seed);
  const isPlayoff = args.context?.isPlayoff ?? false;
  const isChampionship = args.context?.isChampionship ?? false;

  const homeAdvantageRaw = args.context?.homeAdvantage ?? 55;
  const homeAdvantageAdjustment = (homeAdvantageRaw - 50) / 10;

  const rawHomeStrength = computeStrength(args.homeTeam);
  const rawAwayStrength = computeStrength(args.awayTeam);

  const homeStrength = rawHomeStrength + homeAdvantageAdjustment;
  const awayStrength = rawAwayStrength;
  const differential = homeStrength - awayStrength;
  const isHomeFavored = differential >= 0;

  let homeScore: number;
  let awayScore: number;

  if (args.archetype === "bracket") {
    const winProbability = 1 / (1 + Math.pow(10, (awayStrength - homeStrength) / 400));
    const roll = rng();
    if (roll < winProbability) {
      homeScore = Math.round(90 + rng() * 20);
      awayScore = Math.round(70 + rng() * 30);
      if (awayScore >= homeScore) {
        awayScore = homeScore - Math.round(1 + rng() * 8);
      }
    } else {
      awayScore = Math.round(90 + rng() * 20);
      homeScore = Math.round(70 + rng() * 30);
      if (homeScore >= awayScore) {
        homeScore = awayScore - Math.round(1 + rng() * 8);
      }
    }
    const homeWins = homeScore > awayScore;
    const actualScore = homeWins ? 1 : 0;
    const kFactor = isChampionship ? 32 : isPlayoff ? 24 : 16;
    const homeDelta = computeEloDelta(rawHomeStrength, rawAwayStrength, actualScore, kFactor);
    const awayDelta = computeEloDelta(rawAwayStrength, rawHomeStrength, 1 - actualScore, kFactor);

    return {
      homeScore: homeWins ? 1 : 0,
      awayScore: homeWins ? 0 : 1,
      winner: homeWins ? "home" : "away",
      upset: isHomeFavored ? !homeWins : homeWins,
      upsetFactor: clamp(Math.abs(differential) / 50, 0, 1),
      keyStats: {
        homeStrength,
        awayStrength,
        judgeHome: homeScore,
        judgeAway: awayScore,
      },
      homeRatingDelta: homeDelta,
      awayRatingDelta: awayDelta,
    };
  }

  if (args.archetype === "circuit") {
    throw new Error("Use resolveRace() for circuit/motorsport archetype instead of resolveMatch()");
  }

  const homeExpected = homeStrength / 20;
  const awayExpected = awayStrength / 20;
  const variance = 2.0;

  homeScore = Math.max(0, Math.round(homeExpected + (rng() * 2 - 1) * variance + rng() * 1.5));
  awayScore = Math.max(0, Math.round(awayExpected + (rng() * 2 - 1) * variance + rng() * 1.5));

  if (args.archetype === "league" && homeScore === awayScore) {
    const extraRoll = rng();
    if (extraRoll > 0.3) {
      homeScore = awayScore;
    }
  }

  let winner: "home" | "away" | "draw" = "draw";
  if (homeScore > awayScore) {
    winner = "home";
  } else if (awayScore > homeScore) {
    winner = "away";
  }

  const homeWon = winner === "home";
  const awayWon = winner === "away";
  const isDraw = winner === "draw";
  const upset =
    isDraw ? Math.abs(differential) > 10 :
    isHomeFavored ? awayWon :
    homeWon;

  const kFactor = isChampionship ? 32 : isPlayoff ? 24 : 16;
  const homeActual = homeWon ? 1 : isDraw ? 0.5 : 0;
  const awayActual = awayWon ? 1 : isDraw ? 0.5 : 0;

  const homeDelta = computeEloDelta(rawHomeStrength, rawAwayStrength, homeActual, kFactor);
  const awayDelta = computeEloDelta(rawAwayStrength, rawHomeStrength, awayActual, kFactor);

  return {
    homeScore,
    awayScore,
    winner,
    upset,
    upsetFactor: clamp(Math.abs(differential) / 50, 0, 1),
    keyStats: {
      homeStrength: Math.round(homeStrength * 100) / 100,
      awayStrength: Math.round(awayStrength * 100) / 100,
      differential: Math.round(differential * 100) / 100,
      homeExpected: Math.round(homeExpected * 100) / 100,
      awayExpected: Math.round(awayExpected * 100) / 100,
    },
    homeRatingDelta: homeDelta,
    awayRatingDelta: awayDelta,
  };
}

export function resolveRace(args: {
  drivers: Array<{
    driverId: string;
    teamId: string;
    pace: number;
    consistency: number;
    wetSkill: number;
    overtaking: number;
    tyreManagement: number;
    starts: number;
  }>;
  seed: number;
  isWet: boolean;
}): RaceResult {
  const rng = createRNG(args.seed);

  const weatherEffect = args.isWet ? 0.15 + rng() * 0.1 : 0;

  const driverPerformances = args.drivers.map((d) => {
    const racePace =
      d.pace * 0.4 +
      d.consistency * 0.15 +
      (args.isWet ? d.wetSkill * 0.2 : 0) +
      d.overtaking * 0.1 +
      d.tyreManagement * 0.1 +
      d.starts * 0.05;

    const consistencyVariance = (100 - d.consistency) / 100 * 5;
    const randomFactor = (rng() * 2 - 1) * consistencyVariance;
    const finalPace = racePace + randomFactor;

    const dnfChance = ((100 - d.consistency) / 100) * 0.08 + weatherEffect;
    const didNotFinish = rng() < dnfChance;

    return {
      driverId: d.driverId,
      teamId: d.teamId,
      finalPace,
      didNotFinish,
    };
  });

  const finishers = driverPerformances.filter((d) => !d.didNotFinish);
  finishers.sort((a, b) => b.finalPace - a.finalPace);

  const dnfs = driverPerformances.filter((d) => d.didNotFinish);
  dnfs.sort((a, b) => b.finalPace - a.finalPace);

  let fastestLapDriver = finishers[0]?.driverId ?? "";
  if (finishers.length > 1 && rng() < 0.25) {
    const altIndex = Math.min(Math.floor(rng() * 3) + 1, finishers.length - 1);
    fastestLapDriver = finishers[altIndex].driverId;
  }

  const positions = finishers.map((d, index) => ({
    driverId: d.driverId,
    teamId: d.teamId,
    finishPosition: index + 1,
    points: F1_POINTS[index + 1] ?? 0,
    fastestLap: d.driverId === fastestLapDriver,
  }));

  for (let i = 0; i < dnfs.length; i++) {
    positions.push({
      driverId: dnfs[i].driverId,
      teamId: dnfs[i].teamId,
      finishPosition: finishers.length + i + 1,
      points: 0,
      fastestLap: false,
    });
  }

  if (positions.find((p) => p.driverId === fastestLapDriver && p.finishPosition <= 10)) {
    const flDriver = positions.find((p) => p.driverId === fastestLapDriver)!;
    if (flDriver.finishPosition <= 10) {
      flDriver.points += 1;
    }
  }

  return {
    positions,
    dnfDriverIds: dnfs.map((d) => d.driverId),
    weatherEffect: Math.round(weatherEffect * 1000) / 1000,
  };
}
