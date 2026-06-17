import { greatCircle } from "@turf/turf";
import type { LineString } from "geojson";

/** Route types whose geometry should follow a great-circle arc. */
const CURVED_TYPES = new Set(["air_corridor", "shipping_lane", "ferry", "military_naval"]);

/**
 * Build a GeoJSON LineString from clicked waypoints. For air/sea route types the
 * segments between consecutive waypoints are densified into great-circle arcs
 * (the curved path airline/shipping maps show); all other types stay as straight
 * segments. Falls back to a straight segment if an arc can't be computed (e.g.
 * antimeridian crossing → Turf returns a MultiLineString) or on any error.
 */
export function buildRouteGeometry(waypoints: [number, number][], routeType: string): LineString {
  if (waypoints.length < 2 || !CURVED_TYPES.has(routeType)) {
    return { type: "LineString", coordinates: waypoints };
  }

  const coords: [number, number][] = [];
  for (let i = 1; i < waypoints.length; i++) {
    const start = waypoints[i - 1]!;
    const end = waypoints[i]!;
    if (start[0] === end[0] && start[1] === end[1]) continue;

    let segment: [number, number][];
    try {
      const arc = greatCircle(start, end, { npoints: 64 });
      segment =
        arc.geometry.type === "LineString"
          ? (arc.geometry.coordinates as [number, number][])
          : [start, end];
    } catch {
      segment = [start, end];
    }

    if (coords.length > 0) segment = segment.slice(1);
    coords.push(...segment);
  }

  return {
    type: "LineString",
    coordinates: coords.length >= 2 ? coords : waypoints,
  };
}
