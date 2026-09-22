/**
 * Sport Definitions Registry (PRD §8, §9, §46, §49)
 * Pure, centralized factory providing sport definitions, terminology, and period configurations.
 */

import type { SportDefinition } from "./types";
import { soccerDefinition } from "./soccer";
import { hockeyDefinition } from "./hockey";
import { f1Definition } from "./f1";
import { basketballDefinition } from "./basketball";
import { footballDefinition } from "./football";
import { baseballDefinition } from "./baseball";
import { boxingDefinition } from "./boxing";

export * from "./types";
export {
  soccerDefinition,
  hockeyDefinition,
  f1Definition,
  basketballDefinition,
  footballDefinition,
  baseballDefinition,
  boxingDefinition,
};

export const SPORT_DEFINITIONS: Record<string, SportDefinition> = {
  soccer: soccerDefinition,
  hockey: hockeyDefinition,
  f1: f1Definition,
  basketball: basketballDefinition,
  football: footballDefinition,
  baseball: baseballDefinition,
  boxing: boxingDefinition,
};

/**
 * Resolves a SportDefinition by sport preset key with a safe fallback to soccer.
 */
export function getSportDefinition(presetKey?: string | null): SportDefinition {
  if (!presetKey) return soccerDefinition;
  const normalized = presetKey.toLowerCase().trim();
  return SPORT_DEFINITIONS[normalized] ?? soccerDefinition;
}
