/**
 * Reading a world bundle for the `world` import job, and everything the dry run checks before anything is written.
 * The bundle parser (world-bundle.ts) has refused what is malformed; this adds what needs the realm and PostGIS:
 *
 *   - longitudes past ±180 are cut at the seam and shifted into range (world-seam.ts), the way the writer needs them;
 *   - every feature passes the realm map writer's own geometry check, and no layer has two features with one key;
 *   - PostGIS finds the shapes nothing is left of once repaired, or that it cannot project or measure
 *     (world-import.inspect.ts); a self-crossing outline that can be repaired is a warning, not a refusal;
 *   - each political feature is a nation slot's, one each, keyed `slot_<key>`;
 *   - the slots' figures, which come from the browser, are checked against what the server can derive: GDP per
 *     capita within the development level's range (or 0), people within the measured area times the densest the
 *     baseline allows. The area is PostGIS's; without PostGIS only the GDP is checked (a spherical estimate of the
 *     area is not exact enough to refuse a world by) and the nation's land area is the estimate.
 *
 * Any problem refuses the whole bundle with every reason found (a MapImportError), and nothing is written. Shapes
 * of the physical layers that PostGIS finds nothing of once repaired are left out with a warning.
 */
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { PrismaClient } from "@prisma/client";
import {
  WORLD_BUNDLE_LAYERS,
  type WorldBundle,
  type WorldBundleLayerName,
  type WorldBundleSlot,
} from "~/lib/maps/import/world-bundle";
import { parseWorldBundle } from "~/lib/maps/import/world-bundle.node";
import { fitToSeam } from "~/lib/maps/import/world-seam";
import { scaleAreaToRadius, sphericalRingAreaSqKm } from "~/lib/maps/planet";
import { geometryProblem } from "~/lib/maps/realm-map-writer";
import { baselineBounds } from "~/lib/worldgen/baseline";
import { layerFeatures } from "./map-import.pipeline";
import { MapImportError, realmMapSettings, type ImportRealm } from "./map-import.realm";
import { readMapUpload } from "./map-import.storage";
import { inspectGeometries, type GeometryReport } from "./world-import.inspect";

const MAX_LISTED_PROBLEMS = 12;
/** `Realm.seed` is a 32-bit column. */
const INT32_MAX = 2_147_483_647;

/** The political feature key of a slot: `slot_<key>`, so a regeneration's features never collide with older ones. */
const slotFeatureKey = (key: string) => (key.startsWith("slot_") ? key : `slot_${key}`);

export interface PreparedSlot {
  slot: WorldBundleSlot;
  featureKey: string;
  /** The slot's area as the server measured it, in km² on the realm's planet (its land area). */
  areaKm2: number;
}

export interface PreparedWorld {
  bundle: WorldBundle;
  /** The layers as they are written: seam-fitted, political features keyed by slot. */
  layers: Record<string, FeatureCollection>;
  slots: PreparedSlot[];
  warnings: string[];
}

/** Read a job's stored upload as a world bundle, or refuse it with the parser's reason. */
export async function loadWorldBundle(uploadId: string | null): Promise<WorldBundle> {
  if (!uploadId) throw new MapImportError("BAD_REQUEST", "The job has no uploaded file");
  const bytes = await readMapUpload(uploadId).catch(() => {
    throw new MapImportError(
      "NOT_FOUND",
      "The uploaded world bundle was not found: upload it again"
    );
  });
  const parsed = parseWorldBundle(bytes);
  if (!parsed.ok) {
    throw new MapImportError("BAD_REQUEST", `That file is not a world bundle: ${parsed.reason}`);
  }
  return parsed.bundle;
}

function refuse(problems: readonly string[]): never {
  const shown = problems.slice(0, MAX_LISTED_PROBLEMS).join(". ");
  const more = problems.length - MAX_LISTED_PROBLEMS;
  throw new MapImportError(
    "BAD_REQUEST",
    `The bundle can't be applied. ${shown}${more > 0 ? `. And ${more} more` : ""}`
  );
}

/** The layer with every feature inside ±180 and passing the writer's geometry check; problems are noted. */
function fitLayer(
  layer: WorldBundleLayerName,
  collection: FeatureCollection,
  problems: string[]
): FeatureCollection {
  const kinds = layer === "political" ? "polygonal" : "any";
  const features = collection.features.map((feature, index): Feature => {
    const geometry = fitToSeam(feature.geometry);
    const problem = geometry ? geometryProblem(geometry, kinds) : "nothing is left inside ±180";
    if (problem) problems.push(`${layer} feature ${index}: ${problem}`);
    return geometry ? { ...feature, geometry } : feature;
  });
  return { ...collection, features };
}

/** Key each political feature by its slot; a slot with no feature, or two, is a problem. */
function keyPolitical(
  collection: FeatureCollection,
  slots: readonly WorldBundleSlot[],
  problems: string[]
): FeatureCollection {
  const seen = new Set<string>();
  const features = collection.features.map((feature): Feature => {
    const slotKey = String(feature.properties?.slotKey);
    if (seen.has(slotKey)) problems.push(`Slot ${slotKey} has two political features`);
    seen.add(slotKey);
    const featureId = slotFeatureKey(slotKey);
    return { ...feature, id: featureId, properties: { ...feature.properties, featureId } };
  });
  for (const { key } of slots) if (!seen.has(key)) problems.push(`Slot ${key} has no territory`);
  return { ...collection, features };
}

function duplicateKeys(layers: Record<string, FeatureCollection>, problems: string[]) {
  for (const [layer, collection] of Object.entries(layers)) {
    const seen = new Set<string>();
    for (const { key } of layerFeatures(layer, collection)) {
      if (seen.has(key)) problems.push(`${layer} has two features keyed ${key}`);
      seen.add(key);
    }
  }
}

interface Inspected {
  /** PostGIS's report per `layer:key`, or null when PostGIS is not installed. */
  reports: Map<string, GeometryReport> | null;
  /** The layers without the physical shapes nothing is left of once repaired. */
  layers: Record<string, FeatureCollection>;
}

/**
 * PostGIS's look at every feature. A shape of any layer it cannot project or measure is a problem (it would break
 * every tile it touches); a nation border nothing is left of once repaired is one too (the nation would have no
 * territory), while a river, lake or contour in that state is left out with a warning, as the writer would reject
 * it. A self-crossing outline that can be repaired is a warning only: most generated outlines are.
 */
async function inspectLayers(
  db: PrismaClient,
  layers: Record<string, FeatureCollection>,
  problems: string[],
  warnings: string[]
): Promise<Inspected> {
  const entries = Object.entries(layers).flatMap(([layer, collection]) =>
    layerFeatures(layer, collection).map((f) => ({
      id: `${layer}:${f.key}`,
      layer,
      key: f.key,
      geometry: f.geometry,
    }))
  );
  const reports = await inspectGeometries(db, entries);
  if (!reports) {
    warnings.push(
      "PostGIS is not available, so the geometry and the nations' populations were not checked"
    );
    return { reports, layers };
  }
  const repaired: Record<string, number> = {};
  const skipped: Record<string, number> = {};
  const left = new Set<string>();
  for (const { id, layer, key } of entries) {
    const report = reports.get(id);
    if (!report) continue;
    if (report.error) {
      // A shape that cannot be projected would break every tile it touches
      problems.push(`${layer} ${key}: ${report.error}`);
    } else if (!report.repairable) {
      if (layer === "political") {
        problems.push(`${layer} ${key}: nothing is left of it once its self-crossing is repaired`);
      } else {
        skipped[layer] = (skipped[layer] ?? 0) + 1;
        left.add(id);
      }
    } else if (!report.valid) repaired[layer] = (repaired[layer] ?? 0) + 1;
  }
  for (const [layer, count] of Object.entries(repaired)) {
    warnings.push(`${count} ${layer} outlines cross themselves and are repaired when written`);
  }
  for (const [layer, count] of Object.entries(skipped)) {
    warnings.push(`${count} ${layer} shapes are too small or tangled to keep and are left out`);
  }
  if (left.size === 0) return { reports, layers };
  const kept: Record<string, FeatureCollection> = {};
  for (const [layer, collection] of Object.entries(layers)) {
    const keys = layerFeatures(layer, collection).map((f) => `${layer}:${f.key}`);
    kept[layer] = {
      ...collection,
      features: collection.features.filter((_, index) => !left.has(keys[index]!)),
    };
  }
  return { reports, layers: kept };
}

/** Area in km² on Earth of a polygon geometry from its great-circle edges, holes subtracted (the PostGIS-less estimate). */
function estimatedAreaSqKm(geometry: Geometry): number {
  const polygons =
    geometry.type === "Polygon"
      ? [geometry.coordinates]
      : geometry.type === "MultiPolygon"
        ? geometry.coordinates
        : [];
  return polygons.reduce((sum, [outer, ...holes]) => {
    const inside = sphericalRingAreaSqKm(outer!);
    return (
      sum +
      Math.max(
        0,
        holes.reduce((rest, hole) => rest - sphericalRingAreaSqKm(hole), inside)
      )
    );
  }, 0);
}

/**
 * The browser counts a slot's people on its cells; PostGIS measures the smoothed border, which comes out a few per cent
 * smaller (up to 15 % for a slot cut at the poles). A full-density slot must still pass.
 */
const MEASURED_AREA_SLACK = 1.25;

/**
 * The figures a browser sent for a slot, against what the server can derive. `measuredKm2` is PostGIS's area on
 * Earth, or null when it could not measure.
 */
function figuresProblem(
  slot: WorldBundleSlot,
  measuredKm2: number | null,
  bounds: ReturnType<typeof baselineBounds>
): string | null {
  const { min, max } = bounds.gdpPerCapita;
  if (slot.gdpPerCapita !== 0 && (slot.gdpPerCapita < min || slot.gdpPerCapita > max)) {
    return `${slot.name}: GDP per capita ${slot.gdpPerCapita.toLocaleString("en-US")} is outside what its development level allows (${min.toLocaleString("en-US")} to ${max.toLocaleString("en-US")})`;
  }
  if (measuredKm2 === null) return null;
  const allowed = measuredKm2 * bounds.maxDensity * MEASURED_AREA_SLACK;
  if (slot.population > allowed) {
    return `${slot.name}: population ${slot.population.toLocaleString("en-US")} is more than its ${Math.round(measuredKm2).toLocaleString("en-US")} km² can hold`;
  }
  return null;
}

function planSlots(
  bundle: WorldBundle,
  political: FeatureCollection | undefined,
  reports: Map<string, GeometryReport> | null,
  radiusKm: number | undefined,
  problems: string[]
): PreparedSlot[] {
  const bounds = baselineBounds(bundle.params.developmentLevel);
  const byKey = new Map(
    (political?.features ?? []).map((feature) => [String(feature.properties?.slotKey), feature])
  );
  return bundle.slots.flatMap((slot) => {
    const feature = byKey.get(slot.key);
    if (!feature) return [];
    const featureKey = slotFeatureKey(slot.key);
    const measured = reports?.get(`political:${featureKey}`)?.area ?? null;
    const problem = figuresProblem(slot, measured, bounds);
    if (problem) problems.push(problem);
    const earth = measured ?? estimatedAreaSqKm(feature.geometry);
    return [{ slot, featureKey, areaKm2: scaleAreaToRadius(earth, radiusKm) }];
  });
}

/**
 * Check a bundle against the realm and prepare it to write: the dry run and the apply both run this, so the apply
 * never relies on a check made earlier. Throws a MapImportError listing every problem found.
 */
export async function prepareWorld(
  db: PrismaClient,
  realm: ImportRealm,
  bundle: WorldBundle
): Promise<PreparedWorld> {
  const problems: string[] = [];
  const warnings: string[] = [];
  if (Math.abs(bundle.seed) > INT32_MAX) {
    problems.push(`The seed ${bundle.seed} does not fit the realm's 32-bit seed column`);
  }

  const layers: Record<string, FeatureCollection> = {};
  for (const layer of WORLD_BUNDLE_LAYERS) {
    const collection = bundle.layers[layer];
    if (collection) layers[layer] = fitLayer(layer, collection, problems);
  }
  if (layers.political) layers.political = keyPolitical(layers.political, bundle.slots, problems);
  duplicateKeys(layers, problems);
  // The structure is wrong: PostGIS has nothing worth checking
  if (problems.length > 0) refuse(problems);

  const inspected = await inspectLayers(db, layers, problems, warnings);
  const slots = planSlots(
    bundle,
    inspected.layers.political,
    inspected.reports,
    realmMapSettings(realm).radiusKm,
    problems
  );
  if (problems.length > 0) refuse(problems);
  return { bundle, layers: inspected.layers, slots, warnings };
}
