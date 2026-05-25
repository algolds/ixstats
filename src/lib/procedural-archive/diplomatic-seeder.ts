/**
 * Diplomatic Seeder — Initial relationships between generated countries
 *
 * Seeds baseline diplomatic relationships, alliances, and embassy
 * networks for procedurally created worlds.
 */

import { makeRng } from "./rng";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export type RelationshipLevel = "allied" | "friendly" | "neutral" | "tense" | "hostile";

export interface DiplomaticRelation {
  countryA: string;
  countryB: string;
  level: RelationshipLevel;
  reason: string;
}

export interface Alliance {
  name: string;
  members: string[];
  type: "military" | "economic" | "cultural";
}

export interface DiplomaticSeedResult {
  relations: DiplomaticRelation[];
  alliances: Alliance[];
}

export interface DiplomaticSeedInput {
  id: string;
  name: string;
  neighbors: string[];
  cultureId?: number;
  economicTier?: string;
  population?: number;
}

// ──────────────────────────────────────────────
// Seeder
// ──────────────────────────────────────────────

export function seedDiplomacy(
  countries: DiplomaticSeedInput[],
  seed: number
): DiplomaticSeedResult {
  const rng = makeRng(seed);
  const relations: DiplomaticRelation[] = [];
  const pairSet = new Set<string>();

  const addRelation = (a: string, b: string, level: RelationshipLevel, reason: string) => {
    const key = [a, b].sort().join("|");
    if (pairSet.has(key)) return;
    pairSet.add(key);
    relations.push({ countryA: a, countryB: b, level, reason });
  };

  // Build a lookup
  const countryMap = new Map(countries.map((c) => [c.id, c]));

  // Step 1: Neighbor-based relations
  for (const country of countries) {
    for (const neighborId of country.neighbors) {
      const neighbor = countryMap.get(neighborId);
      if (!neighbor) continue;

      // Shared culture = friendly baseline
      if (
        country.cultureId !== undefined &&
        neighbor.cultureId !== undefined &&
        country.cultureId === neighbor.cultureId
      ) {
        addRelation(country.id, neighborId, "friendly", "Shared cultural heritage");
      } else {
        // Neighbors without shared culture: neutral or tense
        const r = rng();
        if (r < 0.3) {
          addRelation(country.id, neighborId, "tense", "Border tensions");
        } else {
          addRelation(country.id, neighborId, "neutral", "Neighboring states");
        }
      }
    }
  }

  // Step 2: Generate alliances (2-4 alliances based on geographic/cultural clusters)
  const alliances: Alliance[] = [];
  const allianced = new Set<string>();

  // Sort by population descending — major powers form alliances
  const majorPowers = [...countries]
    .filter((c) => c.population && c.population > 5_000_000)
    .sort((a, b) => (b.population ?? 0) - (a.population ?? 0));

  // Form 2-4 alliances around major powers
  const numAlliances = Math.min(4, Math.max(2, Math.floor(majorPowers.length / 5)));

  for (let i = 0; i < numAlliances && i < majorPowers.length; i++) {
    const leader = majorPowers[i]!;
    if (allianced.has(leader.id)) continue;

    const members = [leader.id];
    allianced.add(leader.id);

    // Recruit neighbors and countries with shared culture
    for (const neighborId of leader.neighbors) {
      if (allianced.has(neighborId)) continue;
      const neighbor = countryMap.get(neighborId);
      if (!neighbor) continue;

      // Shared culture or friendly relations
      const isSharedCulture =
        leader.cultureId !== undefined && neighbor.cultureId === leader.cultureId;
      if (isSharedCulture || rng() < 0.4) {
        members.push(neighborId);
        allianced.add(neighborId);
        if (members.length >= 6) break;
      }
    }

    if (members.length >= 2) {
      const allianceNames = [
        "Northern Alliance",
        "Southern Pact",
        "Eastern Coalition",
        "Western Union",
        "Continental League",
        "Maritime Accord",
        "Trade Federation",
        "Defense Compact",
      ];
      const type: Alliance["type"] =
        rng() < 0.4 ? "military" : rng() < 0.7 ? "economic" : "cultural";

      alliances.push({
        name: allianceNames[i % allianceNames.length]!,
        members,
        type,
      });

      // Alliance members are friendly with each other
      for (let a = 0; a < members.length; a++) {
        for (let b = a + 1; b < members.length; b++) {
          addRelation(
            members[a]!,
            members[b]!,
            "allied",
            `Members of ${allianceNames[i % allianceNames.length]}`
          );
        }
      }
    }
  }

  return { relations, alliances };
}
