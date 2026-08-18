import { createRNG } from "./resolver";
import { advanceCareerStage } from "./talent";
import type { CareerStage } from "./talent";

export interface AgingResult {
  playerId: string;
  oldStage: CareerStage;
  newStage: CareerStage;
  ageDelta: number;
  ratingChanges: Record<string, number>;
  retired: boolean;
}

const STAGE_RATING_SHIFTS: Record<CareerStage, { min: number; max: number }> = {
  rookie: { min: 5, max: 10 },
  developing: { min: 3, max: 7 },
  prime: { min: -1, max: 3 },
  plateau: { min: -3, max: 1 },
  declining: { min: -8, max: -3 },
  retired: { min: -10, max: -10 },
};

const COACH_STAGE_RATING_SHIFTS: Record<CareerStage, { min: number; max: number }> = {
  rookie: { min: 3, max: 6 },
  developing: { min: 2, max: 5 },
  prime: { min: -1, max: 2 },
  plateau: { min: -2, max: 1 },
  declining: { min: -5, max: -2 },
  retired: { min: -5, max: -5 },
};

import { clamp } from "~/lib/utils";

export function processAging(args: {
  players: Array<{
    id: string;
    age: number;
    careerStage: CareerStage;
    ratings: Record<string, number>;
  }>;
  coaches: Array<{
    id: string;
    age: number;
    careerStage: CareerStage;
    ratings: {
      strategy: number;
      development: number;
      motivation: number;
      adaptability: number;
    };
    teamId: string;
  }>;
  coachMap: Map<string, number>;
  seed: number;
}): { playerResults: AgingResult[]; coachResults: AgingResult[] } {
  const rng = createRNG(args.seed);

  const playerResults: AgingResult[] = [];

  for (const player of args.players) {
    const newAge = player.age + 1;
    const teamCoachDev = args.coachMap.get(player.id) ?? 50;

    const newStage = advanceCareerStage(
      player.careerStage,
      newAge,
      teamCoachDev,
      args.seed + player.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0)
    );

    const shift = STAGE_RATING_SHIFTS[newStage];
    const ratingChanges: Record<string, number> = {};

    for (const [key, rating] of Object.entries(player.ratings)) {
      const delta = shift.min + rng() * (shift.max - shift.min);
      ratingChanges[key] = clamp(Math.round(rating + delta), 1, 99) - rating;
    }

    playerResults.push({
      playerId: player.id,
      oldStage: player.careerStage,
      newStage,
      ageDelta: 1,
      ratingChanges,
      retired: newStage === "retired",
    });
  }

  const coachResults: AgingResult[] = [];

  for (const coach of args.coaches) {
    const newAge = coach.age + 1;
    const selfDev = coach.ratings.development;

    const newCoachStage = advanceCareerStage(
      coach.careerStage,
      newAge,
      selfDev,
      args.seed + 100000 + coach.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0)
    );

    const shift = COACH_STAGE_RATING_SHIFTS[newCoachStage];
    const ratingChanges: Record<string, number> = {};

    for (const [key, rating] of Object.entries(coach.ratings)) {
      const delta = shift.min + rng() * (shift.max - shift.min);
      ratingChanges[key] = clamp(Math.round(rating + delta), 1, 99) - rating;
    }

    coachResults.push({
      playerId: coach.id,
      oldStage: coach.careerStage,
      newStage: newCoachStage,
      ageDelta: 1,
      ratingChanges,
      retired: newCoachStage === "retired",
    });
  }

  return { playerResults, coachResults };
}
