/** @jest-environment node */
/** Atlas health: job counts, folder sizes under a time budget and a ten minute cache, and the map cron jobs. */
jest.mock("~/env", () => ({
  env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test", CRON_ENABLED_JOBS: "" },
}));
jest.mock("~/server/db", () => ({ db: {} }));

import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  atlasHealth,
  folderBytes,
  STORAGE_CACHE_MS,
  type StorageFigure,
  type WalkResult,
} from "~/server/modules/maps/atlas-health";
import { atlasFakeDb } from "./atlas-fakes";

let root: string;
beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), "atlas-health-"));
  await mkdir(path.join(root, "tiles", "r", "0"), { recursive: true });
  await writeFile(path.join(root, "tiles", "r", "0", "a.webp"), Buffer.alloc(100));
  await writeFile(path.join(root, "tiles", "b.webp"), Buffer.alloc(24));
  process.env.MAP_TILE_DIR = path.join(root, "tiles");
  process.env.MAP_RASTER_DIR = path.join(root, "no-rasters-here");
  process.env.MAP_IMPORT_DIR = path.join(root, "imports");
});
afterAll(async () => {
  for (const key of ["MAP_TILE_DIR", "MAP_RASTER_DIR", "MAP_IMPORT_DIR"]) delete process.env[key];
  await rm(root, { recursive: true, force: true });
});

const NOW = Date.UTC(2026, 9, 12, 12);
const hours = (h: number) => new Date(NOW - h * 3_600_000);

describe("atlasHealth jobs", () => {
  it("counts running, queued and the jobs that failed in the last 24 hours", async () => {
    const db = atlasFakeDb();
    db.mapImportJob.rows.push(
      { status: "running" },
      { status: "running" },
      { status: "queued" },
      { status: "failed", finishedAt: hours(1) },
      { status: "failed", finishedAt: hours(23) },
      { status: "failed", finishedAt: hours(30) },
      { status: "succeeded", finishedAt: hours(1) }
    );
    const health = await atlasHealth(db, { now: () => NOW, cache: new Map() });
    expect(health.jobs).toEqual({ running: 2, queued: 1, failedLast24h: 2 });
  });
});

describe("atlasHealth storage", () => {
  it("sums the files of a folder and reports a missing folder as 0", async () => {
    const health = await atlasHealth(atlasFakeDb(), { now: () => NOW, cache: new Map() });
    expect(health.storage.tiles.bytes).toBe(124);
    expect(health.storage.rasters.bytes).toBe(0);
    expect(health.storage.imports.bytes).toBe(0);
  });

  it("reports a folder over its time budget as not measured and still answers", async () => {
    const walk = jest.fn((dir: string) =>
      dir.endsWith("tiles")
        ? new Promise<WalkResult | null>(() => undefined)
        : Promise.resolve({ bytes: 5, skipped: 0 })
    );
    const started = Date.now();
    const health = await atlasHealth(atlasFakeDb(), {
      now: () => NOW,
      cache: new Map(),
      budgetMs: 30,
      walk,
    });
    expect(Date.now() - started).toBeLessThan(1_000);
    expect(health.storage.tiles.bytes).toBeNull();
    expect(health.storage.rasters.bytes).toBe(5);
  });

  it("tells a walk the budget has passed so it stops", async () => {
    let expired: (() => boolean) | undefined;
    await atlasHealth(atlasFakeDb(), {
      now: () => NOW,
      cache: new Map(),
      budgetMs: 10,
      walk: (_dir, over) => {
        expired = over;
        return new Promise<WalkResult | null>(() => undefined);
      },
    });
    expect(expired?.()).toBe(true);
    expect(await folderBytes(process.env.MAP_TILE_DIR!, () => true)).toBeNull();
  });

  it("keeps a timeout as not measured for ten minutes too", async () => {
    const cache = new Map<string, StorageFigure>();
    const walk = jest.fn(() => new Promise<WalkResult | null>(() => undefined));
    const deps = { now: () => NOW, cache, walk, budgetMs: 10 };
    const first = await atlasHealth(atlasFakeDb(), deps);
    const second = await atlasHealth(atlasFakeDb(), {
      ...deps,
      now: () => NOW + STORAGE_CACHE_MS - 1,
    });
    expect(first.storage.tiles.bytes).toBeNull();
    expect(second.storage.tiles.bytes).toBeNull();
    expect(walk).toHaveBeenCalledTimes(3);
  });

  it("lets concurrent requests share one walk of each folder", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const walk = jest.fn(async () => {
      await gate;
      return { bytes: 9, skipped: 0 };
    });
    const deps = { now: () => NOW, cache: new Map<string, StorageFigure>(), walk };
    const both = Promise.all([atlasHealth(atlasFakeDb(), deps), atlasHealth(atlasFakeDb(), deps)]);
    // Let both requests reach their walk before it finishes
    await new Promise((resolve) => setImmediate(resolve));
    release();
    const [first, second] = await both;
    // Three folders, each walked once for the two requests
    expect(walk).toHaveBeenCalledTimes(3);
    expect(first.storage.tiles.bytes).toBe(9);
    expect(second.storage).toEqual(first.storage);

    // A walk that has finished is not shared: the next request after the cache expires walks again
    await atlasHealth(atlasFakeDb(), { ...deps, now: () => NOW + STORAGE_CACHE_MS });
    expect(walk).toHaveBeenCalledTimes(6);
  });

  it("keeps a measurement for ten minutes", async () => {
    const cache = new Map<string, StorageFigure>();
    const walk = jest.fn(async () => ({ bytes: 7, skipped: 0 }));
    let now = NOW;
    const deps = { now: () => now, cache, walk };
    await atlasHealth(atlasFakeDb(), deps);
    expect(walk).toHaveBeenCalledTimes(3);
    now = NOW + STORAGE_CACHE_MS - 1;
    await atlasHealth(atlasFakeDb(), deps);
    expect(walk).toHaveBeenCalledTimes(3);
    now = NOW + STORAGE_CACHE_MS;
    await atlasHealth(atlasFakeDb(), deps);
    expect(walk).toHaveBeenCalledTimes(6);
  });
});

describe("folderBytes", () => {
  const unreadable = process.getuid?.() === 0 ? it.skip : it;

  unreadable("skips a folder it cannot read, counts the rest and says so", async () => {
    const base = path.join(root, "mixed");
    await mkdir(path.join(base, "open"), { recursive: true });
    await mkdir(path.join(base, "locked"), { recursive: true });
    await writeFile(path.join(base, "open", "a"), Buffer.alloc(10));
    await writeFile(path.join(base, "locked", "b"), Buffer.alloc(99));
    await chmod(path.join(base, "locked"), 0o000);
    try {
      expect(await folderBytes(base, () => false)).toEqual({ bytes: 10, skipped: 1 });
    } finally {
      await chmod(path.join(base, "locked"), 0o755);
    }
  });

  it("is zero for a folder that does not exist, and not partial", async () => {
    expect(await folderBytes(path.join(root, "nothing"), () => false)).toEqual({
      bytes: 0,
      skipped: 0,
    });
  });

  it("shows a partly measured folder as partial in the figure", async () => {
    const health = await atlasHealth(atlasFakeDb(), {
      now: () => NOW,
      cache: new Map(),
      walk: async () => ({ bytes: 3, skipped: 2 }),
    });
    expect(health.storage.tiles).toMatchObject({ bytes: 3, partial: true });
  });
});

describe("atlasHealth cron", () => {
  it("reports the last run of each map cron job, null when it never ran", async () => {
    const db = atlasFakeDb();
    db.cronRun.rows.push(
      { job: "map-tiles", status: "success", startedAt: hours(3) },
      { job: "map-tiles", status: "failed", startedAt: hours(1) },
      { job: "map-import", status: "success", startedAt: hours(2) },
      { job: "something-else", status: "success", startedAt: hours(2) }
    );
    const { cron } = await atlasHealth(db, { now: () => NOW, cache: new Map() });
    expect(cron["map-tiles"]).toEqual({
      lastRunAt: hours(1).toISOString(),
      lastStatus: "failed",
      lastSuccessAt: hours(3).toISOString(),
    });
    expect(cron["map-import"]).toMatchObject({ lastStatus: "success" });
    expect(cron["geo-profiles"]).toBeNull();
    expect(Object.keys(cron)).toEqual(["map-tiles", "geo-profiles", "map-import"]);
  });
});
