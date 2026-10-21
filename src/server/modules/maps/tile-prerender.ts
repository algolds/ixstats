/**
 * The `map-tiles` cron job (src/server/cron/jobs.ts, under the job lease `map-tiles`): pre-renders the low zooms of a
 * realm's decorative tiles, so the first visitor after a map change finds the globe view already cached
 * (tile-cache.ts), and removes tile folders of versions a newer one has outlived. z0 to z3 of altitudes cost a PostGIS
 * `ST_Union` per tile, around 20 s a realm; deeper zooms render on first request.
 *
 * A version is done when its `.done` marker exists. A run that stops (budget spent, a tile failing, a crash) leaves no
 * marker; the next one skips the tiles already cached and finishes the rest. Only Ixnay and published realms are
 * rendered ahead: an unpublished realm changes with every edit and has few viewers, so its tiles wait for one.
 */
import type { PrismaClient } from "@prisma/client";
import { TILED_LAYERS } from "~/lib/maps/decorative-tiles";
import { DEFAULT_REALM_ID, isUnpublishedStatus } from "~/lib/realms/realm-ids";
import { buildTile } from "~/server/modules/maps/tile-render";
import {
  isTileVersionDone,
  markTileVersionDone,
  readTile,
  removeStaleTileVersions,
  writeTile,
} from "./tile-cache";

/** The deepest zoom rendered ahead of a visitor. */
const PRERENDER_MAX_ZOOM = 3;

/** A run starts no new tile after this long; the lease (jobs.ts) outlasts it and the next run carries on. */
export const MAP_TILE_RUN_BUDGET_MS = 15 * 60_000;

interface MapTilePrerenderResult {
  /** Tiles rendered and stored by this run. */
  rendered: number;
  /** Tiles that failed to render or store (their version stays unmarked and is retried by the next run). */
  failed: number;
  /** Versions whose low zooms are now all cached. */
  versionsCompleted: number;
  /** Folders of outlived versions removed. */
  removedVersions: number;
}

type TileDb = Pick<PrismaClient, "$queryRawUnsafe"> & {
  realm: Pick<PrismaClient["realm"], "findMany">;
};

interface RunOptions {
  budgetMs?: number;
  now?: () => number;
}

/** Every tile of z0 to z3 of the three layers, low zooms first so a short run still covers the globe view. */
function* lowZoomTiles() {
  for (let z = 0; z <= PRERENDER_MAX_ZOOM; z++) {
    for (const layer of TILED_LAYERS) {
      for (let x = 0; x < 2 ** z; x++) for (let y = 0; y < 2 ** z; y++) yield { layer, z, x, y };
    }
  }
}

/** Render the version's missing low-zoom tiles; adds to `result` and returns whether all of them are cached. */
async function prerenderVersion(
  db: TileDb,
  realmId: string,
  version: number,
  result: MapTilePrerenderResult,
  { deadline, now }: { deadline: number; now: () => number }
): Promise<boolean> {
  let complete = true;
  for (const { layer, z, x, y } of lowZoomTiles()) {
    if (await readTile(realmId, version, layer, z, x, y)) continue;
    if (now() >= deadline) return false;
    try {
      await writeTile(
        realmId,
        version,
        layer,
        z,
        x,
        y,
        await buildTile(db, realmId, layer, z, x, y)
      );
      result.rendered++;
    } catch (err) {
      result.failed++;
      complete = false;
      console.error(`[map-tiles] ${realmId}/${version}/${layer}/${z}/${x}/${y} failed`, err);
    }
  }
  return complete;
}

/** Ixnay first, then the rest as stored. */
const ixnayFirst = <T extends { id: string }>(realms: T[]): T[] =>
  [...realms].sort((a, b) => Number(b.id === DEFAULT_REALM_ID) - Number(a.id === DEFAULT_REALM_ID));

/**
 * The `map-tiles` cron job: pre-renders z0 to z3 for every published realm whose current map version is not done,
 * then removes outlived version folders of every realm. Returns the counts the cron run records.
 */
export async function runMapTilePrerender(
  db: TileDb,
  { budgetMs = MAP_TILE_RUN_BUDGET_MS, now = Date.now }: RunOptions = {}
): Promise<MapTilePrerenderResult> {
  const result: MapTilePrerenderResult = {
    rendered: 0,
    failed: 0,
    versionsCompleted: 0,
    removedVersions: 0,
  };
  const deadline = now() + budgetMs;
  // A system realm has no map.
  const realms = await db.realm.findMany({
    where: { isSystem: false },
    select: { id: true, status: true, mapVersion: true },
  });
  for (const { id, status, mapVersion } of ixnayFirst(realms)) {
    const published = id === DEFAULT_REALM_ID || !isUnpublishedStatus(status);
    if (published && !(await isTileVersionDone(id, mapVersion))) {
      if (await prerenderVersion(db, id, mapVersion, result, { deadline, now })) {
        await markTileVersionDone(id, mapVersion);
        result.versionsCompleted++;
      }
    }
    result.removedVersions += await removeStaleTileVersions(id, mapVersion, now());
  }
  return result;
}
