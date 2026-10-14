/**
 * Every achievement definition. To add a set, create `sets/<name>.ts` exporting an array of
 * `AchievementDefinition` and add one spread to `ALL_DEFINITIONS` (above the End of days line).
 */

import type { AchievementDefinition } from "../definitions";
import { RECRUITER_ACHIEVEMENTS, SOCIAL_ACHIEVEMENTS } from "../definitions-social";
import { BASE_DEFINITIONS } from "./base";
import { endOfDays } from "./end-of-days";
import { EXECUTIVE_DEFINITIONS } from "./executive";
import { LEGACY_DEFINITIONS } from "./legacy";
import { PLATFORM_DEFINITIONS } from "./platform";
import { POLITICS_DEFINITIONS } from "./politics";

export const ALL_DEFINITIONS: AchievementDefinition[] = [
  ...BASE_DEFINITIONS,
  ...SOCIAL_ACHIEVEMENTS,
  ...RECRUITER_ACHIEVEMENTS,
  ...LEGACY_DEFINITIONS,
  ...EXECUTIVE_DEFINITIONS,
  ...POLITICS_DEFINITIONS,
  ...PLATFORM_DEFINITIONS,
  endOfDays(() => ALL_DEFINITIONS),
];
