/**
 * wiki-ixworld-mapper.ts — Maps wiki-extracted geographic data to IxWorld map features.
 *
 * Takes coordinates and geographic names from the wiki analyzer and matches them
 * against existing IxWorld map features in the database.
 *
 * Server-side only — requires database access via Prisma.
 */

import { type PrismaClient } from "@prisma/client";

// ── Types ──

export interface IxWorldMatch {
  /** The matched map feature ID */
  featureId: string;
  /** Feature name */
  name: string;
  /** Match confidence 0-1 */
  confidence: number;
  /** What matched: coordinates, name, or both */
  matchType: "coordinates" | "name" | "both";
  /** Distance in km if coordinate matched */
  distanceKm?: number;
  /** Feature type (e.g., "country", "region", "city") */
  featureType?: string;
  /** Coordinates of the matched feature */
  coordinates?: [number, number];
}

export interface IxWorldMapperResult {
  /** Best matching feature */
  bestMatch: IxWorldMatch | null;
  /** All candidate matches sorted by confidence */
  candidates: IxWorldMatch[];
  /** Nearby countries/features for context */
  neighbors: Array<{ name: string; featureId: string; distanceKm: number }>;
  /** Suggested region name */
  suggestedRegion?: string;
}

// ── Haversine Distance ──

function haversineKm(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ── Name Similarity ──

function computeNameSimilarity(a: string, b: string): number {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const na = normalize(a);
  const nb = normalize(b);

  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.8;

  // Levenshtein distance based similarity
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return 0;

  const dist = levenshteinDistance(na, nb);
  return Math.max(0, 1 - dist / maxLen);
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0) as number[]);

  for (let i = 0; i <= m; i++) dp[i]![0] = i;
  for (let j = 0; j <= n; j++) dp[0]![j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(
        dp[i - 1]![j]! + 1,
        dp[i]![j - 1]! + 1,
        dp[i - 1]![j - 1]! + cost
      );
    }
  }

  return dp[m]![n]!;
}

// ── Main Mapper ──

/**
 * Match extracted wiki data against IxWorld map features.
 *
 * @param coordinates - [longitude, latitude] from wiki extraction
 * @param countryName - Country name to match by name
 * @param db - Prisma client instance
 * @param borderNames - Optional list of neighboring country names from wiki
 */
export async function matchToIxWorld(
  coordinates: [number, number] | null,
  countryName: string,
  db: PrismaClient,
  _borderNames?: string[]
): Promise<IxWorldMapperResult> {
  const candidates: IxWorldMatch[] = [];

  try {
    // Query map features from database
    // Look for GeoFeature or MapPin models
    const features = await (db as any).geoFeature?.findMany({
      where: {
        OR: [
          { featureType: { in: ["country", "nation", "state", "territory"] } },
          { name: { contains: countryName.substring(0, 3), mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        name: true,
        featureType: true,
        centroidLon: true,
        centroidLat: true,
      },
      take: 100,
    }) ?? [];

    for (const feature of features) {
      let confidence = 0;
      let matchType: "coordinates" | "name" | "both" = "name";
      let distanceKm: number | undefined;

      // Name matching
      const nameSimilarity = computeNameSimilarity(countryName, feature.name);

      // Coordinate matching
      if (coordinates && feature.centroidLon != null && feature.centroidLat != null) {
        distanceKm = haversineKm(
          coordinates[0],
          coordinates[1],
          feature.centroidLon,
          feature.centroidLat
        );

        // Within 50km = strong coordinate match
        const coordConfidence = distanceKm < 50 ? 0.9 : distanceKm < 200 ? 0.6 : distanceKm < 500 ? 0.3 : 0;

        if (nameSimilarity > 0.5 && coordConfidence > 0.3) {
          confidence = Math.min(1, nameSimilarity * 0.5 + coordConfidence * 0.5);
          matchType = "both";
        } else if (coordConfidence > nameSimilarity) {
          confidence = coordConfidence;
          matchType = "coordinates";
        } else {
          confidence = nameSimilarity;
          matchType = "name";
        }
      } else {
        confidence = nameSimilarity;
      }

      if (confidence > 0.2) {
        candidates.push({
          featureId: feature.id,
          name: feature.name,
          confidence,
          matchType,
          distanceKm,
          featureType: feature.featureType,
          coordinates:
            feature.centroidLon != null
              ? [feature.centroidLon, feature.centroidLat]
              : undefined,
        });
      }
    }
  } catch {
    // GeoFeature model may not exist or query may fail — continue with empty results
  }

  // Sort by confidence
  candidates.sort((a, b) => b.confidence - a.confidence);

  const bestMatch = candidates.length > 0 ? candidates[0]! : null;

  // Find neighbors (nearby features)
  const neighbors: Array<{ name: string; featureId: string; distanceKm: number }> = [];
  if (bestMatch?.coordinates) {
    for (const candidate of candidates.slice(1, 6)) {
      if (candidate.coordinates && candidate.distanceKm) {
        neighbors.push({
          name: candidate.name,
          featureId: candidate.featureId,
          distanceKm: candidate.distanceKm,
        });
      }
    }
  }

  // Determine region from best match or neighbors
  let suggestedRegion: string | undefined;
  if (bestMatch?.featureType) {
    suggestedRegion = bestMatch.featureType;
  }

  return {
    bestMatch,
    candidates: candidates.slice(0, 10),
    neighbors,
    suggestedRegion,
  };
}
