/**
 * Sports Engine — Elo & Strength Calculations
 */

import type { TeamRatingVector } from "./types";

export function computeStrength(team: TeamRatingVector): number {
  return (
    team.overall * 0.35 +
    team.offense * 0.2 +
    team.defense * 0.2 +
    team.form * 0.15 +
    team.depth * 0.05 +
    team.coaching * 0.05
  );
}

export function computeEloDelta(
  rating: number,
  opponentRating: number,
  actualScore: number,
  kFactor: number
): number {
  const expected = 1 / (1 + Math.pow(10, (opponentRating - rating) / 400));
  return kFactor * (actualScore - expected);
}
