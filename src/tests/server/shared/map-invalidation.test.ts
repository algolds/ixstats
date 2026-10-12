/** @jest-environment node */
/**
 * invalidateRealmMap: the one helper every map write path calls. It clears that realm's server layer caches and
 * the cached map reads, bumps Realm.mapVersion, and drops the memoised version, so the next client fetch builds
 * new versioned URLs. getRealmMapVersion reads the version (memoised for 5 s per process).
 */
jest.mock("~/lib/cache", () => ({
  __esModule: true,
  invalidateCache: jest.fn().mockResolvedValue(undefined),
}));

import { invalidateCache } from "~/lib/cache";
import { layerCache, layerInflight, clearLayerCache } from "~/server/shared/layer-cache";
import {
  MAP_TRPC_KEYS,
  getRealmMapVersion,
  invalidateAllRealmMaps,
  invalidateRealmMap,
  onMapInvalidated,
} from "~/server/shared/map-invalidation";

const fc = { type: "FeatureCollection" as const, features: [] };
const entry = () => ({ data: fc, timestamp: Date.now() });

function fakeDb(version = 4) {
  return {
    $queryRaw: jest.fn().mockResolvedValue([{ mapVersion: version }]),
    $executeRaw: jest.fn().mockResolvedValue(1),
    realm: { findUnique: jest.fn().mockResolvedValue({ mapVersion: version }) },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  clearLayerCache();
});

describe("invalidateRealmMap", () => {
  it("clears only that realm's layer caches, in flight builds included", async () => {
    layerCache.set("political:z0:r1", entry());
    layerCache.set("country_labels:z1:r1", entry());
    layerCache.set("rivers:z2:r1", entry());
    layerCache.set("political:z0:r2", entry());
    layerCache.set("political:z0:default", entry());
    layerInflight.set("political:z1:r1", Promise.resolve(null));
    layerInflight.set("political:z1:r2", Promise.resolve(null));

    await invalidateRealmMap(fakeDb(), "r1");

    expect([...layerCache.keys()].sort()).toEqual(["political:z0:default", "political:z0:r2"]);
    expect([...layerInflight.keys()]).toEqual(["political:z1:r2"]);
  });

  it("does not mistake a realm whose id merely ends the same way", async () => {
    layerCache.set("political:z0:xr1", entry());
    await invalidateRealmMap(fakeDb(), "r1");
    expect(layerCache.has("political:z0:xr1")).toBe(true);
  });

  it("drops the cached map reads by their procedure paths", async () => {
    await invalidateRealmMap(fakeDb(), "r1");
    expect(invalidateCache).toHaveBeenCalledTimes(1);
    expect(invalidateCache).toHaveBeenCalledWith(MAP_TRPC_KEYS);
    expect(MAP_TRPC_KEYS).toEqual(
      expect.arrayContaining([
        "geoCore.getWorldMapAsOf",
        "geoCore.getMapBundleMarkers",
        "geoCore.getMapBundleDetail",
        "geoCore.getCountryFeatures",
        "geoCore.getAllMapFeatures",
        "geoCore.getCountryGeometry",
        "geoCore.getCountryGeoProfile",
        "countryGeo.getCountryGeoBundle",
        "geoEditor.validateLinkage",
      ])
    );
  });

  it("names the procedures that exist, not the removed layer procedures' prefixes", () => {
    expect(MAP_TRPC_KEYS).not.toContain("geoCore.getWorldMap");
    expect(MAP_TRPC_KEYS).not.toContain("geoCore.getMapBundle");
  });

  it("increments the realm's version once and returns the new one", async () => {
    const db = fakeDb(7);
    const version = await invalidateRealmMap(db, "r1");
    expect(version).toBe(7);
    expect(db.$queryRaw).toHaveBeenCalledTimes(1);
    const [strings, realmId] = db.$queryRaw.mock.calls[0];
    expect(strings.join("?")).toMatch(/UPDATE "realms" SET "mapVersion" = "mapVersion" \+ 1/);
    expect(strings.join("?")).toMatch(/RETURNING "mapVersion"/);
    expect(realmId).toBe("r1");
  });

  it("tolerates a realm with no row (version 0)", async () => {
    const db = fakeDb();
    db.$queryRaw.mockResolvedValue([]);
    await expect(invalidateRealmMap(db, "default")).resolves.toBe(0);
  });

  it("survives a failing cache invalidation", async () => {
    (invalidateCache as jest.Mock).mockRejectedValueOnce(new Error("redis down"));
    await expect(invalidateRealmMap(fakeDb(3), "r1")).resolves.toBe(3);
  });

  it("still clears the caches when the version write fails, then reports the failure", async () => {
    const db = fakeDb();
    db.$queryRaw.mockRejectedValue(new Error("db down"));
    layerCache.set("political:z0:r1", entry());
    await expect(invalidateRealmMap(db, "r1")).rejects.toThrow("db down");
    expect(layerCache.has("political:z0:r1")).toBe(false);
  });

  it("tells registered hooks which realm changed", async () => {
    const hook = jest.fn();
    const off = onMapInvalidated(hook);
    await invalidateRealmMap(fakeDb(), "r1");
    expect(hook).toHaveBeenCalledWith("r1");
    off();
    await invalidateRealmMap(fakeDb(), "r1");
    expect(hook).toHaveBeenCalledTimes(1);
  });
});

describe("invalidateAllRealmMaps", () => {
  it("clears every realm's caches and bumps every realm's version", async () => {
    layerCache.set("political:z0:r1", entry());
    layerCache.set("political:z0:r2", entry());
    const db = fakeDb();
    const hook = jest.fn();
    const off = onMapInvalidated(hook);

    await invalidateAllRealmMaps(db);
    off();

    expect(layerCache.size).toBe(0);
    expect(db.$executeRaw).toHaveBeenCalledTimes(1);
    expect(db.$executeRaw.mock.calls[0][0].join("?")).toMatch(
      /UPDATE "realms" SET "mapVersion" = "mapVersion" \+ 1/
    );
    expect(invalidateCache).toHaveBeenCalledWith(MAP_TRPC_KEYS);
    expect(hook).toHaveBeenCalledWith(null);
  });
});

describe("getRealmMapVersion", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("reads the version once and serves it from memory for 5 seconds", async () => {
    const db = fakeDb(9);
    expect(await getRealmMapVersion(db, "memo-a")).toBe(9);
    expect(await getRealmMapVersion(db, "memo-a")).toBe(9);
    expect(db.realm.findUnique).toHaveBeenCalledTimes(1);
    expect(db.realm.findUnique).toHaveBeenCalledWith({
      where: { id: "memo-a" },
      select: { mapVersion: true },
    });

    jest.advanceTimersByTime(5_001);
    await getRealmMapVersion(db, "memo-a");
    expect(db.realm.findUnique).toHaveBeenCalledTimes(2);
  });

  it("memoises per realm", async () => {
    const db = fakeDb(2);
    await getRealmMapVersion(db, "memo-b1");
    await getRealmMapVersion(db, "memo-b2");
    expect(db.realm.findUnique).toHaveBeenCalledTimes(2);
  });

  it("drops the memo after an invalidation, so the next read sees the new version", async () => {
    const db = fakeDb(5);
    expect(await getRealmMapVersion(db, "memo-c")).toBe(5);
    db.$queryRaw.mockResolvedValue([{ mapVersion: 6 }]);
    db.realm.findUnique.mockResolvedValue({ mapVersion: 6 });
    await invalidateRealmMap(db, "memo-c");
    expect(await getRealmMapVersion(db, "memo-c")).toBe(6);
    expect(db.realm.findUnique).toHaveBeenCalledTimes(2);
  });

  it("an invalidation of all realms drops every memo", async () => {
    const db = fakeDb(1);
    await getRealmMapVersion(db, "memo-d");
    await invalidateAllRealmMaps(db);
    await getRealmMapVersion(db, "memo-d");
    expect(db.realm.findUnique).toHaveBeenCalledTimes(2);
  });

  it("does not memoise a read that an invalidation overtook", async () => {
    const db = fakeDb(1);
    let release: (row: { mapVersion: number }) => void = () => undefined;
    db.realm.findUnique.mockReturnValueOnce(
      new Promise((resolve) => {
        release = resolve;
      })
    );
    const stale = getRealmMapVersion(db, "memo-e");
    await invalidateRealmMap(db, "memo-e");
    release({ mapVersion: 1 });
    expect(await stale).toBe(1);

    db.realm.findUnique.mockResolvedValue({ mapVersion: 2 });
    expect(await getRealmMapVersion(db, "memo-e")).toBe(2);
  });

  it("is 0 for a realm with no row", async () => {
    const db = fakeDb();
    db.realm.findUnique.mockResolvedValue(null);
    expect(await getRealmMapVersion(db, "memo-f")).toBe(0);
  });
});
