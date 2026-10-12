/** @jest-environment node */
/**
 * The vector tile disk cache (Atlas R0): `<MAP_TILE_DIR>/<realmId>/f<format>/<version>/<layer>/<z>/<x>/<y>.pbf`, written
 * atomically, behind a small in-memory LRU, with one render shared by concurrent requests.
 */
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import type { TiledLayer } from "~/lib/maps/decorative-tiles";

type TileCache = typeof import("~/server/modules/maps/tile-cache");

let root: string;
let cache: TileCache;

/** A new module instance: empty memory LRU and no renders in flight, as in a fresh process. */
function freshCache(): TileCache {
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  cache = require("~/server/modules/maps/tile-cache") as TileCache;
  return cache;
}

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "map-tiles-"));
  process.env.MAP_TILE_DIR = root;
  freshCache();
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  delete process.env.MAP_TILE_DIR;
});

const bytes = (...values: number[]) => Buffer.from(values);

describe("tile files", () => {
  it("writes <root>/<realmId>/f<format>/<version>/<layer>/<z>/<x>/<y>.pbf and reads it back", async () => {
    await cache.writeTile("r_eurth", 7, "rivers", 2, 1, 3, bytes(1, 2, 3));
    expect(
      readFileSync(path.join(root, "r_eurth", "f1", "7", "rivers", "2", "1", "3.pbf"))
    ).toEqual(bytes(1, 2, 3));
    expect(await cache.readTile("r_eurth", 7, "rivers", 2, 1, 3)).toEqual(bytes(1, 2, 3));
  });

  it("reads null for a tile that was never written, and for another version or layer", async () => {
    await cache.writeTile("default", 1, "lakes", 0, 0, 0, bytes(9));
    expect(await cache.readTile("default", 1, "lakes", 1, 0, 0)).toBeNull();
    expect(await cache.readTile("default", 2, "lakes", 0, 0, 0)).toBeNull();
    expect(await cache.readTile("default", 1, "rivers", 0, 0, 0)).toBeNull();
    expect(await cache.readTile("r_other", 1, "lakes", 0, 0, 0)).toBeNull();
  });

  it("keeps an empty tile as a hit, distinct from a miss", async () => {
    await cache.writeTile("default", 0, "altitudes", 3, 0, 0, Buffer.alloc(0));
    const hit = await freshCache().readTile("default", 0, "altitudes", 3, 0, 0);
    expect(hit).not.toBeNull();
    expect(hit?.length).toBe(0);
  });

  it("serves a tile written by another process (the cron worker) from disk", async () => {
    await cache.writeTile("default", 4, "lakes", 1, 1, 0, bytes(5, 6));
    expect(await freshCache().readTile("default", 4, "lakes", 1, 1, 0)).toEqual(bytes(5, 6));
  });

  it("writes atomically: no temporary file is left behind", async () => {
    await cache.writeTile("default", 1, "rivers", 3, 2, 5, bytes(1));
    await cache.writeTile("default", 1, "rivers", 3, 2, 5, bytes(2));
    expect(readdirSync(path.join(root, "default", "f1", "1", "rivers", "3", "2"))).toEqual([
      "5.pbf",
    ]);
  });

  it("leaves neither a partial tile nor a temporary file when the write fails", async () => {
    // A directory where the tile file belongs makes the final rename fail
    mkdirSync(path.join(root, "default", "f1", "1", "rivers", "3", "2", "5.pbf"), {
      recursive: true,
    });
    await expect(cache.writeTile("default", 1, "rivers", 3, 2, 5, bytes(1))).rejects.toThrow();
    expect(readdirSync(path.join(root, "default", "f1", "1", "rivers", "3", "2"))).toEqual([
      "5.pbf",
    ]);
  });

  type Row = [
    name: string,
    realm: string,
    version: number,
    layer: string,
    z: number,
    x: number,
    y: number,
  ];
  const invalid: Row[] = [
    ["a path-like realm id", "../escape", 1, "rivers", 0, 0, 0],
    ["a realm id with a slash", "a/b", 1, "rivers", 0, 0, 0],
    ["a negative version", "default", -1, "rivers", 0, 0, 0],
    ["a fractional version", "default", 1.5, "rivers", 0, 0, 0],
    ["a layer the tiles do not draw", "default", 1, "climate", 0, 0, 0],
    ["a zoom past the pyramid", "default", 1, "rivers", 7, 0, 0],
    ["a column outside the zoom", "default", 1, "rivers", 2, 4, 0],
  ];
  it.each(invalid)(
    "never touches the disk for %s",
    async (_name, realm, version, layer, z, x, y) => {
      const args = [realm, version, layer as TiledLayer, z, x, y] as const;
      expect(await cache.readTile(...args)).toBeNull();
      await expect(cache.writeTile(...args, bytes(1))).rejects.toThrow(/invalid tile/);
      expect(readdirSync(root)).toEqual([]);
      expect(existsSync(path.join(root, "..", "escape"))).toBe(false);
    }
  );

  it("keeps a different tile format in a different folder: another format's tiles are never read, nor overwritten", async () => {
    await cache.writeTile("default", 3, "rivers", 0, 0, 0, bytes(1));
    jest.resetModules();
    jest.doMock("~/lib/maps/tile-format", () => ({ TILE_FORMAT_VERSION: 2 }));
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const next = require("~/server/modules/maps/tile-cache") as TileCache;
      expect(await next.readTile("default", 3, "rivers", 0, 0, 0)).toBeNull();
      await next.writeTile("default", 3, "rivers", 0, 0, 0, bytes(2));
      expect(readdirSync(path.join(root, "default")).sort()).toEqual(["f1", "f2"]);
      expect(
        readFileSync(path.join(root, "default", "f1", "3", "rivers", "0", "0", "0.pbf"))
      ).toEqual(bytes(1));
      expect(
        readFileSync(path.join(root, "default", "f2", "3", "rivers", "0", "0", "0.pbf"))
      ).toEqual(bytes(2));
    } finally {
      jest.dontMock("~/lib/maps/tile-format");
    }
  });

  it("roots the cache at MAP_TILE_DIR, else data/cache/map-tiles under the app", () => {
    expect(cache.mapTileDir()).toBe(root);
    delete process.env.MAP_TILE_DIR;
    expect(cache.mapTileDir()).toBe(path.join(process.cwd(), "data/cache/map-tiles"));
  });
});

describe("getTile", () => {
  const key = ["default", 3, "altitudes", 2, 1, 1] as const;
  const source = (render: jest.Mock, current = 3) => ({
    render,
    currentVersion: jest.fn().mockResolvedValue(current),
  });

  it("serves a cache hit from memory without calling the renderer", async () => {
    await cache.writeTile(...key, bytes(1, 2));
    const render = jest.fn();
    const result = await cache.getTile(key, source(render));
    expect(result).toEqual({ bytes: bytes(1, 2), cacheable: true });
    expect(render).not.toHaveBeenCalled();
  });

  it("serves a disk hit in a fresh process without calling the renderer or asking for the version", async () => {
    await cache.writeTile(...key, bytes(1, 2));
    const render = jest.fn();
    const src = source(render);
    const result = await freshCache().getTile(key, src);
    expect(result?.bytes).toEqual(bytes(1, 2));
    expect(render).not.toHaveBeenCalled();
    expect(src.currentVersion).not.toHaveBeenCalled();
  });

  it("renders a miss once, writes it, and serves it from the cache after", async () => {
    const render = jest.fn().mockResolvedValue(new Uint8Array([7, 8, 9]));
    const first = await cache.getTile(key, source(render));
    expect(first).toEqual({ bytes: bytes(7, 8, 9), cacheable: true });
    expect(
      readFileSync(path.join(root, "default", "f1", "3", "altitudes", "2", "1", "1.pbf"))
    ).toEqual(bytes(7, 8, 9));
    const again = await freshCache().getTile(key, source(render));
    expect(again?.bytes).toEqual(bytes(7, 8, 9));
    expect(render).toHaveBeenCalledTimes(1);
  });

  it("shares one render between concurrent requests for the same tile", async () => {
    let release: (value: Uint8Array) => void = () => {};
    const render = jest.fn(() => new Promise<Uint8Array>((resolve) => (release = resolve)));
    const pending = [1, 2, 3, 4].map(() => cache.getTile(key, source(render)));
    await new Promise((resolve) => setTimeout(resolve, 20));
    release(new Uint8Array([4, 2]));
    const results = await Promise.all(pending);
    expect(render).toHaveBeenCalledTimes(1);
    for (const r of results) expect(r?.bytes).toEqual(bytes(4, 2));
  });

  it("does not render again when another request stored the tile while this one asked for the version", async () => {
    const render = jest.fn().mockResolvedValue(new Uint8Array([1]));
    const src = {
      render,
      currentVersion: jest.fn(async () => {
        await cache.writeTile(...key, bytes(5));
        return 3;
      }),
    };
    const result = await cache.getTile(key, src);
    expect(result?.bytes).toEqual(bytes(5));
    expect(render).not.toHaveBeenCalled();
  });

  it("stores an empty render as an empty tile", async () => {
    const render = jest.fn().mockResolvedValue(new Uint8Array());
    const result = await cache.getTile(key, source(render));
    expect(result?.bytes.length).toBe(0);
    expect(result?.cacheable).toBe(true);
    const again = await freshCache().getTile(key, source(render));
    expect(again?.bytes.length).toBe(0);
    expect(render).toHaveBeenCalledTimes(1);
  });

  it("serves an out-of-date version from the current version's cache, never storing under the old one", async () => {
    // key is version 3; the realm is at 5
    const render = jest.fn().mockResolvedValue(new Uint8Array([3]));
    const result = await cache.getTile(key, source(render, 5));
    expect(result).toEqual({ bytes: bytes(3), cacheable: false });
    expect(await cache.readTile(...key)).toBeNull();
    expect(
      readFileSync(path.join(root, "default", "f1", "5", "altitudes", "2", "1", "1.pbf"))
    ).toEqual(bytes(3));
    expect(readdirSync(root)).toEqual(["default"]);
    expect(readdirSync(path.join(root, "default"))).toEqual(["f1"]);
    expect(readdirSync(path.join(root, "default", "f1"))).toEqual(["5"]);
  });

  it("costs an out-of-date version's tiles a disk hit, not a render, once the current version has them", async () => {
    const render = jest.fn().mockResolvedValue(new Uint8Array([3]));
    await cache.getTile(["default", 5, "altitudes", 2, 1, 1], source(render, 5));
    expect(render).toHaveBeenCalledTimes(1);

    for (const version of [3, 4, 0]) {
      const result = await freshCache().getTile(
        ["default", version, "altitudes", 2, 1, 1],
        source(render, 5)
      );
      expect(result).toEqual({ bytes: bytes(3), cacheable: false });
    }
    expect(render).toHaveBeenCalledTimes(1);
  });

  it("renders an out-of-date tile once, however many old versions ask at once, sharing it with the current version's request", async () => {
    let release: (value: Uint8Array) => void = () => {};
    const render = jest.fn(() => new Promise<Uint8Array>((resolve) => (release = resolve)));
    const pending = [
      cache.getTile(["default", 5, "altitudes", 2, 1, 1], source(render, 5)),
      cache.getTile(["default", 4, "altitudes", 2, 1, 1], source(render, 5)),
      cache.getTile(["default", 3, "altitudes", 2, 1, 1], source(render, 5)),
    ];
    await new Promise((resolve) => setTimeout(resolve, 20));
    release(new Uint8Array([8]));
    const results = await Promise.all(pending);
    expect(render).toHaveBeenCalledTimes(1);
    expect(results.map((r) => r?.cacheable)).toEqual([true, false, false]);
    for (const r of results) expect(r?.bytes).toEqual(bytes(8));
  });

  it("still serves a tile the old version has on disk as that version's own (cacheable)", async () => {
    await cache.writeTile(...key, bytes(1, 2));
    const render = jest.fn();
    const result = await freshCache().getTile(key, source(render, 5));
    expect(result).toEqual({ bytes: bytes(1, 2), cacheable: true });
    expect(render).not.toHaveBeenCalled();
  });

  it("answers null for a version the realm has not reached, without rendering or writing", async () => {
    const render = jest.fn();
    expect(await cache.getTile(key, source(render, 2))).toBeNull();
    expect(render).not.toHaveBeenCalled();
    expect(readdirSync(root)).toEqual([]);
  });

  it("still serves the tile when the disk write fails", async () => {
    const error = jest.spyOn(console, "error").mockImplementation(() => {});
    mkdirSync(path.join(root, "default", "f1", "3", "altitudes", "2", "1", "1.pbf"), {
      recursive: true,
    });
    const render = jest.fn().mockResolvedValue(new Uint8Array([6]));
    const result = await cache.getTile(key, source(render));
    expect(result).toEqual({ bytes: bytes(6), cacheable: true });
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it("does not remember a failed render, so the next request tries again", async () => {
    const render = jest
      .fn()
      .mockRejectedValueOnce(new Error("db down"))
      .mockResolvedValue(new Uint8Array([1]));
    await expect(cache.getTile(key, source(render))).rejects.toThrow("db down");
    expect((await cache.getTile(key, source(render)))?.bytes).toEqual(bytes(1));
  });
});

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 11, 12);

/** A version folder whose `.done` marker (or, without one, the folder) was last touched `ageMs` before `at`. */
function version(realm: string, v: number, ageMs: number, marker = true, at = NOW): void {
  const dir = path.join(root, realm, "f1", String(v));
  mkdirSync(path.join(dir, "rivers", "0", "0"), { recursive: true });
  writeFileSync(path.join(dir, "rivers", "0", "0", "0.pbf"), "x");
  const stamp = new Date(at - ageMs);
  if (marker) {
    writeFileSync(path.join(dir, ".done"), "");
    utimesSync(path.join(dir, ".done"), stamp, stamp);
  }
  utimesSync(dir, stamp, stamp);
}
const versions = (realm: string) =>
  readdirSync(path.join(root, realm, "f1"))
    .map(Number)
    .sort((a, b) => a - b);

describe("removeStaleTileVersions", () => {
  it("removes a version a day after the next one was ready, and keeps the rest", async () => {
    version("default", 1, 4 * DAY);
    version("default", 2, 3 * DAY);
    version("default", 3, 2 * DAY);
    version("default", 4, 60 * 60 * 1000);
    expect(await cache.removeStaleTileVersions("default", 4, NOW)).toBe(2);
    expect(versions("default")).toEqual([3, 4]);
  });

  it("judges the newest old version by its own age when the current one has no folder yet", async () => {
    version("default", 1, 5 * DAY);
    version("default", 2, 2 * DAY);
    expect(await cache.removeStaleTileVersions("default", 3, NOW)).toBe(2);
    expect(existsSync(path.join(root, "default"))).toBe(true);
    version("default", 4, 60 * 60 * 1000);
    expect(await cache.removeStaleTileVersions("default", 5, NOW)).toBe(0);
    expect(versions("default")).toEqual([4]);
  });

  it("uses the folder's own time when a version never got its marker", async () => {
    version("default", 1, 3 * DAY);
    version("default", 2, 2 * DAY, false);
    expect(await cache.removeStaleTileVersions("default", 2, NOW)).toBe(1);
    expect(versions("default")).toEqual([2]);
  });

  it("never removes the current version or newer ones, nor touches other realms or other files", async () => {
    version("default", 3, 9 * DAY);
    version("default", 6, 9 * DAY);
    version("r_other", 1, 9 * DAY);
    writeFileSync(path.join(root, "default", "f1", "notes.txt"), "keep");
    expect(await cache.removeStaleTileVersions("default", 3, NOW)).toBe(0);
    expect(versions("r_other")).toEqual([1]);
    expect(existsSync(path.join(root, "default", "f1", "notes.txt"))).toBe(true);
    expect(existsSync(path.join(root, "default", "f1", "6"))).toBe(true);
  });

  it("counts nothing for a realm with no folder", async () => {
    expect(await cache.removeStaleTileVersions("r_none", 2, NOW)).toBe(0);
  });
});

describe("removeStaleTileVersions and other tile formats", () => {
  const format = (realm: string, n: number, ageMs: number) => {
    const dir = path.join(root, realm, `f${n}`, "3", "rivers", "0", "0");
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "0.pbf"), "x");
    const stamp = new Date(NOW - ageMs);
    utimesSync(path.join(root, realm, `f${n}`), stamp, stamp);
  };

  it("removes the folder of another format once it is more than a day old, and keeps a younger one", async () => {
    version("default", 2, 60 * 60 * 1000);
    format("default", 0, 3 * DAY);
    format("default", 9, 60 * 60 * 1000);
    expect(await cache.removeStaleTileVersions("default", 2, NOW)).toBe(1);
    expect(readdirSync(path.join(root, "default")).sort()).toEqual(["f1", "f9"]);
  });

  it("never removes the current format's folder, whatever its age, nor files and folders that are not formats", async () => {
    version("default", 2, 9 * DAY);
    mkdirSync(path.join(root, "default", "notes"), { recursive: true });
    writeFileSync(path.join(root, "default", "f1x"), "keep");
    expect(await cache.removeStaleTileVersions("default", 2, NOW)).toBe(0);
    expect(readdirSync(path.join(root, "default")).sort()).toEqual(["f1", "f1x", "notes"]);
  });
});

describe("sweepStaleTileVersions (the web process's own cleanup, when no cron job runs)", () => {
  const HOUR = 60 * 60 * 1000;

  it("removes the realm's outlived versions, never the current one", async () => {
    version("default", 1, 4 * DAY);
    version("default", 2, 3 * DAY);
    version("default", 3, 2 * DAY);
    version("default", 4, HOUR);
    expect(await cache.sweepStaleTileVersions("default", 4, NOW)).toBe(2);
    expect(versions("default")).toEqual([3, 4]);
  });

  it("runs at most once an hour per realm", async () => {
    for (const realm of ["default", "r_other"]) {
      version(realm, 1, 4 * DAY);
      version(realm, 2, 2 * DAY);
      version(realm, 3, HOUR);
    }
    expect(await cache.sweepStaleTileVersions("default", 3, NOW)).toBe(1);

    version("default", 0, 9 * DAY);
    expect(await cache.sweepStaleTileVersions("default", 3, NOW + 59 * 60 * 1000)).toBeNull();
    expect(versions("default")).toEqual([0, 2, 3]);
    // another realm has its own hour
    expect(await cache.sweepStaleTileVersions("r_other", 3, NOW + 59 * 60 * 1000)).toBe(1);

    expect(await cache.sweepStaleTileVersions("default", 3, NOW + 61 * 60 * 1000)).toBe(1);
    expect(versions("default")).toEqual([2, 3]);
  });

  it("never reaches outside the cache root", async () => {
    mkdirSync(path.join(root, "..", "map-tiles-escape-check", "f1", "1"), { recursive: true });
    expect(await cache.sweepStaleTileVersions("../map-tiles-escape-check", 2, NOW)).toBe(0);
    expect(existsSync(path.join(root, "..", "map-tiles-escape-check", "f1", "1"))).toBe(true);
    rmSync(path.join(root, "..", "map-tiles-escape-check"), { recursive: true, force: true });
  });

  it("is started by a tile the web process renders, in the background", async () => {
    const now = Date.now();
    version("default", 1, 4 * DAY, true, now);
    version("default", 2, 3 * DAY, true, now);
    const render = jest.fn().mockResolvedValue(bytes(7));
    const result = await cache.getTile(["default", 3, "altitudes", 2, 1, 1], {
      render,
      currentVersion: jest.fn().mockResolvedValue(3),
    });
    expect(result?.bytes).toEqual(bytes(7));
    for (let i = 0; i < 100 && versions("default").length > 2; i++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    // version 1 is outlived (version 2 was ready 3 days ago); version 2 waits a day after version 3's first tile
    expect(versions("default")).toEqual([2, 3]);
  });

  it("is not started by a tile served from the cache", async () => {
    const now = Date.now();
    version("default", 1, 4 * DAY, true, now);
    await cache.writeTile("default", 3, "altitudes", 2, 1, 1, bytes(7));
    await cache.getTile(["default", 3, "altitudes", 2, 1, 1], {
      render: jest.fn(),
      currentVersion: jest.fn().mockResolvedValue(3),
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(versions("default")).toEqual([1, 3]);
  });
});

describe("version markers", () => {
  it("marks a version done and reads the marker back, per realm and version", async () => {
    expect(await cache.isTileVersionDone("default", 2)).toBe(false);
    await cache.markTileVersionDone("default", 2);
    expect(await cache.isTileVersionDone("default", 2)).toBe(true);
    expect(await cache.isTileVersionDone("default", 3)).toBe(false);
    expect(await cache.isTileVersionDone("r_other", 2)).toBe(false);
    expect(existsSync(path.join(root, "default", "f1", "2", ".done"))).toBe(true);
  });
});
