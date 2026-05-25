/**
 * smart-placement.ts — Simple placement suggestions based on existing features.
 *
 * For cities: suggests centroids of subdivisions that don't have a city yet.
 * For POIs: suggests capital city locations that don't have POIs nearby.
 */

export interface PlacementSuggestion {
  coordinates: [number, number];
  label: string;
  reason: string;
}

interface FeatureInput {
  type: string;
  coordinates?: [number, number];
  geometry?: { type: string; coordinates?: number[][][] };
  properties?: Record<string, unknown>;
  name?: string;
}

/** Haversine distance in km between two [lng, lat] points. */
function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLng = ((b[0] - a[0]) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a[1] * Math.PI) / 180) * Math.cos((b[1] * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

/** Compute the centroid of a polygon's first ring. */
function polygonCentroid(coords: number[][]): [number, number] {
  let sumLng = 0;
  let sumLat = 0;
  const ring = coords;
  for (const pt of ring) {
    sumLng += pt[0] ?? 0;
    sumLat += pt[1] ?? 0;
  }
  const n = ring.length || 1;
  return [sumLng / n, sumLat / n];
}

export function getSuggestedPlacements(
  mode: string,
  features: FeatureInput[],
  countryBbox?: [number, number, number, number]
): PlacementSuggestion[] {
  const suggestions: PlacementSuggestion[] = [];

  const cities = features.filter((f) => f.type === "city");
  const pois = features.filter((f) => f.type === "poi");
  const subdivisions = features.filter((f) => f.type === "subdivision");

  if (mode === "add-city") {
    // Suggest centroids of subdivisions that don't have a city nearby
    for (const sub of subdivisions) {
      if (!sub.geometry?.coordinates?.[0]) continue;
      const centroid = polygonCentroid(sub.geometry.coordinates[0]);
      const hasCityNearby = cities.some(
        (c) => c.coordinates && haversineKm(c.coordinates, centroid) < 50
      );
      if (!hasCityNearby) {
        suggestions.push({
          coordinates: centroid,
          label: sub.name ? `Near ${sub.name}` : "Region centroid",
          reason: "This region has no cities yet",
        });
      }
      if (suggestions.length >= 5) break;
    }
  }

  if (mode === "add-poi") {
    // Suggest capital city locations that don't have POIs nearby
    const capitals = cities.filter((c) => c.properties?.isNationalCapital);
    for (const cap of capitals) {
      if (!cap.coordinates) continue;
      const hasPoiNearby = pois.some(
        (p) => p.coordinates && haversineKm(p.coordinates, cap.coordinates!) < 30
      );
      if (!hasPoiNearby) {
        suggestions.push({
          coordinates: cap.coordinates,
          label: cap.name ? `Near ${cap.name}` : "Near capital",
          reason: "Capital area has no POIs",
        });
      }
    }

    // Also suggest subdivision centroids with no POIs
    for (const sub of subdivisions) {
      if (!sub.geometry?.coordinates?.[0]) continue;
      const centroid = polygonCentroid(sub.geometry.coordinates[0]);
      const hasPoiNearby = pois.some(
        (p) => p.coordinates && haversineKm(p.coordinates, centroid) < 30
      );
      if (!hasPoiNearby) {
        suggestions.push({
          coordinates: centroid,
          label: sub.name ? `In ${sub.name}` : "Region center",
          reason: "No POIs in this region",
        });
      }
      if (suggestions.length >= 5) break;
    }
  }

  return suggestions.slice(0, 5);
}
