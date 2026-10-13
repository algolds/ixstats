/**
 * Atlas health strip: running and failed map jobs, the size of the three map folders (a walk under a time budget,
 * cached for ten minutes) and the last run of the map cron jobs. Server only.
 */
import type { PrismaClient } from "@prisma/client";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { cronHealth, type CronJobHealth } from "~/lib/system/cron-runs";
import { mapImportDir } from "./map-import.storage";
import { mapRasterDir } from "./realm-rasters.storage";
import { mapTileDir } from "./tile-cache";

export const STORAGE_BUDGET_MS = 1_500;
export const STORAGE_CACHE_MS = 10 * 60_000;
const FAILED_WINDOW_MS = 24 * 60 * 60_000;
const WALK_PARALLEL = 16;
/** The map cron jobs the strip reports (server/cron/jobs.ts). */
export const MAP_CRON_JOBS = ["map-tiles", "geo-profiles", "map-import"] as const;

export interface StorageFigure {
  /** Total size of the folder's files; 0 for a folder that does not exist; null when it was not measured in time */
  bytes: number | null;
  /** Some subfolders could not be read and are left out of `bytes` */
  partial: boolean;
  measuredAt: Date;
}

export interface AtlasHealth {
  jobs: { running: number; queued: number; failedLast24h: number };
  storage: { tiles: StorageFigure; rasters: StorageFigure; imports: StorageFigure };
  /** Last run per map cron job; null when it has never run (or is not enabled here) */
  cron: Record<(typeof MAP_CRON_JOBS)[number], CronJobHealth | null>;
}

/** A finished walk: the bytes counted and how many folders could not be read. */
export interface WalkResult {
  bytes: number;
  skipped: number;
}

export interface HealthDeps {
  now?: () => number;
  budgetMs?: number;
  /** Measured sizes by folder, kept for STORAGE_CACHE_MS. */
  cache?: Map<string, StorageFigure>;
  /** Walks under way by folder: a request for a folder being walked waits for that walk (tests pass their own). */
  inFlight?: Map<string, Promise<StorageFigure>>;
  /** Total bytes under a folder; `expired()` turns true once the budget has passed (tests replace it). */
  walk?: (dir: string, expired: () => boolean) => Promise<WalkResult | null>;
}

const sharedCache = new Map<string, StorageFigure>();
const sharedInFlight = new Map<string, Promise<StorageFigure>>();

/**
 * The bytes of every file under `dir` (0 when it does not exist), counting a folder that cannot be read as skipped;
 * null when `expired()` stopped the walk.
 */
export async function folderBytes(dir: string, expired: () => boolean): Promise<WalkResult | null> {
  let total = 0;
  let skipped = 0;
  const pending = [dir];
  while (pending.length > 0) {
    if (expired()) return null;
    const here = pending.pop()!;
    const entries = await readdir(here, { withFileTypes: true }).catch((error) => {
      // A folder that is gone counts as empty; one that cannot be read is left out and reported
      const gone =
        typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
      if (!gone) skipped++;
      return [];
    });
    for (let i = 0; i < entries.length; i += WALK_PARALLEL) {
      if (expired()) return null;
      const batch = entries.slice(i, i + WALK_PARALLEL);
      const sizes = await Promise.all(
        batch.map(async (entry) => {
          const full = path.join(here, entry.name);
          if (entry.isDirectory()) {
            pending.push(full);
            return 0;
          }
          return entry.isFile() ? ((await stat(full).catch(() => null))?.size ?? 0) : 0;
        })
      );
      total += sizes.reduce((sum, size) => sum + size, 0);
    }
  }
  return { bytes: total, skipped };
}

/**
 * One folder's size, from the cache when it is under ten minutes old, else walked within the budget. Requests that
 * arrive while the folder is being walked share that walk instead of each walking it.
 */
async function measureFolder(dir: string, deps: HealthDeps): Promise<StorageFigure> {
  const now = deps.now ?? Date.now;
  const hit = (deps.cache ?? sharedCache).get(dir);
  if (hit && now() - hit.measuredAt.getTime() < STORAGE_CACHE_MS) return hit;
  const inFlight = deps.inFlight ?? sharedInFlight;
  const running = inFlight.get(dir);
  if (running) return running;
  const walking = walkFolder(dir, deps).finally(() => inFlight.delete(dir));
  inFlight.set(dir, walking);
  return walking;
}

/** Walks the folder within the budget and keeps the figure in the cache. */
async function walkFolder(dir: string, deps: HealthDeps): Promise<StorageFigure> {
  const now = deps.now ?? Date.now;
  const cache = deps.cache ?? sharedCache;
  let over = false;
  const expired = () => over;
  const walk = deps.walk ?? folderBytes;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      over = true;
      resolve(null);
    }, deps.budgetMs ?? STORAGE_BUDGET_MS);
    timer.unref?.();
  });
  const walked = await Promise.race([walk(dir, expired).catch(() => null), late]);
  clearTimeout(timer);
  // A walk that ran over the budget or failed is "not measured" (null)
  const figure: StorageFigure = {
    bytes: walked?.bytes ?? null,
    partial: (walked?.skipped ?? 0) > 0,
    measuredAt: new Date(now()),
  };
  cache.set(dir, figure);
  return figure;
}

export async function atlasHealth(db: PrismaClient, deps: HealthDeps = {}): Promise<AtlasHealth> {
  const now = (deps.now ?? Date.now)();
  const since = new Date(now - FAILED_WINDOW_MS);
  const [groups, tiles, rasters, imports, cron] = await Promise.all([
    db.mapImportJob.groupBy({
      by: ["status"],
      where: {
        OR: [
          { status: { in: ["queued", "running"] } },
          { status: "failed", finishedAt: { gte: since } },
        ],
      },
      _count: { _all: true },
    }),
    measureFolder(mapTileDir(), deps),
    measureFolder(mapRasterDir(), deps),
    measureFolder(mapImportDir(), deps),
    cronHealth(db),
  ]);
  const count = (status: string) => groups.find((g) => g.status === status)?._count._all ?? 0;
  return {
    jobs: { running: count("running"), queued: count("queued"), failedLast24h: count("failed") },
    storage: { tiles, rasters, imports },
    cron: {
      "map-tiles": cron["map-tiles"] ?? null,
      "geo-profiles": cron["geo-profiles"] ?? null,
      "map-import": cron["map-import"] ?? null,
    },
  };
}
