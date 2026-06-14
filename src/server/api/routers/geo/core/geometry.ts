import type { Geometry } from "geojson";

/** Recursively extract all [lng, lat] positions from a GeoJSON geometry */
export function extractAllPositions(geometry: Geometry): [number, number][] {
  const positions: [number, number][] = [];
  function scan(coords: unknown): void {
    if (!Array.isArray(coords)) return;
    if (coords.length >= 2 && typeof coords[0] === "number" && typeof coords[1] === "number") {
      positions.push([coords[0] as number, coords[1] as number]);
      return;
    }
    for (const c of coords) scan(c);
  }
  if ("coordinates" in geometry) {
    scan((geometry as { coordinates: unknown }).coordinates);
  }
  return positions;
}

/**
 * Approximate area in square kilometers using the Shoelace formula
 * with a latitude-dependent scaling factor.
 */
export function computeApproxAreaForFeature(geometry: Geometry): number {
  try {
    const coords: [number, number][][] = [];
    if (geometry.type === "Polygon") {
      coords.push(...(geometry.coordinates as [number, number][][]));
    } else if (geometry.type === "MultiPolygon") {
      coords.push(...(geometry.coordinates as [number, number][][][]).flat());
    } else if (geometry.type === "LineString") {
      coords.push(geometry.coordinates as [number, number][]);
    } else if (geometry.type === "MultiLineString") {
      coords.push(...(geometry.coordinates as [number, number][][]));
    }

    let totalArea = 0;
    for (const ring of coords) {
      if (ring.length < 3) continue;
      // Close the ring if not closed
      const closed = [...ring];
      const first = closed[0];
      const last = closed[closed.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) {
        closed.push([...first] as [number, number]);
      }

      // Compute centroid of the ring to find latitude
      let sumLng = 0,
        sumLat = 0;
      for (const [lng, lat] of closed) {
        sumLng += lng;
        sumLat += lat;
      }
      // eslint-disable-next-line unused-imports/no-unused-vars
      const cLng = sumLng / closed.length;
      const cLat = sumLat / closed.length;
      const latRad = (cLat * Math.PI) / 180;
      const kmPerDegLng = 111.32 * Math.cos(latRad);
      const kmPerDegLat = 110.574;

      let area = 0;
      for (let i = 0; i < closed.length - 1; i++) {
        const [x1, y1] = closed[i];
        const [x2, y2] = closed[i + 1];
        area += x1 * kmPerDegLng * (y2 * kmPerDegLat) - x2 * kmPerDegLng * (y1 * kmPerDegLat);
      }
      totalArea += Math.abs(area) / 2;
    }
    return Math.round(totalArea * 100) / 100;
  } catch {
    return 0;
  }
}

/**
 * Compute the visual center of a polygon ring (approximate center of its bounding box).
 * Handles antimeridian wrapping by normalizing longitudes.
 */
export function computeVisualCenter(geometry: any): [number, number] {
  const rings: number[][][] = [];
  const geomType = geometry?.type;
  const coords = geometry?.coordinates;
  if (geomType === "Polygon" && coords) {
    rings.push(coords[0]);
  } else if (geomType === "MultiPolygon" && coords) {
    for (const poly of coords) rings.push(poly[0]);
  }
  if (rings.length === 0) return [0, 0];

  let largestRing = rings[0];
  for (let i = 1; i < rings.length; i++) {
    if (rings[i].length > largestRing.length) largestRing = rings[i];
  }

  let minLng = Infinity,
    maxLng = -Infinity;
  let minLat = Infinity,
    maxLat = -Infinity;
  for (const [lng, lat] of largestRing) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  // Handle antimeridian wrap: if bbox width > 300deg, it likely wraps
  if (maxLng - minLng > 300) {
    minLng = Infinity;
    maxLng = -Infinity;
    for (const [lng] of largestRing) {
      const norm = lng < 0 ? lng + 360 : lng;
      if (norm < minLng) minLng = norm;
      if (norm > maxLng) maxLng = norm;
    }
    let centerLng = (minLng + maxLng) / 2;
    if (centerLng > 180) centerLng -= 360;
    return [centerLng, (minLat + maxLat) / 2];
  }

  return [(minLng + maxLng) / 2, (minLat + maxLat) / 2];
}

/**
 * Estimate the fractional overlap between a GeoJSON geometry and a bounding box.
 * Returns 0–1 representing approximate area overlap.
 * This is a rough heuristic; PostGIS ST_Intersection would be precise.
 */
export function estimateBboxOverlap(
  geometry: import("geojson").Geometry,
  minLng: number,
  minLat: number,
  maxLng: number,
  maxLat: number
): number {
  // Extract coordinates to compute feature bbox
  const coords = extractCoords(geometry);
  if (coords.length === 0) return 0;

  let fMinLng = Infinity,
    fMinLat = Infinity,
    fMaxLng = -Infinity,
    fMaxLat = -Infinity;
  for (const [lng, lat] of coords) {
    if (lng < fMinLng) fMinLng = lng;
    if (lng > fMaxLng) fMaxLng = lng;
    if (lat < fMinLat) fMinLat = lat;
    if (lat > fMaxLat) fMaxLat = lat;
  }

  // Compute intersection of the two bboxes
  const iMinLng = Math.max(minLng, fMinLng);
  const iMinLat = Math.max(minLat, fMinLat);
  const iMaxLng = Math.min(maxLng, fMaxLng);
  const iMaxLat = Math.min(maxLat, fMaxLat);

  if (iMinLng >= iMaxLng || iMinLat >= iMaxLat) return 0;

  const iArea = (iMaxLng - iMinLng) * (iMaxLat - iMinLat);
  const fArea = (fMaxLng - fMinLng) * (fMaxLat - fMinLat);

  if (fArea <= 0) return 0;
  return Math.min(1, iArea / fArea);
}

/** Extract all coordinate pairs from a GeoJSON geometry (first 200 for performance). */
export function extractCoords(geometry: import("geojson").Geometry): [number, number][] {
  const result: [number, number][] = [];
  const limit = 200;

  function walk(coords: any): void {
    if (result.length >= limit) return;
    if (coords.length >= 2 && typeof coords[0] === "number" && typeof coords[1] === "number") {
      result.push([coords[0] as number, coords[1] as number]);
    } else {
      for (const c of coords) walk(c);
    }
  }

  if ("coordinates" in geometry) walk(geometry.coordinates);
  return result;
}
