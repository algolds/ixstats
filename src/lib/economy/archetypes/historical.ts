/**
 * Historical Economic Archetypes
 *
 * Contains pre-configured economic models based on significant historical periods
 * and empires. These archetypes provide insights into economic systems that shaped
 * world history from the medieval period through the early 20th century.
 */

import type { EconomicArchetype } from "./types";
import rawData from "./historical.json";

export const historicalArchetypes = new Map<string, EconomicArchetype>(
  (rawData as unknown as EconomicArchetype[]).map((archetype) => [archetype.id, archetype])
);
