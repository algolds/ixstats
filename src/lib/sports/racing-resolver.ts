/**
 * Sports Engine — Racing & Motorsport Resolution
 */

import { createRNG } from "./rng";

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

    const consistencyVariance = ((100 - d.consistency) / 100) * 5;
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
    fastestLapDriver = finishers[altIndex]!.driverId;
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
      driverId: dnfs[i]!.driverId,
      teamId: dnfs[i]!.teamId,
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
