import { distanceKm as haversineKm } from "~/lib/maps/geo-math";

const DEG2RAD = Math.PI / 180;

/** Spherical midpoint — correct even across the antimeridian */
export function sphericalMidpoint(a: [number, number], b: [number, number]): [number, number] {
  const lat1 = a[1] * DEG2RAD;
  const lng1 = a[0] * DEG2RAD;
  const lat2 = b[1] * DEG2RAD;
  const lng2 = b[0] * DEG2RAD;
  const dLng = lng2 - lng1;
  const bx = Math.cos(lat2) * Math.cos(dLng);
  const by = Math.cos(lat2) * Math.sin(dLng);
  const midLat = Math.atan2(
    Math.sin(lat1) + Math.sin(lat2),
    Math.sqrt((Math.cos(lat1) + bx) ** 2 + by ** 2)
  );
  const midLng = lng1 + Math.atan2(by, Math.cos(lat1) + bx);
  return [midLng / DEG2RAD, midLat / DEG2RAD];
}

/** Adaptive interpolation density based on segment distance */
export function segmentCount(a: [number, number], b: [number, number]): number {
  const km = haversineKm(a, b);
  if (km < 100) return 1;
  if (km < 500) return 8;
  if (km < 2000) return 16;
  if (km < 5000) return 32;
  return 64;
}

/** Spherical linear interpolation (SLERP) along the great-circle arc */
export function interpolateGreatCircle(
  a: [number, number],
  b: [number, number],
  numSegments: number
): [number, number][] {
  if (numSegments <= 1) return [a, b];

  const lat1 = a[1] * DEG2RAD;
  const lng1 = a[0] * DEG2RAD;
  const lat2 = b[1] * DEG2RAD;
  const lng2 = b[0] * DEG2RAD;

  // 3D unit vectors
  const ax = Math.cos(lat1) * Math.cos(lng1);
  const ay = Math.cos(lat1) * Math.sin(lng1);
  const az = Math.sin(lat1);
  const bx = Math.cos(lat2) * Math.cos(lng2);
  const by = Math.cos(lat2) * Math.sin(lng2);
  const bz = Math.sin(lat2);

  // Angular distance
  const dot = Math.max(-1, Math.min(1, ax * bx + ay * by + az * bz));
  const d = Math.acos(dot);

  // Coincident points
  if (d < 1e-10) return [a, b];

  const sinD = Math.sin(d);
  const points: [number, number][] = [];

  for (let i = 0; i <= numSegments; i++) {
    const t = i / numSegments;
    const A = Math.sin((1 - t) * d) / sinD;
    const B = Math.sin(t * d) / sinD;
    const x = A * ax + B * bx;
    const y = A * ay + B * by;
    const z = A * az + B * bz;
    const lat = Math.atan2(z, Math.sqrt(x * x + y * y)) / DEG2RAD;
    const lng = Math.atan2(y, x) / DEG2RAD;
    points.push([lng, lat]);
  }

  return points;
}

export type LineGeometry =
  | { type: "LineString"; coordinates: [number, number][] }
  | { type: "MultiLineString"; coordinates: [number, number][][] };

/** Build a LineString/MultiLineString that splits at the antimeridian */
export function buildMeasureLineGeometry(points: [number, number][]): LineGeometry {
  if (points.length < 2) {
    return { type: "LineString", coordinates: points };
  }

  const segments: [number, number][][] = [];
  let current: [number, number][] = [points[0]];

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const dLng = curr[0] - prev[0];

    if (Math.abs(dLng) > 180) {
      // Antimeridian crossing — unwrap to find the true interpolated crossing
      const unwrappedLng = dLng > 0 ? curr[0] - 360 : curr[0] + 360;
      const boundaryLng = prev[0] >= 0 ? 180 : -180;
      const t = (boundaryLng - prev[0]) / (unwrappedLng - prev[0]);
      const crossLat = prev[1] + t * (curr[1] - prev[1]);

      current.push([boundaryLng, crossLat]);
      segments.push(current);
      current = [[-boundaryLng, crossLat], curr];
    } else {
      current.push(curr);
    }
  }
  segments.push(current);

  const valid = segments.filter((s) => s.length >= 2);
  if (valid.length === 1) {
    return { type: "LineString", coordinates: valid[0] };
  }
  return { type: "MultiLineString", coordinates: valid };
}

// ─── Formatting ──────────────────────────────────────────────────

export function formatDistance(km: number): string {
  const mi = km * 0.621371;
  if (km < 1) return `${Math.round(km * 1000)} m (${Math.round(mi * 5280)} ft)`;
  return `${km.toFixed(1)} km (${mi.toFixed(1)} mi)`;
}

/** Custom SVG cursor: blue crosshair with center dot */
export const MEASURE_CURSOR = (() => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><line x1="12" y1="2" x2="12" y2="9" stroke="%233b82f6" stroke-width="2"/><line x1="12" y1="15" x2="12" y2="22" stroke="%233b82f6" stroke-width="2"/><line x1="2" y1="12" x2="9" y2="12" stroke="%233b82f6" stroke-width="2"/><line x1="15" y1="12" x2="22" y2="12" stroke="%233b82f6" stroke-width="2"/><circle cx="12" cy="12" r="2" fill="%233b82f6"/></svg>`;
  return `url("data:image/svg+xml,${svg}") 12 12, crosshair`;
})();
