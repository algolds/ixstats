/** @jest-environment node */
/**
 * Map tiles from the URL to the disk (Atlas R0): the vector tile route
 * (`/api/map-tiles/<realm>/<version>/f<format>/<layer>/<z>/<x>/<y>`), its disk cache
 * `<MAP_TILE_DIR>/<realmId>/f<format>/<version>/<layer>/<z>/<x>/<y>.pbf` (every segment checked, written atomically,
 * one render shared by concurrent requests), the `map-tiles` cron job that renders a published realm's low zooms once
 * per version, and the map bundle reads, which follow the realm's map version. The tile SQL, the database and Clerk
 * are faked; the disk cache is a temp folder.
 *
 * Folds: src/tests/app/api/map-tiles/route.test.ts, src/tests/server/maps/tile-prerender.test.ts,
 * src/tests/server/geo/map-bundle.test.ts
 */
// `jest` is the injected global on purpose: @swc/jest only hoists jest.mock() on the global.
jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" } }));
const auth = jest.fn().mockResolvedValue({ userId: null });
jest.mock("@clerk/nextjs/server", () => ({ auth: () => auth() }));
const realmFind = jest.fn();
const userFind = jest.fn().mockResolvedValue(null);
jest.mock("~/server/db", () => ({
  db: {
    realm: { findUnique: (a: unknown) => realmFind(a) },
    user: { findUnique: (a: unknown) => userFind(a) },
  },
}));
const buildTile = jest.fn();
jest.mock("~/server/modules/maps/tile-render", () => ({
  buildTile: (...a: unknown[]) => buildTile(...a),
}));

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
import { NextRequest } from "next/server";
import { GET } from "~/app/api/map-tiles/[realm]/[version]/[format]/[layer]/[z]/[x]/[y]/route";
import { runMapTilePrerender } from "~/server/modules/maps/tile-prerender";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";
import { GEO_FEATURE_INVALIDATE_KEYS, clearTrpcMemoryCache } from "~/lib/cache/trpc-cache";
import { worldMapProcedures } from "~/server/api/routers/geo/core/world-map";
import { borderHistoryProcedures } from "~/server/api/routers/geo/core/border-history";
import { MAP_TRPC_KEYS } from "~/server/shared/map-invalidation";

type TileCache = typeof import("~/server/modules/maps/tile-cache");

const IMMUTABLE = "public, max-age=31536000, immutable";
const PRIVATE = "private, no-store";
const DAY = 24 * 60 * 60 * 1000;

interface RealmRow {
  id: string;
  slug: string;
  status: string;
  ownerId: string;
  mapVersion: number;
}
const table: RealmRow[] = [
  { id: "default", slug: "ixworld", status: "active", ownerId: "system", mapVersion: 3 },
  { id: "r_eurth", slug: "eurth", status: "active", ownerId: "clerk_owner", mapVersion: 2 },
];

const bytes = (...values: number[]) => Buffer.from(values);
const body = async (res: Response) => new Uint8Array(await res.arrayBuffer());

/** A new tile cache module: empty memory LRU and no renders in flight, as in a fresh process. */
function freshCache(): TileCache {
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("~/server/modules/maps/tile-cache") as TileCache;
}

type Getter = (
  realm: string,
  version: string,
  layer: string,
  z: string,
  x: string,
  y: string,
  /** The URL's tile format segment; the build's own (`f1`) unless a test asks for another. */
  format?: string
) => Promise<Response>;

const getter =
  (handler: typeof GET): Getter =>
  (realm, version, layer, z, x, y, format = "f1") =>
    handler(
      new NextRequest(
        `http://localhost/api/map-tiles/${realm}/${version}/${format}/${layer}/${z}/${x}/${y}`
      ),
      { params: Promise.resolve({ realm, version, format, layer, z, x, y }) }
    );

const get = getter(GET);

/** The route loaded in a fresh module registry (empty memos and tile LRU), as a new process would have it. */
function freshGet(): Getter {
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const route =
    require("~/app/api/map-tiles/[realm]/[version]/[format]/[layer]/[z]/[x]/[y]/route") as {
      GET: typeof GET;
    };
  return getter(route.GET);
}

let root: string;
beforeEach(() => {
  jest.clearAllMocks();
  root = mkdtempSync(path.join(tmpdir(), "map-tiles-"));
  process.env.MAP_TILE_DIR = root;
  realmFind.mockImplementation(
    async ({ where, select }: { where: { id?: string; slug?: string }; select: object }) => {
      const row = table.find((r) =>
        where.id !== undefined ? r.id === where.id : r.slug === where.slug
      );
      if (!row) return null;
      return "mapVersion" in select
        ? { mapVersion: row.mapVersion }
        : { id: row.id, status: row.status, ownerId: row.ownerId };
    }
  );
  buildTile.mockResolvedValue(new Uint8Array([1, 2, 3]));
  auth.mockResolvedValue({ userId: null });
  userFind.mockResolvedValue(null);
});
afterEach(() => {
  jest.restoreAllMocks();
  rmSync(root, { recursive: true, force: true });
  delete process.env.MAP_TILE_DIR;
});

describe("the tile disk cache", () => {
  it("stores a tile under <realmId>/f<format>/<version>/<layer>/<z>/<x>/<y>.pbf, which no other key reads", async () => {
    const cache = freshCache();
    await cache.writeTile("r_eurth", 7, "rivers", 2, 1, 3, bytes(1, 2, 3));
    expect(
      readFileSync(path.join(root, "r_eurth", "f1", "7", "rivers", "2", "1", "3.pbf"))
    ).toEqual(bytes(1, 2, 3));
    expect(await cache.readTile("r_eurth", 7, "rivers", 2, 1, 3)).toEqual(bytes(1, 2, 3));
    // Another realm, version, layer or tile is another key
    expect(await cache.readTile("r_other", 7, "rivers", 2, 1, 3)).toBeNull();
    expect(await cache.readTile("r_eurth", 8, "rivers", 2, 1, 3)).toBeNull();
    expect(await cache.readTile("r_eurth", 7, "lakes", 2, 1, 3)).toBeNull();
    expect(await cache.readTile("r_eurth", 7, "rivers", 2, 1, 2)).toBeNull();
  });

  it("leaves neither a partial tile nor a temporary file when a write fails", async () => {
    const cache = freshCache();
    // A directory where the tile file belongs makes the final rename fail
    mkdirSync(path.join(root, "default", "f1", "1", "rivers", "3", "2", "5.pbf"), {
      recursive: true,
    });
    await expect(cache.writeTile("default", 1, "rivers", 3, 2, 5, bytes(1))).rejects.toThrow();
    expect(readdirSync(path.join(root, "default", "f1", "1", "rivers", "3", "2"))).toEqual([
      "5.pbf",
    ]);
  });

  it("never reads, writes or cleans up outside the root for a realm id that is a path", async () => {
    const cache = freshCache();
    // An old version folder beside the cache root, where `../<name>` points: a day-old outlived version if reached
    const outside = mkdtempSync(path.join(tmpdir(), "map-tiles-outside-"));
    const escape = `../${path.basename(outside)}`;
    mkdirSync(path.join(outside, "f1", "1", "rivers", "0", "0"), { recursive: true });
    try {
      expect(await cache.readTile(escape, 1, "rivers", 0, 0, 0)).toBeNull();
      await expect(cache.writeTile(escape, 1, "rivers", 0, 0, 0, bytes(1))).rejects.toThrow(
        /invalid tile/
      );
      expect(await cache.sweepStaleTileVersions(escape, 2, Date.now() + 9 * DAY)).toBe(0);
      expect(readdirSync(root)).toEqual([]);
      expect(existsSync(path.join(outside, "f1", "1", "rivers", "0", "0"))).toBe(true);
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it("keeps another tile format in another folder: its tiles are never read, nor overwritten", async () => {
    const cache = freshCache();
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

  it("shares one render between concurrent requests for the same tile", async () => {
    const cache = freshCache();
    let release: (value: Uint8Array) => void = () => {};
    const render = jest.fn(() => new Promise<Uint8Array>((resolve) => (release = resolve)));
    const source = { render, currentVersion: jest.fn().mockResolvedValue(3) };
    const pending = [1, 2, 3, 4].map(() =>
      cache.getTile(["default", 3, "altitudes", 2, 1, 1], source)
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    release(new Uint8Array([4, 2]));
    const results = await Promise.all(pending);
    expect(render).toHaveBeenCalledTimes(1);
    expect(results.map((r) => r?.bytes)).toEqual([1, 2, 3, 4].map(() => bytes(4, 2)));
  });

  it("sweeps a realm's version a day after the next one was ready, never the current or a newer one, another realm's, the current format's folder or files that are not versions", async () => {
    const cache = freshCache();
    const NOW = Date.UTC(2026, 9, 11, 12);
    /** A version folder whose `.done` marker was written `ageMs` before NOW. */
    const version = (realm: string, v: number, ageMs: number) => {
      const dir = path.join(root, realm, "f1", String(v));
      mkdirSync(path.join(dir, "rivers", "0", "0"), { recursive: true });
      writeFileSync(path.join(dir, "rivers", "0", "0", "0.pbf"), "x");
      writeFileSync(path.join(dir, ".done"), "");
      const stamp = new Date(NOW - ageMs);
      utimesSync(path.join(dir, ".done"), stamp, stamp);
    };
    const versions = (realm: string) =>
      readdirSync(path.join(root, realm, "f1"))
        .filter((name) => /^\d+$/.test(name))
        .map(Number)
        .sort((a, b) => a - b);
    // Ixnay at version 4: 1, 2 and 3 were each followed by a newer version, 4 only an hour ago; 6 is newer than 4
    version("default", 1, 4 * DAY);
    version("default", 2, 3 * DAY);
    version("default", 3, 2 * DAY);
    version("default", 4, 60 * 60 * 1000);
    version("default", 6, 9 * DAY);
    version("r_other", 1, 9 * DAY);
    writeFileSync(path.join(root, "default", "f1", "notes.txt"), "keep");
    mkdirSync(path.join(root, "default", "notes"));
    writeFileSync(path.join(root, "default", "f1x"), "keep");

    expect(await cache.sweepStaleTileVersions("default", 4, NOW)).toBe(2);

    expect(versions("default")).toEqual([3, 4, 6]);
    expect(versions("r_other")).toEqual([1]);
    expect(existsSync(path.join(root, "default", "f1", "notes.txt"))).toBe(true);
    expect(readdirSync(path.join(root, "default")).sort()).toEqual(["f1", "f1x", "notes"]);
  });
});

describe("GET /api/map-tiles/<realm>/<version>/<format>/<layer>/<z>/<x>/<y>", () => {
  it("serves a realm by id, slug or one of Ixnay's names from one cache: rendered once, stored, then immutable by id", async () => {
    const run = freshGet();
    expect((await run("default", "3", "lakes", "0", "0", "0")).status).toBe(200);
    expect(existsSync(path.join(root, "default", "f1", "3", "lakes", "0", "0", "0.pbf"))).toBe(
      true
    );
    expect((await run("ixnay", "3", "lakes", "0", "0", "0")).status).toBe(200);
    expect((await run("ixworld", "3", "lakes", "0", "0", "0")).status).toBe(200);
    const again = await run("default", "3", "lakes", "0", "0", "0");
    expect(await body(again)).toEqual(new Uint8Array([1, 2, 3]));
    expect(again.headers.get("cache-control")).toBe(IMMUTABLE);
    expect(buildTile.mock.calls).toEqual([[expect.anything(), "default", "lakes", 0, 0, 0]]);

    // Another realm, by id and by slug: one render of its own
    const byId = await run("r_eurth", "2", "lakes", "0", "0", "0");
    const bySlug = await run("eurth", "2", "lakes", "0", "0", "0");
    expect([byId.status, bySlug.status]).toEqual([200, 200]);
    expect(buildTile).toHaveBeenLastCalledWith(expect.anything(), "r_eurth", "lakes", 0, 0, 0);
    expect(buildTile).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["a layer the tiles do not draw", "climate", "2", "0"],
    ["a column outside the zoom", "rivers", "2", "4"],
  ])("404s on %s without a lookup or a render", async (_name, layer, z, x) => {
    const res = await get("default", "3", layer, z, x, "0");
    expect(res.status).toBe(404);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(buildTile).not.toHaveBeenCalled();
    expect(realmFind).not.toHaveBeenCalled();
  });

  it("answers a URL of another tile format with this build's tiles, but never as that URL's immutable copy", async () => {
    const run = freshGet();
    for (const format of ["f0", "f2"]) {
      const res = await run("default", "3", "rivers", "1", "0", "0", format);
      expect([format, res.status, res.headers.get("cache-control"), await body(res)]).toEqual([
        format,
        200,
        PRIVATE,
        new Uint8Array([1, 2, 3]),
      ]);
    }
    // The tile itself is stored once, under this build's format, and is immutable at its own URL
    expect(readdirSync(path.join(root, "default"))).toEqual(["f1"]);
    expect(buildTile).toHaveBeenCalledTimes(1);
    expect((await run("default", "3", "rivers", "1", "0", "0")).headers.get("cache-control")).toBe(
      IMMUTABLE
    );
  });

  it("answers an out-of-date version from the current version's cache, uncacheable, rendering once", async () => {
    const run = freshGet();
    for (const version of ["1", "0", "1"]) {
      const res = await run("r_eurth", version, "lakes", "0", "0", "0");
      expect([version, res.status, res.headers.get("cache-control"), await body(res)]).toEqual([
        version,
        200,
        PRIVATE,
        new Uint8Array([1, 2, 3]),
      ]);
    }
    expect(buildTile).toHaveBeenCalledTimes(1);
    // Stored under the current version only, never under the old one
    expect(readdirSync(path.join(root, "r_eurth", "f1"))).toEqual(["2"]);
    expect(existsSync(path.join(root, "r_eurth", "f1", "2", "lakes", "0", "0", "0.pbf"))).toBe(
      true
    );
    // The current version's own URL is then a hit, and immutable
    const current = await run("r_eurth", "2", "lakes", "0", "0", "0");
    expect(current.headers.get("cache-control")).toBe(IMMUTABLE);
    expect(buildTile).toHaveBeenCalledTimes(1);
  });

  it("404s on a version the realm has not reached, rendering and writing nothing", async () => {
    const res = await get("r_eurth", "9", "lakes", "0", "0", "0");
    expect(res.status).toBe(404);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(buildTile).not.toHaveBeenCalled();
    expect(readdirSync(root)).toEqual([]);
  });

  it("answers 500 when the tile query fails, uncached, and tries again next time", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    buildTile.mockRejectedValueOnce(new Error("db down"));
    const run = freshGet();
    const failed = await run("default", "3", "rivers", "0", "0", "0");
    expect(failed.status).toBe(500);
    expect(failed.headers.get("cache-control")).toBe("no-store");
    expect((await run("default", "3", "rivers", "0", "0", "0")).status).toBe(200);
    expect(buildTile).toHaveBeenCalledTimes(2);
  });
});

describe("runMapTilePrerender (the map-tiles cron job)", () => {
  interface Realm {
    id: string;
    status: string;
    mapVersion: number;
    isSystem?: boolean;
  }
  /** 3 layers x (1 + 4 + 16 + 64) tiles */
  const LOW_ZOOM_TILES = 3 * 85;
  const IXNAY: Realm = { id: "default", status: "active", mapVersion: 4 };
  const done = (realm: string, version: number) =>
    existsSync(path.join(root, realm, "f1", String(version), ".done"));

  /** A database holding `realms`, answering the job's realm query as Postgres would. */
  function fakeDb(realms: Realm[]): never {
    const findMany = jest.fn(async ({ where }: { where: { isSystem?: boolean } }) =>
      realms.filter((r) => where.isSystem === undefined || (r.isSystem ?? false) === where.isSystem)
    );
    return { realm: { findMany }, $queryRawUnsafe: jest.fn() } as never;
  }

  beforeEach(() => {
    jest.spyOn(console, "info").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  it("renders each published realm's version once, and never a system or unpublished realm's", async () => {
    const db = fakeDb([
      IXNAY,
      { id: "r_live", status: "active", mapVersion: 1 },
      { id: "r_old", status: "archived", mapVersion: 1 },
      { id: "r_draft", status: "draft", mapVersion: 1 },
      { id: "r_gen", status: "generating", mapVersion: 1 },
      { id: "r_system", status: "active", mapVersion: 1, isSystem: true },
    ]);
    await runMapTilePrerender(db);
    expect(new Set(buildTile.mock.calls.map(([, realm]) => realm))).toEqual(
      new Set(["default", "r_live", "r_old"])
    );
    expect(readdirSync(root).sort()).toEqual(["default", "r_live", "r_old"]);
    expect([done("default", 4), done("r_live", 1), done("r_old", 1)]).toEqual([true, true, true]);

    // A second run finds the markers and renders nothing
    buildTile.mockClear();
    expect(await runMapTilePrerender(db)).toMatchObject({ rendered: 0, versionsCompleted: 0 });
    expect(buildTile).not.toHaveBeenCalled();
  });

  it("carries on after a tile fails: the others are stored, the version is not marked, and the next run finishes it", async () => {
    buildTile.mockImplementation(
      async (_db, _realm, layer: string, z: number, x: number, y: number) => {
        if (layer === "rivers" && z === 2 && x === 1 && y === 1) throw new Error("db down");
        return new Uint8Array([2]);
      }
    );
    const first = await runMapTilePrerender(fakeDb([IXNAY]));
    expect(first).toMatchObject({ rendered: LOW_ZOOM_TILES - 1, failed: 1, versionsCompleted: 0 });
    expect(done("default", 4)).toBe(false);

    buildTile.mockClear();
    buildTile.mockResolvedValue(new Uint8Array([2]));
    const second = await runMapTilePrerender(fakeDb([IXNAY]));
    // Only the failed tile is rendered again
    expect(buildTile).toHaveBeenCalledTimes(1);
    expect(second).toMatchObject({ rendered: 1, failed: 0, versionsCompleted: 1 });
    expect(done("default", 4)).toBe(true);
  });

  it("stops between tiles when the budget is spent, without marking the version, and continues next run", async () => {
    let clock = 0;
    buildTile.mockImplementation(async () => {
      clock += 100;
      return new Uint8Array([1]);
    });
    const first = await runMapTilePrerender(fakeDb([IXNAY]), { budgetMs: 1_000, now: () => clock });
    expect(first).toMatchObject({ rendered: 10, versionsCompleted: 0 });
    expect(done("default", 4)).toBe(false);

    clock = 0;
    buildTile.mockClear();
    await runMapTilePrerender(fakeDb([IXNAY]), { budgetMs: 1_000_000, now: () => clock });
    expect(buildTile).toHaveBeenCalledTimes(LOW_ZOOM_TILES - 10);
    expect(done("default", 4)).toBe(true);
  });
});

describe("the map bundle reads", () => {
  type ModelMock = Record<string, jest.Mock>;

  /** Every model answers empty unless overridden. */
  function dbWith(overrides: Record<string, Partial<ModelMock>> = {}) {
    const models = new Map<string, ModelMock>();
    return new Proxy({} as Record<string, ModelMock>, {
      get: (_target, name) => {
        const key = String(name);
        if (!models.has(key)) {
          models.set(key, {
            findMany: jest.fn().mockResolvedValue([]),
            findUnique: jest.fn().mockResolvedValue(null),
            findFirst: jest.fn().mockResolvedValue(null),
            ...overrides[key],
          });
        }
        return models.get(key);
      },
    });
  }

  const caller = createCallerFactory(createTRPCRouter(worldMapProcedures));
  const ctxFor = (db: unknown) =>
    ({ db, user: null, auth: null, rateLimitIdentifier: "test", headers: new Headers() }) as never;

  beforeEach(() => {
    clearTrpcMemoryCache();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  it("takes the realm's map version as part of the markers' input: a moved version reads the database again", async () => {
    const capitals = jest.fn().mockResolvedValue([]);
    const db = dbWith({ city: { findMany: capitals } });

    await caller(ctxFor(db)).getMapBundleMarkers({ version: 1 });
    await caller(ctxFor(db)).getMapBundleMarkers({ version: 1 });
    expect(capitals).toHaveBeenCalledTimes(1);

    await caller(ctxFor(db)).getMapBundleMarkers({ version: 2 });
    expect(capitals).toHaveBeenCalledTimes(2);
  });

  it("drops the cached map procedures on a map change by their exact paths, all of which exist", () => {
    const live = new Set(
      [...Object.keys(worldMapProcedures), ...Object.keys(borderHistoryProcedures)].map(
        (name) => `geoCore.${name}`
      )
    );
    const bundle = [
      "geoCore.getMapBundleMarkers",
      "geoCore.getMapBundleDetail",
      "geoCore.getWorldMapAsOf",
    ];
    expect(bundle.filter((key) => !live.has(key))).toEqual([]);
    expect(bundle.filter((key) => !MAP_TRPC_KEYS.includes(key))).toEqual([]);
    expect(bundle.filter((key) => !GEO_FEATURE_INVALIDATE_KEYS.includes(key))).toEqual([]);
  });
});
