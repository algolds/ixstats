/**
 * The dry run's look at a bundle's geometry in PostGIS, in batches (as `measureAreas` in map-import.apply.ts measures
 * areas): whether each feature is a valid shape, whether any area is left once the writer repairs it, its area on
 * Earth, and whether it projects to Web Mercator the way the tile renderer does (clipped to its latitude range).
 *
 * The generator's smoothed outlines cross themselves in small loops: most polygons of a real world fail ST_IsValid,
 * and the realm map writer repairs them (ST_MakeValid, polygonal parts kept). So a self-crossing polygon is reported
 * (`valid: false`) and only one with nothing left after the repair is a problem.
 */
import type { PrismaClient } from "@prisma/client";
import type { Geometry } from "geojson";
import { isPostGISAvailable } from "~/lib/maps/geo-validation";

export interface GeometryReport {
  /** ST_IsValid: false for a self-crossing ring. */
  valid: boolean;
  /** Something is left after the repair: polygonal area, or a line's length. */
  repairable: boolean;
  /** km² on Earth: the repaired polygon's geography area (0 for a line). */
  area: number;
  /** Set when PostGIS failed on the feature (it cannot be projected or measured). */
  error?: string;
}

export interface InspectItem {
  id: string;
  geometry: Geometry;
}

const MAX_BATCH_ITEMS = 100;
const MAX_BATCH_POSITIONS = 150_000;

const INSPECT_SQL = `SELECT t.id,
       ST_IsValid(g.geom) AS valid,
       CASE WHEN ST_Dimension(g.geom) = 2 THEN NOT ST_IsEmpty(ST_CollectionExtract(r.fixed, 3))
            ELSE NOT ST_IsEmpty(g.geom) END AS repairable,
       CASE WHEN ST_Dimension(g.geom) = 2 THEN ST_Area(ST_CollectionExtract(r.fixed, 3)::geography) / 1000000.0
            ELSE 0 END AS area,
       ST_Transform(ST_ClipByBox2D(g.geom, ST_MakeEnvelope(-180, -85.0511, 180, 85.0511, 4326)), 3857) IS NOT NULL AS projects
  FROM jsonb_to_recordset($1::jsonb) AS t(id text, g jsonb),
       LATERAL (SELECT ST_SetSRID(ST_GeomFromGeoJSON(t.g::text), 4326) AS geom) g,
       LATERAL (SELECT ST_MakeValid(g.geom) AS fixed) r`;

interface InspectRow {
  id: string;
  valid: boolean;
  repairable: boolean;
  area: number | null;
}

type Coordinates = number | readonly Coordinates[];

/** How many positions a coordinates array holds, at any nesting. */
const countPositions = (coordinates: Coordinates): number =>
  typeof coordinates === "number"
    ? 0
    : typeof coordinates[0] === "number"
      ? 1
      : coordinates.reduce((sum: number, part) => sum + countPositions(part), 0);

const positionCount = (geometry: Geometry) =>
  "coordinates" in geometry ? countPositions(geometry.coordinates) : 0;

function batches(items: readonly InspectItem[]): InspectItem[][] {
  const out: InspectItem[][] = [];
  let current: InspectItem[] = [];
  let positions = 0;
  for (const item of items) {
    const size = positionCount(item.geometry);
    if (
      current.length > 0 &&
      (current.length >= MAX_BATCH_ITEMS || positions + size > MAX_BATCH_POSITIONS)
    ) {
      out.push(current);
      current = [];
      positions = 0;
    }
    current.push(item);
    positions += size;
  }
  if (current.length > 0) out.push(current);
  return out;
}

const run = (db: PrismaClient, items: readonly InspectItem[]) =>
  db.$queryRawUnsafe<InspectRow[]>(
    INSPECT_SQL,
    JSON.stringify(items.map((item) => ({ id: item.id, g: item.geometry })))
  );

const reportOf = (row: InspectRow): GeometryReport => ({
  valid: row.valid === true,
  repairable: row.repairable === true,
  area: Number(row.area ?? 0),
});

/**
 * Each feature's report by id, or null when PostGIS is not installed (nothing can be checked then). A batch PostGIS
 * fails on is retried one feature at a time, so the report names the features it cannot handle.
 */
export async function inspectGeometries(
  db: PrismaClient,
  items: readonly InspectItem[]
): Promise<Map<string, GeometryReport> | null> {
  if (!(await isPostGISAvailable(db))) return null;
  const reports = new Map<string, GeometryReport>();
  for (const batch of batches(items)) {
    try {
      for (const row of await run(db, batch)) reports.set(row.id, reportOf(row));
    } catch {
      for (const item of batch) {
        try {
          const [row] = await run(db, [item]);
          if (row) reports.set(item.id, reportOf(row));
        } catch (error) {
          const reason = (error instanceof Error ? error.message : String(error)).slice(0, 160);
          reports.set(item.id, {
            valid: false,
            repairable: false,
            area: 0,
            error: `PostGIS cannot project or measure it (${reason})`,
          });
        }
      }
    }
  }
  return reports;
}
