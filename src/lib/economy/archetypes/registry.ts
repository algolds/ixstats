/**
 * Archetype lookup for builder code that only holds an archetype id.
 *
 * useArchetypes records the archetypes it gets from the API (edited by admins at
 * /admin/economic-archetypes), so builder steps that apply an archetype by id use the admin
 * version; the built-in archetypes cover ids the API hasn't served yet.
 *
 * @module archetype-registry
 */

import type { EconomicArchetype } from "./types";
import { modernArchetypes } from "./modern";
import { historicalArchetypes } from "./historical";

const served = new Map<string, EconomicArchetype>();

export function rememberArchetypes(archetypes: readonly EconomicArchetype[]): void {
  for (const archetype of archetypes) served.set(archetype.id, archetype);
}

export function findArchetype(id: string): EconomicArchetype | undefined {
  return served.get(id) ?? modernArchetypes.get(id) ?? historicalArchetypes.get(id);
}
