/**
 * Planning and applying a map import: the dry-run diff the wizard shows (new, changed, unchanged and removed
 * features, unmatched regions, unknown names, each nation's area), and the write itself through the realm map
 * writer, with a rollback snapshot, the replace mode's retirements, land areas filled only where a nation has
 * none, the adjacency rebuild and cache invalidation.
 */
import { createHash } from "node:crypto";
import type { MultiPolygon, Polygon } from "geojson";
import type { PrismaClient } from "@prisma/client";
import { invalidateCache } from "~/lib/cache";
import { rebuildAdjacency } from "~/lib/maps/adjacency";
import { buildNationGeometries, tidyGeometry, unionGeometries } from "~/lib/maps/import/build";
import { resolveGeoreference, type GeorefResolution } from "~/lib/maps/import/georef";
import { checkNationName, type NationSuggestion } from "~/lib/maps/import/nation-names";
import type { EngineResult, MapImportApply } from "~/lib/maps/import/options";
import { broadcastMapUpdate } from "~/lib/maps/map-update-bus";
import { isPostGISAvailable } from "~/lib/maps/geo-validation";
import { planetAreaScale, polygonalAreaSqKm } from "~/lib/maps/planet";
import { deactivateOtherFeatures, writeRealmMapFeatures } from "~/lib/maps/realm-map-writer";
import { captureMapSnapshot, packSnapshot } from "~/lib/maps/realm-map-snapshot";
import type { MapGeoreference } from "~/lib/maps/realm-map-settings";
import { normalizeNationName } from "~/lib/realms/sources/matching";
import { clearLayerCache } from "~/server/shared/layer-cache";
import { realmMapSettings, realmNations, type ImportRealm, type RealmCountry } from "./map-import.realm";

const SQKM_TO_SQMI = 0.386102;
const LAYER = "political";

export interface PlannedFeature {
  key: string;
  nation: string;
  countryId: string | null;
  countryName: string | null;
  sourceKeys: string[];
  status: "new" | "changed" | "unchanged";
  areaKm2: number | null;
  /** The nation's stated land area, and what the import does to it. */
  landArea: { current: number | null; action: "fill" | "keep" | "none" };
  geometry: Polygon | MultiPolygon;
  hash: string;
}

export interface MapImportDiff {
  mode: "merge" | "replace";
  features: Array<Omit<PlannedFeature, "geometry" | "hash">>;
  /** Replace mode: active features the new map does not have (they are retired). */
  removed: Array<{ key: string; name: string | null; countryName: string | null }>;
  /** Merge mode: features the import leaves as they are. */
  kept: number;
  /** Source regions not mapped to any nation (water excluded). */
  unmatched: Array<{ key: string; name?: string; colour?: string; pixels?: number }>;
  /** Mapped names that are not one of the realm's nations (imported under that name), with suggestions. */
  newNames: Array<{ nation: string; suggestions: NationSuggestion[] }>;
  missingKeys: string[];
  empty: string[];
  georef: Pick<GeorefResolution, "method" | "projection" | "extent" | "warnings" | "rmseDegrees"> | null;
  areaScale: number;
}

export interface MapImportPlan {
  diff: MapImportDiff;
  features: PlannedFeature[];
}

const hashGeometry = (geometry: unknown) =>
  createHash("sha1").update(JSON.stringify(geometry)).digest("hex").slice(0, 16);

/** Each nation's area in km² on the realm's planet: PostGIS geography when available, else the flat estimate. */
async function measureAreas(
  db: PrismaClient,
  features: ReadonlyArray<{ key: string; geometry: Polygon | MultiPolygon }>,
  radiusKm: number | undefined
): Promise<Map<string, number>> {
  const areas = new Map<string, number>();
  if (features.length === 0) return areas;
  if (await isPostGISAvailable(db)) {
    try {
      const rows = await db.$queryRawUnsafe<Array<{ key: string; area: number | null }>>(
        `SELECT t.key, ST_Area(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(t.g::text), 4326))::geography) / 1000000.0 AS area
           FROM jsonb_to_recordset($1::jsonb) AS t(key text, g jsonb)`,
        JSON.stringify(features.map((f) => ({ key: f.key, g: f.geometry })))
      );
      const scale = planetAreaScale(radiusKm);
      for (const row of rows) if (typeof row.area === "number") areas.set(row.key, row.area * scale);
      if (areas.size === features.length) return areas;
    } catch (error) {
      console.warn("[map-import] PostGIS area failed, using the flat estimate:", error);
    }
  }
  for (const f of features) if (!areas.has(f.key)) areas.set(f.key, polygonalAreaSqKm(f.geometry, radiusKm));
  return areas;
}

/** The georeference an import uses: the job's own, else the realm's stored one. */
export function importGeoreference(realm: ImportRealm, own: MapGeoreference | undefined): MapGeoreference {
  const stored = realmMapSettings(realm);
  return own ?? { projection: stored.projection, bounds: stored.bounds, controlPoints: stored.controlPoints };
}

/** The feature key a nation's border is written under: its existing feature's, else the nation's name. */
function featureKeyFor(
  nation: string,
  country: RealmCountry | undefined,
  existing: ReadonlyArray<{ featureId: string; displayName: string | null; countryId: string | null }>
): string {
  const byCountry = country && existing.find((f) => f.countryId === country.id);
  if (byCountry) return byCountry.featureId;
  const key = normalizeNationName(nation);
  const byName = existing.find(
    (f) => normalizeNationName(f.featureId) === key || normalizeNationName(f.displayName) === key
  );
  return byName?.featureId ?? nation;
}

/** The dry run: what applying `apply` to the realm would write, retire and measure. Writes nothing. */
export async function planMapImport(
  db: PrismaClient,
  realm: ImportRealm,
  result: EngineResult,
  apply: MapImportApply,
  georefInput: MapGeoreference
): Promise<MapImportPlan> {
  const settings = realmMapSettings(realm);
  const georef = result.space === "pixel" ? resolveGeoreference(georefInput, result.width, result.height) : null;
  const built = buildNationGeometries(result, apply.mapping, georef?.transform ?? null);
  const { countries, candidates } = await realmNations(db, realm.id);
  const existing = await db.mapLayer.findMany({
    where: { realmId: realm.id, layerType: LAYER, isActive: true },
    select: { featureId: true, displayName: true, countryId: true },
  });

  const newNames: MapImportDiff["newNames"] = [];
  const byKey = new Map<
    string,
    { nation: string; country: RealmCountry | undefined; key: string; keys: string[]; geometry: Polygon | MultiPolygon }
  >();
  for (const n of built.nations) {
    const check = checkNationName(n.nation, candidates);
    const country =
      check.status === "matched" && check.countryId ? countries.find((c) => c.id === check.countryId) : undefined;
    if (check.status === "new") newNames.push({ nation: n.nation, suggestions: check.suggestions });
    const name = check.status === "matched" ? check.name : n.nation;
    const key = featureKeyFor(name, country, existing);
    const same = byKey.get(key);
    // Two spellings of one nation become one border.
    const geometry = same ? (tidyGeometry(unionGeometries([same.geometry, n.geometry])) ?? same.geometry) : n.geometry;
    byKey.set(key, { nation: name, country, key, keys: [...(same?.keys ?? []), ...n.keys], geometry });
  }
  const planned = [...byKey.values()];

  const keys = planned.map((p) => p.key);
  const current = keys.length
    ? await db.mapLayer.findMany({
        where: { realmId: realm.id, layerType: LAYER, featureId: { in: keys } },
        select: { featureId: true, geometry: true, isActive: true },
      })
    : [];
  const currentHash = new Map(current.map((c) => [c.featureId, c.isActive ? hashGeometry(c.geometry) : null]));
  const areas = await measureAreas(db, planned, settings.radiusKm);

  const features: PlannedFeature[] = planned.map((p) => {
    const hash = hashGeometry(p.geometry);
    const before = currentHash.get(p.key);
    const stated = p.country?.landArea ?? null;
    const hasStated = stated !== null && stated > 0;
    return {
      key: p.key,
      nation: p.nation,
      countryId: p.country?.id ?? null,
      countryName: p.country?.name ?? null,
      sourceKeys: p.keys,
      status: before === undefined || before === null ? "new" : before === hash ? "unchanged" : "changed",
      areaKm2: areas.get(p.key) ?? null,
      landArea: {
        current: stated,
        action: !p.country ? "none" : hasStated ? "keep" : apply.fillMissingLandArea ? "fill" : "none",
      },
      geometry: p.geometry,
      hash,
    };
  });

  const written = new Set(keys);
  const countryName = new Map(countries.map((c) => [c.id, c.name]));
  const others = existing.filter((f) => !written.has(f.featureId));
  const mapped = new Set(Object.entries(apply.mapping).filter(([, v]) => v?.trim()).map(([k]) => k));
  return {
    features,
    diff: {
      mode: apply.mode,
      features: features.map(({ geometry: _g, hash: _h, ...rest }) => rest),
      removed:
        apply.mode === "replace"
          ? others.map((f) => ({
              key: f.featureId,
              name: f.displayName,
              countryName: f.countryId ? (countryName.get(f.countryId) ?? null) : null,
            }))
          : [],
      kept: apply.mode === "merge" ? others.length : 0,
      unmatched: result.regions
        .filter((r) => !mapped.has(r.key) && !r.water && (r.pixels === undefined || r.pixels > 0))
        .map((r) => ({ key: r.key, name: r.name, colour: r.colour, pixels: r.pixels })),
      newNames,
      missingKeys: built.missingKeys,
      empty: built.empty,
      georef: georef
        ? {
            method: georef.method,
            projection: georef.projection,
            extent: georef.extent,
            warnings: georef.warnings,
            rmseDegrees: georef.rmseDegrees,
          }
        : null,
      areaScale: planetAreaScale(settings.radiusKm),
    },
  };
}

export interface AppliedImport {
  written: number;
  rejected: Array<{ key: string; reason: string }>;
  deactivated: number;
  landAreasFilled: string[];
  mapImportId: string;
  rollbackAvailable: boolean;
  adjacencyPairs: number | null;
}

/** Write a plan into the realm's political layer, keeping a rollback snapshot. */
export async function applyMapImportPlan(
  db: PrismaClient,
  realm: ImportRealm,
  plan: MapImportPlan,
  context: { jobId: string | null; requestedBy: string }
): Promise<AppliedImport> {
  const { diff, features } = plan;
  if (features.length === 0) throw new Error("Nothing to import: map at least one region to a nation");
  const keys = features.map((f) => f.key);
  const snapshot = await captureMapSnapshot(db, realm.id, [
    {
      layerType: LAYER,
      keys,
      wholeLayer: diff.mode === "replace",
      countryIds: features.flatMap((f) => (f.countryId ? [f.countryId] : [])),
    },
  ]);

  const writeResult = await writeRealmMapFeatures(
    db,
    realm.id,
    features.map((f) => ({
      key: f.key,
      geometry: f.geometry,
      name: f.nation,
      countryId: f.countryId,
      properties: {
        source: "map-import",
        importJobId: context.jobId,
        sourceKeys: f.sourceKeys,
        importHash: f.hash,
      },
    })),
    { layerType: LAYER, areaScale: diff.areaScale }
  );
  const written = new Set(writeResult.written);
  const deactivated =
    diff.mode === "replace" ? await deactivateOtherFeatures(db, realm.id, LAYER, writeResult.written) : 0;

  const landAreasFilled: string[] = [];
  for (const f of features) {
    if (f.landArea.action !== "fill" || !f.countryId || !written.has(f.key)) continue;
    const area = writeResult.areas[f.key] ?? f.areaKm2;
    if (!area || !(area > 0)) continue;
    // Re-read: a stated land area set since the dry run is never overwritten.
    const country = await db.country.findUnique({ where: { id: f.countryId }, select: { landArea: true } });
    if (country?.landArea && country.landArea > 0) continue;
    await db.country.update({ where: { id: f.countryId }, data: { landArea: area, areaSqMi: area * SQKM_TO_SQMI } });
    landAreasFilled.push(f.nation);
  }

  const packed = packSnapshot(snapshot);
  const record = await db.mapImport.create({
    data: {
      realmId: realm.id,
      jobId: context.jobId,
      layerTypes: [LAYER],
      mode: diff.mode,
      createdBy: context.requestedBy,
      summary: {
        written: writeResult.written.length,
        rejected: writeResult.rejected.length,
        deactivated,
        landAreasFilled,
        nations: features.map((f) => f.nation),
      },
      snapshot: packed.bytes,
      snapshotBytes: packed.size,
      rollbackAvailable: packed.bytes !== null,
    },
    select: { id: true },
  });

  const adjacencyPairs = await refreshRealmMap(db, realm.id);
  return {
    written: writeResult.written.length,
    rejected: writeResult.rejected,
    deactivated,
    landAreasFilled,
    mapImportId: record.id,
    rollbackAvailable: packed.bytes !== null,
    adjacencyPairs,
  };
}

/**
 * After a realm's political layer changed: rebuild its adjacency (PostGIS; null when skipped or failed), drop the
 * assembled-layer cache and the cached map responses, and tell open maps to refetch.
 */
export async function refreshRealmMap(
  db: PrismaClient,
  realmId: string,
  options: { adjacency?: boolean } = {}
): Promise<number | null> {
  let pairs: number | null = null;
  if (options.adjacency !== false) {
    try {
      const adjacency = await rebuildAdjacency(db, realmId);
      pairs = adjacency.skipped ? null : adjacency.pairs;
    } catch (error) {
      console.error("[map-import] Adjacency rebuild failed:", error);
    }
  }
  clearLayerCache();
  await invalidateCache(["geoCore.getWorldMap", "geoCore.getMapBundle"]).catch(() => undefined);
  broadcastMapUpdate("bulk");
  return pairs;
}
