/**
 * A realm's elevation model: the raster layer `dem` (kind `dem`), Terrarium-encoded heights as lossless WebP tiles
 * z0 to 6 (src/lib/maps/dem.ts), recorded in `settings.map.rasterLayers`. The viewer reads it with a `raster-dem`
 * source for its hillshade, colour relief and 3D terrain.
 *
 * Heights come from the same sources as the relief (realm-relief.ts): a generated world's cells (ocean depths
 * kept) or the realm's stored altitude bands (interpolated between band limits, a sea floor from the distance to
 * land), on an 8192×4096 grid with the same detail. The version is a hash of the heights, so a world that has not
 * changed is never built again. Server only.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Prisma, PrismaClient } from "@prisma/client";
import {
  decodeTerrarium,
  DEM_GRID_WIDTH,
  DEM_LAYER_ID,
  DEM_MAX_ZOOM,
  demLevels,
  demPixelAt,
  demTile,
} from "~/lib/maps/dem";
import { RASTER_TILE_SIZE, sameRasterLayer, withRasterLayer } from "~/lib/maps/raster-tiles";
import {
  parseRealmMapSettings,
  RealmMapSettingsSchema,
  RealmRasterLayerSchema,
  withRealmMapSettings,
  type RealmRasterLayer,
} from "~/lib/maps/realm-map-settings";
import {
  addDetail,
  addSeaFloor,
  heightsFromBands,
  scalarsFromCells,
  type HeightGrid,
} from "~/lib/worldgen/relief";
import { updateRealmSettings } from "~/server/modules/realms/realm-settings";
import { invalidateRealmMap } from "~/server/shared/map-invalidation";
import { pruneRasterVersions } from "./realm-rasters.build";
import { rasterTileFile, rasterVersionDir, rasterVersionExists } from "./realm-rasters.storage";
import { loadAltitudeBands, rasterizeBands } from "./realm-relief.bands";
import type { ReliefSource } from "./realm-relief";

/** Bump when the heights or tiles this code makes change, so every realm gets a new version on rebuild. */
const DEM_REVISION = "dem-1";
const LAYER = { id: DEM_LAYER_ID, label: "Elevation", kind: "dem" } as const;

type DemDb = Pick<PrismaClient, "realm" | "mapLayer" | "$queryRaw">;

export interface DemPlan {
  entry: RealmRasterLayer;
  grid: HeightGrid;
  /** The tiles of this version are on disk already. */
  built: boolean;
  /** Building or recording is needed. */
  changed: boolean;
  previous: string | undefined;
}

export type DemEntry = RealmRasterLayer & { built: boolean; tiles: number };

/** The realm's heights on the DEM grid, or null when the source holds none (no altitude bands). */
export async function demGrid(
  db: DemDb,
  realmId: string,
  source: ReliefSource
): Promise<HeightGrid | null> {
  if ("cells" in source) {
    const grid = scalarsFromCells(source.cells, DEM_GRID_WIDTH);
    addDetail(grid, 1);
    return grid;
  }
  const bands = await rasterizeBands(
    await loadAltitudeBands(db, realmId),
    DEM_GRID_WIDTH,
    DEM_GRID_WIDTH / 2
  );
  if (!bands) return null;
  const grid = heightsFromBands(bands.zoneGrid, DEM_GRID_WIDTH, DEM_GRID_WIDTH / 2, bands.zones);
  addDetail(grid, 1);
  addSeaFloor(grid, bands.zoneGrid);
  return grid;
}

function demVersion(grid: HeightGrid): string {
  const { metres } = grid;
  return createHash("sha256")
    .update(`${DEM_REVISION}|${grid.width}|`)
    .update(new Uint8Array(metres.buffer, metres.byteOffset, metres.byteLength))
    .digest("hex")
    .slice(0, 16);
}

async function storedLayers(db: DemDb, realmId: string): Promise<RealmRasterLayer[]> {
  const realm = await db.realm.findUnique({ where: { id: realmId }, select: { settings: true } });
  if (!realm) throw new Error("Realm not found");
  return parseRealmMapSettings(realm.settings as Prisma.JsonValue).rasterLayers ?? [];
}

/** What a build would make, without writing: null when the realm has no heights. */
export async function planRealmDem(
  db: DemDb,
  realmId: string,
  source: ReliefSource
): Promise<DemPlan | null> {
  const stored = await storedLayers(db, realmId);
  const grid = await demGrid(db, realmId, source);
  if (!grid) return null;
  const version = demVersion(grid);
  const dir = rasterVersionDir(realmId, DEM_LAYER_ID, version);
  if (!dir) throw new Error(`Not a valid realm id: ${realmId}`);
  const entry = RealmRasterLayerSchema.parse({ ...LAYER, version, maxZoom: DEM_MAX_ZOOM });
  const current = stored.find((l) => l.id === DEM_LAYER_ID);
  const built = await rasterVersionExists(dir);
  return {
    entry,
    grid,
    built,
    changed: !built || !sameRasterLayer(current, entry),
    previous: current?.version,
  };
}

/** Write every tile z0..DEM_MAX_ZOOM into `dir` (built beside it and moved in whole). */
async function writeDemTiles(grid: HeightGrid, dir: string): Promise<number> {
  const sharp = (await import("sharp")).default;
  const levels = demLevels(grid);
  const temporary = `${dir}.${process.pid}.tmp`;
  await rm(temporary, { recursive: true, force: true });
  const raw = { width: RASTER_TILE_SIZE, height: RASTER_TILE_SIZE, channels: 3 as const };
  let tiles = 0;
  for (let z = 0; z <= DEM_MAX_ZOOM; z++) {
    const size = 2 ** z;
    for (let ty = 0; ty < size; ty++) {
      await Promise.all(
        Array.from({ length: size }, async (_, tx) => {
          const file = rasterTileFile(temporary, z, tx, ty)!;
          const webp = await sharp(demTile(levels, z, tx, ty), { raw })
            .webp({ lossless: true, effort: 2 })
            .toBuffer();
          await mkdir(path.dirname(file), { recursive: true });
          await writeFile(file, webp);
        })
      );
      tiles += size;
    }
  }
  await rm(dir, { recursive: true, force: true });
  await rename(temporary, dir);
  return tiles;
}

/** Build the planned DEM (an existing version's tiles are kept), record it and tell the map it changed. */
export async function applyRealmDem(db: DemDb, realmId: string, plan: DemPlan): Promise<DemEntry> {
  if (!plan.changed) return { ...plan.entry, built: false, tiles: 0 };
  const dir = rasterVersionDir(realmId, DEM_LAYER_ID, plan.entry.version)!;
  const tiles = plan.built ? 0 : await writeDemTiles(plan.grid, dir);
  await updateRealmSettings(db, realmId, (settings) => {
    const layers = withRasterLayer(parseRealmMapSettings(settings).rasterLayers ?? [], plan.entry);
    const rasterLayers = RealmMapSettingsSchema.shape.rasterLayers.parse(layers);
    return withRealmMapSettings(settings, { rasterLayers });
  });
  await pruneRasterVersions(realmId, DEM_LAYER_ID, [
    plan.entry.version,
    plan.previous ?? plan.entry.version,
  ]);
  await invalidateRealmMap(db, realmId);
  return { ...plan.entry, built: !plan.built, tiles };
}

/** Build a realm's DEM from `source`; null when it has no heights. */
export async function buildRealmDem(
  db: DemDb,
  realmId: string,
  source: ReliefSource
): Promise<DemEntry | null> {
  const plan = await planRealmDem(db, realmId, source);
  return plan && applyRealmDem(db, realmId, plan);
}

/**
 * The height (metres; negative under the sea) at a point, read from the realm's DEM at its finest zoom; null when
 * the realm has none or its tile is missing.
 */
export async function demElevationAt(
  layers: readonly RealmRasterLayer[] | undefined,
  realmId: string,
  lng: number,
  lat: number
): Promise<number | null> {
  const dem = layers?.find((l) => l.kind === "dem");
  const dir = dem && rasterVersionDir(realmId, dem.id, dem.version);
  if (!dir) return null;
  const at = demPixelAt(lng, lat, dem.maxZoom);
  const file = rasterTileFile(dir, at.z, at.x, at.y);
  const bytes = file && (await readFile(file).catch(() => null));
  if (!bytes) return null;
  const sharp = (await import("sharp")).default;
  const { data, info } = await sharp(bytes).raw().toBuffer({ resolveWithObject: true });
  const i = (at.row * info.width + at.col) * info.channels;
  return Math.round(decodeTerrarium(data[i]!, data[i + 1]!, data[i + 2]!));
}

/** `demElevationAt` for a realm, reading its raster layers from its settings. */
export async function realmDemElevation(
  db: Pick<PrismaClient, "realm">,
  realmId: string,
  lng: number,
  lat: number
): Promise<number | null> {
  const realm = await db.realm.findUnique({ where: { id: realmId }, select: { settings: true } });
  const layers = parseRealmMapSettings(realm?.settings as Prisma.JsonValue).rasterLayers;
  return demElevationAt(layers, realmId, lng, lat);
}
