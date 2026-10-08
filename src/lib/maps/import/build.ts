/**
 * From an engine result to the nations' borders in lon/lat: group the source regions by the nation the admin
 * mapped them to, merge each nation's regions (along their shared arcs for a PNG topology, by polygon union for
 * SVG and GeoJSON), georeference pixel coordinates, and tidy the rings (rounded, deduplicated, degenerate rings
 * dropped, holes reassigned by containment so orientation is right after the y axis flips). Pure.
 */
import type { Feature, MultiPolygon, Polygon, Position } from "geojson";
import { union } from "@turf/union";
import { featureCollection } from "@turf/helpers";
import { assembleRings, signedRingArea } from "~/lib/maps/ring-assembly";
import { transformPolygonal, type PixelToLonLat } from "./georef";
import type { EngineResult } from "./options";

const topoClient = require("topojson-client") as {
  feature: (topology: unknown, object: unknown) => Feature<Polygon | MultiPolygon>;
  merge: (topology: unknown, objects: unknown[]) => MultiPolygon;
};

interface TopologyLike {
  objects: { regions?: { geometries?: Array<{ type: string; properties?: { key?: string } }> } };
}

export interface NationGeometry {
  nation: string;
  /** The source region keys it was built from. */
  keys: string[];
  geometry: Polygon | MultiPolygon;
}

export interface BuiltNations {
  nations: NationGeometry[];
  /** Mapped keys the result does not have. */
  missingKeys: string[];
  /** Nations whose regions vanished after tidying (too small to draw). */
  empty: string[];
}

const COORD_DECIMALS = 5;
const round = (v: number) => Math.round(v * 10 ** COORD_DECIMALS) / 10 ** COORD_DECIMALS;

function rings(geometry: Polygon | MultiPolygon): Position[][] {
  return geometry.type === "Polygon" ? geometry.coordinates : geometry.coordinates.flat();
}

/** Rounded rings without repeated points; rings that no longer enclose anything are dropped. */
export function tidyGeometry(
  geometry: Polygon | MultiPolygon,
  decimals = true
): Polygon | MultiPolygon | null {
  const kept: Position[][] = [];
  for (const ring of rings(geometry)) {
    const out: Position[] = [];
    for (const p of ring) {
      const q: Position = decimals ? [round(p[0]!), round(p[1]!)] : [p[0]!, p[1]!];
      const last = out[out.length - 1];
      if (!last || last[0] !== q[0] || last[1] !== q[1]) out.push(q);
    }
    if (out.length > 1) {
      const first = out[0]!;
      const last = out[out.length - 1]!;
      if (first[0] !== last[0] || first[1] !== last[1]) out.push([first[0]!, first[1]!]);
    }
    if (out.length >= 4 && Math.abs(signedRingArea(out)) > 0) kept.push(out);
  }
  return kept.length ? assembleRings(kept, "evenodd") : null;
}

/** One geometry from several: their union, or (if the union fails) the pieces side by side. */
export function unionGeometries(geometries: Array<Polygon | MultiPolygon>): Polygon | MultiPolygon {
  if (geometries.length === 1) return geometries[0]!;
  try {
    const merged = union(
      featureCollection(
        geometries.map((g) => ({ type: "Feature" as const, properties: {}, geometry: g }))
      )
    );
    if (merged?.geometry) return merged.geometry;
  } catch {
    // fall through: keep the pieces side by side
  }
  return {
    type: "MultiPolygon",
    coordinates: geometries.flatMap((g) =>
      g.type === "Polygon" ? [g.coordinates] : g.coordinates
    ),
  };
}

/** The regions of a PNG engine topology with these keys as one geometry (merged along shared arcs), in pixels. */
export function topologyGeometry(
  topology: unknown,
  keys: readonly string[]
): Polygon | MultiPolygon | null {
  const objects = ((topology as TopologyLike).objects.regions?.geometries ?? []).filter((g) =>
    keys.includes(g.properties?.key ?? "")
  );
  if (objects.length === 0) return null;
  if (objects.length === 1) return topoClient.feature(topology, objects[0]).geometry;
  return topoClient.merge(topology, objects);
}

/** Source key → its geometry (in the result's own coordinate space), merged per nation. */
function nationGeometry(result: EngineResult, keys: string[]): Polygon | MultiPolygon | null {
  if (result.topology) return topologyGeometry(result.topology, keys);
  const pieces = (result.features?.features ?? [])
    .filter((f) => keys.includes(f.properties.key))
    .map((f) => f.geometry);
  return pieces.length ? unionGeometries(pieces) : null;
}

/**
 * Each mapped nation's border. `mapping` is source key → nation name (null or empty = not imported);
 * `transform` georeferences a pixel-space result (ignored for a lon/lat result).
 */
export function buildNationGeometries(
  result: EngineResult,
  mapping: Readonly<Record<string, string | null | undefined>>,
  transform: PixelToLonLat | null
): BuiltNations {
  const known = new Set(result.regions.map((r) => r.key));
  const byNation = new Map<string, string[]>();
  const missingKeys: string[] = [];
  for (const [key, raw] of Object.entries(mapping)) {
    const nation = raw?.trim();
    if (!nation) continue;
    if (!known.has(key)) {
      missingKeys.push(key);
      continue;
    }
    byNation.set(nation, [...(byNation.get(nation) ?? []), key]);
  }

  const nations: NationGeometry[] = [];
  const empty: string[] = [];
  for (const [nation, keys] of byNation) {
    const merged = nationGeometry(result, keys);
    const placed =
      merged && result.space === "pixel" && transform
        ? transformPolygonal(merged, transform)
        : merged;
    const geometry = placed ? tidyGeometry(placed) : null;
    if (geometry) nations.push({ nation, keys, geometry });
    else empty.push(nation);
  }
  nations.sort((a, b) => a.nation.localeCompare(b.nation));
  return { nations, missingKeys, empty };
}
