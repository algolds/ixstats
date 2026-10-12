/**
 * A realm's relief: the hillshade of its land as the raster layer `relief` (kind `overlay`, so it sits over the
 * elevation and climate art and under the political fill), recorded in `settings.map.rasterLayers`.
 *
 * The heights come from generator cells (a generated world) or from the realm's stored altitude bands (Ixnay,
 * Eurth, any realm with elevations), both as a 2048×1024 grid (src/lib/worldgen/relief.ts, the module the World tab's
 * preview runs too); fractal detail at a fixed ruggedness of 1 and the hillshade follow. The shading is built as
 * tiles z0 to 5 (MapLibre overzooms past that) in lossy WebP, without the tiles that hold none (`/api/map-rasters`
 * answers a missing relief tile with a transparent one), under a version that is a hash of the picture: a world
 * that has not changed is never built again.
 *
 * It does not go through the map pipeline job (which needs a stored pipeline, and Ixnay and Eurth have none): the
 * `world` job, the pipeline's `relief` step and the World tab's "Rebuild relief" all call this. Server only.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import {
  RELIEF_LAYER_ID,
  RELIEF_MAX_ZOOM,
  sameRasterLayer,
  withRasterLayer,
} from "~/lib/maps/raster-tiles";
import {
  parseRealmMapSettings,
  RealmMapSettingsSchema,
  RealmRasterLayerSchema,
  withRealmMapSettings,
  type RealmRasterLayer,
} from "~/lib/maps/realm-map-settings";
import {
  addDetail,
  heightsFromBands,
  heightsFromCells,
  hillshade,
  type HeightGrid,
} from "~/lib/worldgen/relief";
import { invalidateRealmMap } from "~/server/shared/map-invalidation";
import {
  buildRealmRaster,
  planRealmRaster,
  pruneRasterVersions,
  type RasterBuildInput,
} from "./realm-rasters.build";
import { loadAltitudeBands, rasterizeBands } from "./realm-relief.bands";

const GRID_WIDTH = 2048;
const GRID_HEIGHT = GRID_WIDTH / 2;
/** Detail amplitude (relief.ts `addDetail`): the full amount, for every realm. */
const RUGGEDNESS = 1;

const LAYER = { label: "Relief", kind: "overlay", order: 10 } as const;
/** Zoom range and encoding of the tiles: past z5 MapLibre overzooms, and shading is smooth enough for lossy WebP. */
const TILES = {
  maxZoom: RELIEF_MAX_ZOOM,
  lossy: { quality: 70, alphaQuality: 60 },
  skipTransparent: true,
} as const satisfies Partial<RasterBuildInput>;

type ReliefDb = Pick<PrismaClient, "realm" | "mapLayer" | "$queryRaw">;

/** Where the heights come from: a generated world's cells (packed `[lng, lat, h, ...]`), or the realm's stored bands. */
export type ReliefSource = { cells: Float32Array } | { bands: true };

export interface ReliefPlan {
  /** The settings entry the layer gets. */
  entry: RealmRasterLayer;
  /** The shading, as a 2048×1024 PNG. */
  image: Uint8Array;
  /** The tiles of this version are on disk already. */
  built: boolean;
  /** Building or recording is needed: the tiles are missing, or the settings do not hold this entry. */
  changed: boolean;
  /** The version the settings held before. */
  previous: string | undefined;
}

/** The layer as built: its settings entry, and what the build did. */
export type ReliefEntry = RealmRasterLayer & {
  /** False when the tiles of this version were there already. */
  built: boolean;
  /** Tiles written. */
  tiles: number;
  /** Fully transparent tiles left out. */
  skipped: number;
};

async function heightGrid(
  db: ReliefDb,
  realmId: string,
  source: ReliefSource
): Promise<HeightGrid | null> {
  if ("cells" in source) return heightsFromCells(source.cells, GRID_WIDTH);
  const bands = await rasterizeBands(await loadAltitudeBands(db, realmId), GRID_WIDTH, GRID_HEIGHT);
  return bands && heightsFromBands(bands.zoneGrid, GRID_WIDTH, GRID_HEIGHT, bands.zones);
}

/** The hillshade of the heights as a PNG. */
async function shadingImage(grid: HeightGrid): Promise<Uint8Array> {
  addDetail(grid, RUGGEDNESS);
  const rgba = hillshade(grid);
  const sharp = (await import("sharp")).default;
  return sharp(Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength), {
    raw: { width: grid.width, height: grid.height, channels: 4 },
  })
    .png()
    .toBuffer();
}

async function storedSettings(db: ReliefDb, realmId: string): Promise<Prisma.JsonValue> {
  const realm = await db.realm.findUnique({ where: { id: realmId }, select: { settings: true } });
  if (!realm) throw new Error("Realm not found");
  return realm.settings;
}

const rasterInput = (realmId: string, image: Uint8Array) => ({
  realmId,
  layerId: RELIEF_LAYER_ID,
  kind: LAYER.kind,
  image,
  ...TILES,
});

/**
 * What a build of the realm's relief would make, without writing anything: its version and entry, and whether the
 * tiles and the settings are in place. Null when the source holds no heights (a realm with no elevation bands has
 * no relief).
 */
export async function planRealmRelief(
  db: ReliefDb,
  realmId: string,
  source: ReliefSource
): Promise<ReliefPlan | null> {
  const stored = parseRealmMapSettings(await storedSettings(db, realmId)).rasterLayers ?? [];
  const grid = await heightGrid(db, realmId, source);
  if (!grid) return null;
  const image = await shadingImage(grid);
  const plan = await planRealmRaster(rasterInput(realmId, image));
  const entry = RealmRasterLayerSchema.parse({
    id: RELIEF_LAYER_ID,
    ...LAYER,
    version: plan.version,
    maxZoom: plan.maxZoom,
  });
  const current = stored.find((layer) => layer.id === RELIEF_LAYER_ID);
  return {
    entry,
    image,
    built: plan.built,
    changed: !plan.built || !sameRasterLayer(current, entry),
    previous: current?.version,
  };
}

/** Put the entry in the realm's settings (everything else kept) and drop the versions before the previous one. */
async function record(db: ReliefDb, realmId: string, plan: ReliefPlan): Promise<void> {
  const settings = await storedSettings(db, realmId);
  const layers = withRasterLayer(parseRealmMapSettings(settings).rasterLayers ?? [], plan.entry);
  const rasterLayers = RealmMapSettingsSchema.shape.rasterLayers.parse(layers);
  await db.realm.update({
    where: { id: realmId },
    data: { settings: withRealmMapSettings(settings, { rasterLayers }) as Prisma.InputJsonValue },
  });
  await pruneRasterVersions(realmId, RELIEF_LAYER_ID, [
    plan.entry.version,
    plan.previous ?? plan.entry.version,
  ]);
}

/**
 * Build the planned relief (the tiles of a version that exists are kept), record it, and tell the map it changed.
 * A plan that is built and recorded already writes nothing.
 */
export async function applyRealmRelief(
  db: ReliefDb,
  realmId: string,
  plan: ReliefPlan
): Promise<ReliefEntry> {
  if (!plan.changed) return { ...plan.entry, built: false, tiles: 0, skipped: 0 };
  const result = await buildRealmRaster(rasterInput(realmId, plan.image));
  await record(db, realmId, plan);
  await invalidateRealmMap(db, realmId);
  return { ...plan.entry, built: result.built, tiles: result.tiles, skipped: result.skipped };
}

/**
 * Build a realm's relief layer from `source`: heights, detail, hillshade, tiles, then the entry in
 * `settings.map.rasterLayers`. Throws for a realm that has no heights to shade (no altitude bands).
 */
export async function buildRealmRelief(
  db: ReliefDb,
  realmId: string,
  source: ReliefSource
): Promise<ReliefEntry> {
  const plan = await planRealmRelief(db, realmId, source);
  if (!plan) throw new Error("The realm has no altitude bands to shade");
  return applyRealmRelief(db, realmId, plan);
}
