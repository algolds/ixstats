/**
 * Names — Bridge to existing Markov naming system
 *
 * Wraps the archived markov-naming.ts and language-families.ts
 * for use by the new worldgen engine.
 */

import { WorldNamingSystem } from "../procedural-archive/markov-naming";
import { getLanguageFamilies } from "../procedural-archive/language-families";
// eslint-disable-next-line unused-imports/no-unused-imports
import type { PackedGraph, WorldGenParams } from "./types";

/**
 * Create a naming system for the world.
 * Returns a WorldNamingSystem that can generate names per language family.
 */
export function createNamingSystem(params: WorldGenParams): WorldNamingSystem {
  const allFamilies = getLanguageFamilies();
  const families =
    params.languageFamilies.length > 0
      ? allFamilies.filter((f) => params.languageFamilies.includes(f.id))
      : allFamilies;

  return new WorldNamingSystem(families.length > 0 ? families : allFamilies, params.seed + 1000);
}

/**
 * Get all available language family IDs.
 */
export function getAvailableFamilyIds(): string[] {
  return getLanguageFamilies().map((f) => f.id);
}

/**
 * Generate a country name using the culture's language family.
 */
export function generateCountryName(naming: WorldNamingSystem, familyId: string): string {
  return naming.generateName(familyId, { useSuffix: true });
}

/**
 * Generate a river name using the nearest culture's language family.
 */
export function generateRiverName(naming: WorldNamingSystem, familyId: string): string {
  return naming.generateRiverName(familyId);
}

/**
 * Generate a lake name.
 */
export function generateLakeName(naming: WorldNamingSystem, familyId: string): string {
  return naming.generateLakeName(familyId);
}

/**
 * Generate a settlement name.
 */
export function generateBurgName(naming: WorldNamingSystem, familyId: string): string {
  return naming.generateName(familyId, { useSuffix: false });
}
