/** @jest-environment node */
/**
 * A realm's map layers as the browser downloads them: the versioned layer route
 * (`/api/map-layers/<realm>/<version>/<layer>?bucket=&format=`), the packed layer cache behind it (layer-delivery.ts:
 * one build per realm, map version, loader format, layer and bucket, shared by concurrent requests, dropped by a map
 * change and never kept when it fails), and the layer loader under that (layer-loader.ts: the realm's rows simplified
 * as one PostGIS coverage where it can, per polygon from the stored GeoJSON where it cannot, split at ±180, cached per
 * map version). The database and Clerk are faked, and so is the loader for the route and the cache; the map version,
 * its memo and the invalidation are real.
 *
 * Folds: src/tests/server/maps/layer-delivery.test.ts, src/tests/server/maps/layer-loader-dedup.test.ts,
 * src/tests/server/maps/layer-loader-simplify.test.ts, src/tests/server/maps/coverage-simplify.test.ts
 */
// `jest` is the injected global on purpose: @swc/jest only hoists jest.mock() on the global.
const auth = jest.fn().mockResolvedValue({ userId: null });
jest.mock("@clerk/nextjs/server", () => ({ auth: () => auth() }));
const realmFindUnique = jest.fn();
const userFind = jest.fn().mockResolvedValue(null);
jest.mock("~/server/db", () => ({
  db: {
    realm: { findUnique: (a: unknown) => realmFindUnique(a) },
    user: { findUnique: (a: unknown) => userFind(a) },
  },
}));
jest.mock("~/lib/cache", () => ({
  ...jest.requireActual("~/lib/cache"),
  invalidateCache: jest.fn().mockResolvedValue(undefined),
}));
// A getter, so a test can move the loader's output format between requests
let mockFormat = 1;
jest.mock("~/lib/maps/layer-format", () => ({
  get LAYER_FORMAT_VERSION() {
    return mockFormat;
  },
}));
// The route and the packed cache build from a fake loader; the loader's own tests use the real one
type LoadLayer = typeof import("~/server/modules/maps/layer-loader").loadLayerWithFallback;
const mockLoader = jest.fn<ReturnType<LoadLayer>, Parameters<LoadLayer>>();
jest.mock("~/server/modules/maps/layer-loader", () => ({
  ...jest.requireActual("~/server/modules/maps/layer-loader"),
  loadLayerWithFallback: (...a: Parameters<LoadLayer>) => mockLoader(...a),
}));

import type { FeatureCollection, Geometry, Polygon, Position } from "geojson";
import { NextRequest } from "next/server";
import { GET } from "~/app/api/map-layers/[realm]/[version]/[layer]/route";
import { type PackedFeatureCollection } from "~/lib/maps/geojson-pack";
import { getPackedLayer } from "~/server/modules/maps/layer-delivery";
import { loadLayerFromDB } from "~/server/modules/maps/layer-loader";
import { clearLayerCache } from "~/server/shared/layer-cache";
import { invalidateAllRealmMaps, invalidateRealmMap } from "~/server/shared/map-invalidation";

const IMMUTABLE = "public, max-age=31536000, immutable";
const REVALIDATE = "public, no-cache";
const PRIVATE = "private, no-store";

const square = (x: number, y = 0): Polygon => ({
  type: "Polygon",
  coordinates: [
    [
      [x, y],
      [x + 1, y],
      [x + 1, y + 1],
      [x, y + 1],
      [x, y],
    ],
  ],
});

/** The layer the fake loader builds at a map version: one square whose id names the version. */
const layerAt = (version: number): FeatureCollection => ({
  type: "FeatureCollection",
  features: [{ type: "Feature", properties: { _id: `sq${version}` }, geometry: square(version) }],
});

const parse = (body: string) => JSON.parse(body) as PackedFeatureCollection;

/** The realm the route's database holds (null: none), and its map version. */
let realmRow: { id: string; status: string; ownerId: string } | null;
let mapVersion: number;

beforeEach(async () => {
  jest.clearAllMocks();
  mockFormat = 1;
  mapVersion = 3;
  realmRow = { id: "r_eurth", status: "active", ownerId: "clerk_owner" };
  realmFindUnique.mockImplementation(async ({ select }: { select: object }) => {
    if (!realmRow) return null;
    return "mapVersion" in select ? { mapVersion } : realmRow;
  });
  auth.mockResolvedValue({ userId: null });
  userFind.mockResolvedValue(null);
  mockLoader.mockImplementation(async (_db, _layer, _bucket, _realm, version) =>
    layerAt(version ?? 0)
  );
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
  // Every realm's packed copies, memoised versions and realm rows go, as a fresh process has none
  await invalidateAllRealmMaps({ $executeRaw: jest.fn() } as never);
});
afterEach(() => jest.restoreAllMocks());

describe("GET /api/map-layers", () => {
  const getRaw = (
    realm: string,
    version: string,
    layer: string,
    query = "",
    headers: Record<string, string> = {}
  ) =>
    GET(
      new NextRequest(`http://localhost/api/map-layers/${realm}/${version}/${layer}${query}`, {
        headers,
      }),
      {
        params: Promise.resolve({ realm, version, layer }),
      }
    );

  /** A request as the client sends it: the URL names the loader format of the build it came from. */
  const get = (
    realm: string,
    version: string,
    layer: string,
    query = "",
    headers: Record<string, string> = {}
  ) => {
    const withFormat = query.includes("format=")
      ? query
      : `${query ? `${query}&` : "?"}format=${mockFormat}`;
    return getRaw(realm, version, layer, withFormat, headers);
  };

  it("revalidates by tag: 304 without building to an If-None-Match listing the current tag (weak too), the layer to an old tag", async () => {
    const tag = '"default-3-f1-political-1"';
    const exact = await get("default", "3", "political", "?bucket=1", { "if-none-match": tag });
    expect([exact.status, exact.headers.get("etag"), exact.headers.get("cache-control")]).toEqual([
      304,
      tag,
      IMMUTABLE,
    ]);
    const listed = await get("default", "3", "political", "?bucket=1", {
      "if-none-match": `W/"nope", W/${tag}`,
    });
    expect(listed.status).toBe(304);
    expect(mockLoader).not.toHaveBeenCalled();

    const old = await get("default", "3", "political", "?bucket=1", {
      "if-none-match": '"default-2-f1-political-1", W/"other"',
    });
    expect(old.status).toBe(200);
    expect(mockLoader).toHaveBeenCalledTimes(1);
  });

  it("serves the current data, tagged with the current version, to a URL naming an older or a newer one, never as immutable", async () => {
    mapVersion = 5;
    const older = await get("default", "3", "political");
    expect([older.status, older.headers.get("etag"), older.headers.get("cache-control")]).toEqual([
      200,
      '"default-5-f1-political-1"',
      REVALIDATE,
    ]);
    expect(mockLoader).toHaveBeenCalledWith(expect.anything(), "political", 1, "default", 5);
    expect(parse(await older.text()).features[0]?.properties?._id).toBe("sq5");

    const newer = await get("default", "7", "political");
    expect([newer.headers.get("etag"), newer.headers.get("cache-control")]).toEqual([
      '"default-5-f1-political-1"',
      REVALIDATE,
    ]);
  });

  it("names the loader format in the tag and the URL: after a deploy that changes it, an old tag gets the new build and another format's URL stays out of the one-year cache", async () => {
    expect((await get("default", "3", "political")).headers.get("etag")).toBe(
      '"default-3-f1-political-1"'
    );
    mockFormat = 2;
    const oldTag = await get("default", "3", "political", "?bucket=1", {
      "if-none-match": '"default-3-f1-political-1"',
    });
    expect([oldTag.status, oldTag.headers.get("etag")]).toEqual([
      200,
      '"default-3-f2-political-1"',
    ]);
    for (const query of ["?bucket=1&format=1", "?bucket=1", "?bucket=1&format=x"]) {
      const res = await getRaw("default", "3", "political", query);
      expect([
        query,
        res.status,
        res.headers.get("cache-control"),
        res.headers.get("etag"),
      ]).toEqual([query, 200, REVALIDATE, '"default-3-f2-political-1"']);
    }
    const current = await getRaw("default", "3", "political", "?bucket=1&format=2");
    expect(current.headers.get("cache-control")).toBe(IMMUTABLE);
    // One build per format: the new build's layer is never the old build's copy
    expect(mockLoader).toHaveBeenCalledTimes(2);
  });

  it("hides an unpublished realm's layer from a stranger, and serves it to site staff, never stored", async () => {
    realmRow = { id: "r_eurth", status: "draft", ownerId: "clerk_owner" };
    auth.mockResolvedValue({ userId: "clerk_other" });
    userFind.mockResolvedValue({
      id: "u2",
      clerkUserId: "clerk_other",
      role: { name: "user", level: 100 },
    });
    const stranger = await get("eurth", "3", "political");
    expect([stranger.status, stranger.headers.get("cache-control")]).toEqual([404, PRIVATE]);
    expect(mockLoader).not.toHaveBeenCalled();

    auth.mockResolvedValue({ userId: "clerk_admin" });
    userFind.mockResolvedValue({
      id: "u3",
      clerkUserId: "clerk_admin",
      role: { name: "admin", level: 10 },
    });
    const staff = await get("eurth", "3", "political");
    expect([staff.status, staff.headers.get("cache-control"), staff.headers.get("etag")]).toEqual([
      200,
      PRIVATE,
      null,
    ]);
  });

  it.each([
    ["a layer that is a path", "..%2Fpolitical", "", 404, PRIVATE],
    ["a bucket outside 0-2", "political", "?bucket=3", 400, "no-store"],
  ])("refuses %s, uncached, without building", async (_name, layer, query, status, cache) => {
    const res = await get("default", "3", layer, query);
    expect([res.status, res.headers.get("cache-control")]).toEqual([status, cache]);
    expect(mockLoader).not.toHaveBeenCalled();
  });

  it("answers 500, uncached, when the layer cannot be built, and builds it on the next request", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    mockLoader.mockRejectedValueOnce(new Error("db down"));
    const failed = await get("default", "3", "political");
    expect([failed.status, failed.headers.get("cache-control")]).toEqual([500, "no-store"]);
    expect((await get("default", "3", "political")).status).toBe(200);
    expect(mockLoader).toHaveBeenCalledTimes(2);
  });
});

describe("the packed layer cache (getPackedLayer)", () => {
  /** A db whose realms sit at `versions` (realm id to map version); every bump goes through `$queryRaw`. */
  function dbAt(versions: Record<string, number>): never {
    return {
      realm: {
        findUnique: jest.fn(({ where }: { where: { id: string } }) =>
          Promise.resolve({ mapVersion: versions[where.id] ?? 0 })
        ),
      },
      $queryRaw: jest.fn(async (_s: TemplateStringsArray, id: string) => {
        versions[id] = (versions[id] ?? 0) + 1;
        return [{ mapVersion: versions[id] }];
      }),
    } as never;
  }

  let realmCounter = 0;
  /** Each test gets its own realm ids. */
  const freshRealm = () => `r_${++realmCounter}`;
  const builds = () =>
    mockLoader.mock.calls.map(([, layer, bucket, realm, version]) => [
      layer,
      bucket,
      realm,
      version,
    ]);

  it("builds a layer once under concurrent calls", async () => {
    const realm = freshRealm();
    let release: () => void = () => {};
    mockLoader.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () => resolve(layerAt(0));
        })
    );
    const calls = [1, 2, 3].map(() => getPackedLayer(dbAt({ [realm]: 0 }), realm, "political", 1));
    await new Promise((r) => setImmediate(r));
    release();
    const bodies = await Promise.all(calls);
    expect(mockLoader).toHaveBeenCalledTimes(1);
    expect(new Set(bodies).size).toBe(1);
  });

  it("keys a layer by realm, map version, loader format, layer and bucket, and builds the version it keyed by", async () => {
    const [a, b] = [freshRealm(), freshRealm()];
    const db = dbAt({ [a]: 7, [b]: 0 });
    await getPackedLayer(db, a, "political", 1);
    await getPackedLayer(db, a, "political", 1);
    await getPackedLayer(db, a, "political", 2);
    await getPackedLayer(db, a, "background", 1);
    await getPackedLayer(db, b, "political", 1);
    // A deploy that changes the loader's output is never served the old build's copy
    mockFormat = 2;
    await getPackedLayer(db, a, "political", 1);
    expect(builds()).toEqual([
      ["political", 1, a, 7],
      ["political", 2, a, 7],
      ["background", 1, a, 7],
      ["political", 1, b, 0],
      ["political", 1, a, 7],
    ]);
  });

  it("builds again after a map change: one made here at once and not for another realm, one made by another process once the version is read again", async () => {
    const [a, b] = [freshRealm(), freshRealm()];
    const versions = { [a]: 0, [b]: 0 };
    const db = dbAt(versions);
    const now = jest.spyOn(Date, "now").mockReturnValue(1_000_000);
    const before = await getPackedLayer(db, a, "political", 1);
    await getPackedLayer(db, b, "political", 1);
    mockLoader.mockClear();

    await invalidateRealmMap(db, a);
    const after = await getPackedLayer(db, a, "political", 1);
    await getPackedLayer(db, b, "political", 1);
    expect(after).not.toBe(before);
    expect(parse(after).features[0]?.properties?._id).toBe("sq1");
    expect(builds()).toEqual([["political", 1, a, 1]]);

    // The cron worker's import bumps the column and cannot clear this process's memory
    versions[b] = 1;
    now.mockReturnValue(1_000_000 + 6_000);
    const moved = await getPackedLayer(db, b, "political", 1);
    expect(parse(moved).features[0]?.properties?._id).toBe("sq1");
    expect(builds()).toEqual([
      ["political", 1, a, 1],
      ["political", 1, b, 1],
    ]);
  });
});

describe("the layer loader (loadLayerFromDB)", () => {
  function circle(cx: number, cy: number, radius: number, n: number): Position[] {
    const ring: Position[] = [];
    for (let i = 0; i < n; i++) {
      const angle = (2 * Math.PI * i) / n;
      ring.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]);
    }
    ring.push([...ring[0]!]);
    return ring;
  }
  const DENSE = circle(0, 0, 1, 360);
  const SLIVER: Position[] = [
    [5, 5],
    [6, 6],
    [7, 7],
    [5, 5],
  ];

  const row = (featureId: string, geometry: Geometry) => ({
    featureId,
    geometry,
    properties: { fill: "#336699" },
    displayName: featureId,
    countryId: null,
    areaSqKm: 1,
    centroid: null,
    country: null,
  });

  /**
   * A database holding `rows` as the realm's layer. Its odd `$queryRaw` calls are the pg_proc probe, its even ones
   * the coverage query, which answers `coverage` (featureId to the simplified geometry's GeoJSON text) or throws it.
   */
  function dbWith(
    rows: unknown[],
    options: { probe?: boolean; coverage?: Record<string, string> | Error } = {}
  ) {
    const { probe = true, coverage = {} } = options;
    const queries: string[] = [];
    const $queryRaw = jest.fn((strings: TemplateStringsArray) => {
      queries.push(strings.join("?"));
      if (queries.length % 2 === 1) return Promise.resolve([{ exists: probe }]);
      if (coverage instanceof Error) return Promise.reject(coverage);
      return Promise.resolve(
        Object.entries(coverage).map(([featureId, geometry]) => ({ featureId, geometry }))
      );
    });
    const findMany = jest.fn().mockResolvedValue(rows);
    const db = {
      mapLayer: { findMany },
      countrySovereignty: { findMany: jest.fn().mockResolvedValue([]) },
      $queryRaw,
    };
    return { db, findMany, queries };
  }

  const pointsOf = (g: Geometry) => (g.type === "Polygon" ? g.coordinates[0]!.length : -1);

  beforeEach(() => clearLayerCache());

  it("drops in-flight loads with a cleared cache, so the next load reads the rows again", async () => {
    const findMany = jest.fn(async () => {
      await Promise.resolve();
      return [row("l1", square(0))];
    });
    const db = { mapLayer: { findMany } };

    const first = loadLayerFromDB(db, "lakes", 1);
    clearLayerCache("lakes");
    const second = loadLayerFromDB(db, "lakes", 1);

    await Promise.all([first, second]);
    expect(findMany).toHaveBeenCalledTimes(2);
  });

  it("keeps a feature crossing the antimeridian out of the coverage, simplifies it from its GeoJSON, and splits it at 180", async () => {
    // Stored with longitudes jumping 175 -> -175, so its geom_postgis is a planar sliver spanning the world
    const crossing: Polygon = {
      type: "Polygon",
      coordinates: [
        [
          [175, -5],
          [-175, -5],
          [-175, 5],
          [175, 5],
          [175, -5],
        ],
      ],
    };
    const { db, queries } = dbWith(
      [row("Wide", crossing), row("Alpha", { type: "Polygon", coordinates: [DENSE] })],
      { coverage: { Alpha: JSON.stringify(square(0)) } }
    );

    const fc = await loadLayerFromDB(db, "political", 0, "default");

    expect(queries[1]).toMatch(/ST_XMax\(geom_postgis\) - ST_XMin\(geom_postgis\) <= 180/);
    const wideParts = fc!.features.filter((f) => f.properties?._id === "Wide");
    expect(wideParts).toHaveLength(2);
    const lngs = wideParts.map((f) => (f.geometry as Polygon).coordinates[0]!.map((p) => p[0]!));
    expect(Math.max(...lngs.flat())).toBe(180);
    expect(Math.min(...lngs.flat())).toBe(-180);
    expect(lngs.map((part) => part.length >= 4)).toEqual([true, true]);
  });

  it.each([
    [
      "the coverage cannot be simplified",
      new Error("TopologyException: found non-noded intersection"),
      false,
    ],
    [
      "the coverage emptied a feature",
      {
        Alpha: JSON.stringify(square(0)),
        Beta: JSON.stringify({ type: "Polygon", coordinates: [] }),
      },
      true,
    ],
  ])(
    "falls back when %s: each feature it does not hold is simplified from its stored GeoJSON, ring by ring",
    async (_name, coverage, alphaFromCoverage) => {
      const { db } = dbWith(
        [
          row("Alpha", { type: "Polygon", coordinates: [DENSE] }),
          // turf rejects a whole feature for its sliver hole
          row("Beta", { type: "Polygon", coordinates: [circle(20, 20, 1, 360), SLIVER] }),
        ],
        { coverage }
      );

      const fc = await loadLayerFromDB(db, "political", 0, "default");
      const [alpha, beta] = fc!.features;

      if (alphaFromCoverage) expect(pointsOf(alpha!.geometry)).toBe(5);
      else expect(pointsOf(alpha!.geometry)).toBeLessThan(DENSE.length / 4);
      expect(pointsOf(beta!.geometry)).toBeLessThan(DENSE.length / 4);
      expect(pointsOf(beta!.geometry)).toBeGreaterThan(5);
      expect((beta!.geometry as Polygon).coordinates[1]).toEqual(SLIVER);
    }
  );

  it("builds once per map version, again for a new one, and keeps a version-less read (the editor's source) apart", async () => {
    const { db, findMany } = dbWith([row("Alpha", square(0))], { probe: false });

    await loadLayerFromDB(db, "political", 1, "default", 3);
    await loadLayerFromDB(db, "political", 1, "default", 3);
    expect(findMany).toHaveBeenCalledTimes(1);

    await loadLayerFromDB(db, "political", 1, "default", 4);
    expect(findMany).toHaveBeenCalledTimes(2);

    await loadLayerFromDB(db, "political", 1, "default");
    expect(findMany).toHaveBeenCalledTimes(3);
  });
});
