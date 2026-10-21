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
});

describe("getTile", () => {
  const key = ["default", 3, "altitudes", 2, 1, 1] as const;
  const source = (render: jest.Mock, current = 3) => ({
    render,
    currentVersion: jest.fn().mockResolvedValue(current),
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
});

describe("removeStaleTileVersions and other tile formats", () => {
  it("never removes the current format's folder, whatever its age, nor files and folders that are not formats", async () => {
    version("default", 2, 9 * DAY);
    mkdirSync(path.join(root, "default", "notes"), { recursive: true });
    writeFileSync(path.join(root, "default", "f1x"), "keep");
    expect(await cache.removeStaleTileVersions("default", 2, NOW)).toBe(0);
    expect(readdirSync(path.join(root, "default")).sort()).toEqual(["f1", "f1x", "notes"]);
  });
});

describe("sweepStaleTileVersions (the web process's own cleanup, when no cron job runs)", () => {
  it("never reaches outside the cache root", async () => {
    mkdirSync(path.join(root, "..", "map-tiles-escape-check", "f1", "1"), { recursive: true });
    expect(await cache.sweepStaleTileVersions("../map-tiles-escape-check", 2, NOW)).toBe(0);
    expect(existsSync(path.join(root, "..", "map-tiles-escape-check", "f1", "1"))).toBe(true);
    rmSync(path.join(root, "..", "map-tiles-escape-check"), { recursive: true, force: true });
  });
});
