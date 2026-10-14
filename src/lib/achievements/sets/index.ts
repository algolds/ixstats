/**
 * Every achievement definition. To add a set, create `sets/<name>.ts` exporting an array of
 * `AchievementDefinition` and add one spread to `ALL_DEFINITIONS` (above the End of days line).
 */

import type { AchievementDefinition } from "../definitions";
import { RECRUITER_ACHIEVEMENTS, SOCIAL_ACHIEVEMENTS } from "../definitions-social";
import { BASE_DEFINITIONS } from "./base";
import { DIPLOMACY_DEFINITIONS } from "./diplomacy";
import { endOfDays } from "./end-of-days";
import { LEGACY_DEFINITIONS } from "./legacy";
import { NATION_DEFINITIONS } from "./nation";

export const ALL_DEFINITIONS: AchievementDefinition[] = [
  ...BASE_DEFINITIONS,
  ...SOCIAL_ACHIEVEMENTS,
  ...RECRUITER_ACHIEVEMENTS,
  ...LEGACY_DEFINITIONS,
  ...DIPLOMACY_DEFINITIONS,
  ...NATION_DEFINITIONS,
  endOfDays(() => ALL_DEFINITIONS),
];
