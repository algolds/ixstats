import type { TeamRatingVector } from "./types";

export interface TeamStorytellerModifiers {
  saintName?: string;
  saintBlessing?: number;
  countryScandal?: number;
}

export interface ModifiedTeamRatings {
  team: TeamRatingVector;
  seedDelta: number;
}

/**
 * Applies Saint Blessings and Country Scandals to team ratings and seed adjustment
 */
export function applyStorytellerModifiers(
  team: TeamRatingVector,
  modifiers?: TeamStorytellerModifiers,
  isHome: boolean = true
): ModifiedTeamRatings {
  const modified = { ...team };
  let seedDelta = 0;

  if (modifiers?.saintBlessing) {
    modified.overall += modifiers.saintBlessing;
    modified.form += modifiers.saintBlessing * 2;
    seedDelta += isHome ? 1047 : -1047;
  }

  if (modifiers?.countryScandal) {
    modified.overall -= modifiers.countryScandal;
    modified.form -= modifiers.countryScandal * 2;
  }

  return {
    team: modified,
    seedDelta,
  };
}
