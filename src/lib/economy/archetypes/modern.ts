/**
 * Modern Economic Archetypes
 *
 * Contains contemporary economic models from the late 20th and 21st centuries.
 */

import type { EconomicArchetype } from "./types";
import rawData from "./modern.json";

export const modernArchetypes = new Map<string, EconomicArchetype>(
  (rawData as unknown as EconomicArchetype[]).map((archetype) => [archetype.id, archetype])
);
