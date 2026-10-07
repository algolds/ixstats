/**
 * The GeoJSON engine: a whole realm's borders as one FeatureCollection (the editor's GeoJSON import works on one
 * country at a time). Checks:
 *   - CRS: a `crs` member naming anything but WGS84 lon/lat (CRS84, EPSG:4326) is refused unless every coordinate
 *     is a valid lon/lat anyway;
 *   - pixel coordinates (no CRS, values beyond lon/lat range, none negative) are taken as an image's pixels (y down)
 *     and georeferenced like a PNG.
 * Features are grouped by the chosen name property (one region per value; a nation's pieces are unioned later).
 * Pure.
 */
import type { Feature, Geometry, MultiPolygon, Polygon, Position } from "geojson";
import { unionGeometries } from "./build";
import { geojsonEngineOptionsSchema, type EngineResult, type ImportRegion } from "./options";

export class GeojsonImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeojsonImportError";
  }
}

const WGS84_CRS = /crs84|epsg:+4326|wgs\s*84/i;
const NAME_HINT = /^(name|nation|country|admin|sovereignt|title|label|state|realm)/i;

export interface GeojsonPropertyInfo {
  name: string;
  /** Distinct string values. */
  distinct: number;
  samples: string[];
}

export interface GeojsonInspection {
  features: number;
  polygons: number;
  space: "lonlat" | "pixel";
  bbox: [number, number, number, number];
  properties: GeojsonPropertyInfo[];
  suggestedNameProperty: string | null;
  warnings: string[];
}

function polygonsOf(geometry: Geometry | null | undefined): Array<Polygon | MultiPolygon> {
  if (!geometry) return [];
  if (geometry.type === "Polygon" || geometry.type === "MultiPolygon") return [geometry];
  if (geometry.type === "GeometryCollection") return geometry.geometries.flatMap(polygonsOf);
  return [];
}

function positions(geometry: Polygon | MultiPolygon): Position[] {
  return geometry.type === "Polygon" ? geometry.coordinates.flat() : geometry.coordinates.flat(2);
}

function parse(text: string): { features: Feature[]; crs: string | null } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new GeojsonImportError(`The file is not valid JSON: ${(error as Error).message}`);
  }
  const fc = data as {
    type?: string;
    features?: unknown;
    crs?: { properties?: { name?: unknown } };
  };
  if (fc?.type !== "FeatureCollection" || !Array.isArray(fc.features)) {
    throw new GeojsonImportError("The file is not a GeoJSON FeatureCollection");
  }
  const crs = typeof fc.crs?.properties?.name === "string" ? fc.crs.properties.name : null;
  return { features: fc.features as Feature[], crs };
}

/** What the file holds, for the wizard: counts, coordinate space, and its properties to choose the name from. */
export function inspectGeojson(text: string): GeojsonInspection {
  const { features, crs } = parse(text);
  const warnings: string[] = [];
  const bbox: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
  let polygons = 0;
  const values = new Map<string, Set<string>>();
  for (const feature of features) {
    const shapes = polygonsOf(feature?.geometry);
    polygons += shapes.length;
    for (const shape of shapes) {
      for (const [x, y] of positions(shape)) {
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        bbox[0] = Math.min(bbox[0], x!);
        bbox[1] = Math.min(bbox[1], y!);
        bbox[2] = Math.max(bbox[2], x!);
        bbox[3] = Math.max(bbox[3], y!);
      }
    }
    for (const [key, value] of Object.entries(feature?.properties ?? {})) {
      if (typeof value !== "string" && typeof value !== "number") continue;
      const shown = String(value).trim();
      if (!shown) continue;
      const set = values.get(key) ?? new Set<string>();
      set.add(shown);
      values.set(key, set);
    }
  }
  if (polygons === 0)
    throw new GeojsonImportError("The FeatureCollection has no Polygon or MultiPolygon features");

  const inRange = bbox[0] >= -180 && bbox[2] <= 180 && bbox[1] >= -90 && bbox[3] <= 90;
  let space: "lonlat" | "pixel" = "lonlat";
  if (crs && !WGS84_CRS.test(crs)) {
    if (!inRange) {
      throw new GeojsonImportError(
        `The GeoJSON is in ${crs}, not WGS84 longitude/latitude: reproject it to EPSG:4326 (for example with QGIS or mapshaper) and upload it again`
      );
    }
    warnings.push(
      `The file names the CRS ${crs}, but every coordinate is a valid longitude/latitude: read as WGS84`
    );
  } else if (!inRange) {
    if (bbox[0] < 0 || bbox[1] < 0) {
      throw new GeojsonImportError(
        "The coordinates are neither longitude/latitude nor image pixels: reproject the file to EPSG:4326"
      );
    }
    space = "pixel";
    warnings.push(
      "The coordinates look like image pixels, not longitude/latitude: set the map's bounds or control points to place it"
    );
  }

  const properties = [...values.entries()]
    .map(([name, set]) => ({ name, distinct: set.size, samples: [...set].slice(0, 5) }))
    .sort((a, b) => b.distinct - a.distinct);
  const suggested =
    properties.find((p) => NAME_HINT.test(p.name) && p.distinct > 1) ??
    properties.find((p) => p.distinct > 1) ??
    null;
  return {
    features: features.length,
    polygons,
    space,
    bbox,
    properties,
    suggestedNameProperty: suggested?.name ?? null,
    warnings,
  };
}

export function runGeojsonEngine(text: string, rawOptions: unknown = {}): EngineResult {
  const options = geojsonEngineOptionsSchema.parse(rawOptions ?? {});
  const started = Date.now();
  const inspection = inspectGeojson(text);
  const { features } = parse(text);
  const nameProperty = options.nameProperty?.trim() || inspection.suggestedNameProperty;
  const log = [
    `${inspection.features} features, ${inspection.polygons} polygons`,
    nameProperty
      ? `Nation names from the "${nameProperty}" property`
      : "No name property: one region per feature",
  ];

  const groups = new Map<string, Array<Polygon | MultiPolygon>>();
  features.forEach((feature, index) => {
    const shapes = polygonsOf(feature?.geometry);
    if (shapes.length === 0) return;
    const raw = nameProperty ? feature.properties?.[nameProperty] : undefined;
    const value = typeof raw === "string" || typeof raw === "number" ? String(raw).trim() : "";
    const key = value || `feature ${index + 1}`;
    groups.set(key, [...(groups.get(key) ?? []), ...shapes]);
  });

  const regions: ImportRegion[] = [];
  const out: Array<Feature<Polygon | MultiPolygon, { key: string }>> = [];
  for (const [key, shapes] of groups) {
    regions.push({ key, name: key.startsWith("feature ") ? undefined : key, parts: shapes.length });
    out.push({
      type: "Feature",
      properties: { key },
      geometry: unionGeometries(shapes),
    });
  }
  const [, , maxX, maxY] = inspection.bbox;
  return {
    kind: "geojson",
    space: inspection.space,
    width: inspection.space === "pixel" ? Math.ceil(maxX) : 360,
    height: inspection.space === "pixel" ? Math.ceil(maxY) : 180,
    regions,
    features: { type: "FeatureCollection", features: out },
    report: { log, warnings: inspection.warnings, timingsMs: { parse: Date.now() - started } },
  };
}
