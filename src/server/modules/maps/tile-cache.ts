/**
 * The vector tile cache (`/api/map-tiles`): a realm's decorative tiles are rendered by PostGIS once per map version
 * and kept on disk as `<MAP_TILE_DIR>/<realmId>/<version>/<layer>/<z>/<x>/<y>.pbf`, behind a small in-memory LRU.
 * A version bump is a new folder and a new URL, so nothing is ever invalidated; the `map-tiles` cron job
 * (tile-prerender.ts) renders the low zooms ahead of the first visitor and removes folders a day after a newer
 * version was ready. The web server and the cron worker share the folder, so set `MAP_TILE_DIR` for both in
 * production (their working directories differ). Every path segment is checked before it is joined, so a request
 * can never reach outside the root. Server only.
 */
import { randomBytes } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { isTileCoord, isTiledLayer, type TiledLayer } from "~/lib/maps/decorative-tiles";
import { ByteLru } from "~/server/shared/byte-lru";

const REALM_ID = /^[A-Za-z0-9_-]{1,64}$/;
const DONE_MARKER = ".done";
const MEMORY_BYTES = 32 * 1024 * 1024;
/** How long a version's folder outlives the next version's readiness (open tabs still ask for the old URLs). */
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

/** Where the tiles live: `MAP_TILE_DIR`, else `data/cache/map-tiles` under the app (gitignored). */
export function mapTileDir(): string {
  return (
    process.env.MAP_TILE_DIR ||
    path.join(/*turbopackIgnore: true*/ process.cwd(), "data", "cache", "map-tiles")
  );
}

/** A tile of a realm's map at one version: realm id, version, layer, z, x, y. */
export type TileArgs = readonly [
  realmId: string,
  version: number,
  layer: TiledLayer,
  z: number,
  x: number,
  y: number,
];

function realmDir(realmId: string): string | null {
  return REALM_ID.test(realmId) ? path.join(mapTileDir(), realmId) : null;
}

function versionDir(realmId: string, version: number): string | null {
  const dir = realmDir(realmId);
  return dir && Number.isSafeInteger(version) && version >= 0
    ? path.join(dir, String(version))
    : null;
}

/** The tile's file, or null when any part of the address is not one a tile has. */
function tileFile(...[realmId, version, layer, z, x, y]: TileArgs): string | null {
  const dir = versionDir(realmId, version);
  if (!dir || !isTiledLayer(layer) || !isTileCoord(z, x, y)) return null;
  return path.join(dir, layer, String(z), String(x), `${y}.pbf`);
}

const memory = new ByteLru<Buffer>(MEMORY_BYTES);

/** The tile's bytes (empty for a tile with nothing in it), or null when it is not cached. */
export async function readTile(
  realmId: string,
  version: number,
  layer: TiledLayer,
  z: number,
  x: number,
  y: number
): Promise<Buffer | null> {
  const file = tileFile(realmId, version, layer, z, x, y);
  if (!file) return null;
  const hot = memory.get(file);
  if (hot) return hot;
  try {
    const bytes = await readFile(file);
    memory.set(file, bytes);
    return bytes;
  } catch (err) {
    // The cache is only an optimisation: a file that cannot be read is a miss
    if ((err as NodeJS.ErrnoException).code !== "ENOENT")
      console.error("[map-tiles] read failed", err);
    return null;
  }
}

/** Store a tile: written beside its file and renamed into place, so a reader never sees half of one. */
export async function writeTile(
  realmId: string,
  version: number,
  layer: TiledLayer,
  z: number,
  x: number,
  y: number,
  bytes: Uint8Array
): Promise<void> {
  const file = tileFile(realmId, version, layer, z, x, y);
  if (!file) throw new Error("invalid tile");
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomBytes(6).toString("hex")}.tmp`;
  try {
    await writeFile(temporary, bytes);
    await rename(temporary, file);
  } catch (err) {
    await rm(temporary, { force: true });
    throw err;
  }
  memory.set(file, Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes));
}

/** What `getTile` needs from its caller: the renderer and the realm's current map version (read on a miss only). */
export interface TileOrigin {
  render: () => Promise<Uint8Array>;
  currentVersion: () => Promise<number>;
}

/** A tile's bytes and whether they are the content of the version in its URL (so safe to cache for good). */
export interface TileResult {
  bytes: Buffer;
  cacheable: boolean;
}

const inflight = new Map<string, Promise<Buffer>>();

/** Render a missing tile and store it; requests for the same tile that arrive meanwhile share the render. */
function renderOnce(key: TileArgs, render: () => Promise<Uint8Array>): Promise<Buffer> {
  const id = key.join("/");
  const running = inflight.get(id);
  if (running) return running;
  const started = (async () => {
    // Another request may have stored it since this one missed
    const stored = await readTile(...key);
    if (stored) return stored;
    const bytes = Buffer.from(await render());
    await writeTile(...key, bytes).catch((err: Error) =>
      console.error(`[map-tiles] ${id} not stored`, err)
    );
    return bytes;
  })().finally(() => inflight.delete(id));
  inflight.set(id, started);
  return started;
}

/**
 * The tile for a URL's version. A cached tile is served as is. On a miss the version is compared with the realm's
 * current one: the current version's tile is rendered once and stored; a version the realm has not reached is null
 * (a made-up URL must not fill the disk); an older version (an open tab that has not seen the edit) gets the
 * current data, not stored under the old version.
 */
export async function getTile(key: TileArgs, source: TileOrigin): Promise<TileResult | null> {
  const hit = await readTile(...key);
  if (hit) return { bytes: hit, cacheable: true };
  const current = await source.currentVersion();
  const version = key[1];
  if (version > current) return null;
  if (version < current) return { bytes: Buffer.from(await source.render()), cacheable: false };
  return { bytes: await renderOnce(key, source.render), cacheable: true };
}

/** Whether the cron job finished pre-rendering the version's low zooms. */
export async function isTileVersionDone(realmId: string, version: number): Promise<boolean> {
  const dir = versionDir(realmId, version);
  return (
    !!dir &&
    (await stat(path.join(dir, DONE_MARKER)).then(
      () => true,
      () => false
    ))
  );
}

export async function markTileVersionDone(realmId: string, version: number): Promise<void> {
  const dir = versionDir(realmId, version);
  if (!dir) throw new Error("invalid tile version");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, DONE_MARKER), "");
}

/** When a version's folder was ready: its marker's time, else the folder's; never (Infinity) when it is gone. */
async function readyAt(dir: string): Promise<number> {
  const marker = await stat(path.join(dir, DONE_MARKER)).catch(() => null);
  const info = marker ?? (await stat(dir).catch(() => null));
  return info?.mtimeMs ?? Number.POSITIVE_INFINITY;
}

/**
 * Remove the realm's folders of versions below `currentVersion` once the next folder up was ready more than a day
 * ago (the newest old version has none above it and is judged by its own time). Returns how many went.
 */
export async function removeStaleTileVersions(
  realmId: string,
  currentVersion: number,
  now = Date.now()
): Promise<number> {
  const dir = realmDir(realmId);
  if (!dir) return 0;
  const names = await readdir(dir).catch(() => [] as string[]);
  const versions = names.filter((name) => /^\d+$/.test(name)).map(Number);
  versions.sort((a, b) => a - b);
  let removed = 0;
  for (const [i, version] of versions.entries()) {
    if (version >= currentVersion) break;
    const folder = (v: number) => path.join(dir, String(v));
    if (now - (await readyAt(folder(versions[i + 1] ?? version))) <= STALE_AFTER_MS) continue;
    await rm(folder(version), { recursive: true, force: true });
    removed++;
  }
  return removed;
}
