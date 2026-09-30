import {
  getCachedMapLayers,
  isCacheEntryForScope,
  mapLayersCacheKey,
  setCachedMapLayers,
} from "~/lib/maps/map-idb-cache";

type Entry = { key: string; data: unknown; realmId?: string; timestamp: number };

/** The slice of IndexedDB the cache uses, in memory: one database, stores of key → entry. */
function installFakeIndexedDB() {
  const stores = new Map<string, Map<string, Entry>>();
  let version = 0;
  const later = <R extends { onsuccess?: () => void }>(req: R) => {
    queueMicrotask(() => req.onsuccess?.());
    return req;
  };
  const db = {
    objectStoreNames: { contains: (name: string) => stores.has(name) },
    deleteObjectStore: (name: string) => stores.delete(name),
    createObjectStore: (name: string) => stores.set(name, new Map()),
    transaction: (name: string) => ({
      objectStore: () => ({
        get: (key: string) =>
          later({ result: stores.get(name)?.get(key) } as {
            result?: Entry;
            onsuccess?: () => void;
          }),
        put: (entry: Entry) => stores.get(name)?.set(entry.key, entry),
        delete: (key: string) => stores.get(name)?.delete(key),
      }),
    }),
  };
  const open = (_name: string, v: number) => {
    const req: { result: typeof db; onupgradeneeded?: () => void; onsuccess?: () => void } = {
      result: db,
    };
    queueMicrotask(() => {
      if (v > version) {
        version = v;
        req.onupgradeneeded?.();
      }
      req.onsuccess?.();
    });
    return req;
  };
  Object.defineProperty(globalThis, "indexedDB", { value: { open }, configurable: true });
  return {
    seed: (entry: Entry) => stores.get("layers")?.set(entry.key, entry),
    keys: () => [...(stores.get("layers")?.keys() ?? [])],
  };
}

const political = { type: "FeatureCollection", features: [{ id: "border" }] };

describe("map layer cache keys", () => {
  it("keys a named realm by its slug, and otherwise by the viewer's realm id", () => {
    expect(mapLayersCacheKey({ realm: "eurth", viewerRealmId: "default" })).toBe(
      "worldMapLayers:slug:eurth"
    );
    expect(mapLayersCacheKey({ viewerRealmId: "r_eurth" })).toBe("worldMapLayers:realm:r_eurth");
  });

  it("has no key while the viewer's realm is unknown", () => {
    expect(mapLayersCacheKey({})).toBeNull();
  });

  it("accepts layers under a viewer key only when they are that viewer's realm's", () => {
    expect(isCacheEntryForScope("default", { viewerRealmId: "default" })).toBe(true);
    expect(isCacheEntryForScope("default", { viewerRealmId: "r_eurth" })).toBe(false);
    expect(isCacheEntryForScope(undefined, { viewerRealmId: "default" })).toBe(false);
    expect(isCacheEntryForScope(undefined, { realm: "eurth" })).toBe(true);
  });
});

describe("map layer cache reads and writes", () => {
  let idb: ReturnType<typeof installFakeIndexedDB>;
  beforeEach(() => {
    idb = installFakeIndexedDB();
  });

  it("never shows IxWorld's cached map to a viewer whose active nation moved to Eurth", async () => {
    await setCachedMapLayers({ viewerRealmId: "default" }, { political }, "default");

    await expect(getCachedMapLayers({ viewerRealmId: "default" })).resolves.toEqual({ political });
    await expect(getCachedMapLayers({ viewerRealmId: "r_eurth" })).resolves.toBeNull();
  });

  it("refuses to file another realm's layers under the viewer's key (a stale profile)", async () => {
    await setCachedMapLayers({ viewerRealmId: "default" }, { political }, "r_eurth");

    expect(idb.keys()).toEqual([]);
  });

  it("ignores an entry under the viewer's key that records another realm, or none", async () => {
    await getCachedMapLayers({ viewerRealmId: "default" }); // creates the store
    idb.seed({
      key: "worldMapLayers:realm:default",
      data: { political },
      realmId: "r_eurth",
      timestamp: Date.now(),
    });
    await expect(getCachedMapLayers({ viewerRealmId: "default" })).resolves.toBeNull();

    idb.seed({ key: "worldMapLayers:realm:default", data: { political }, timestamp: Date.now() });
    await expect(getCachedMapLayers({ viewerRealmId: "default" })).resolves.toBeNull();
  });

  it("neither reads nor writes while the viewer's realm is unknown", async () => {
    await setCachedMapLayers({}, { political }, "default");

    expect(idb.keys()).toEqual([]);
    await expect(getCachedMapLayers({})).resolves.toBeNull();
  });

  it("keeps a ?realm= map under its slug, apart from the viewer's own", async () => {
    await setCachedMapLayers(
      { realm: "eurth", viewerRealmId: "default" },
      { political },
      "r_eurth"
    );

    await expect(getCachedMapLayers({ realm: "eurth", viewerRealmId: "default" })).resolves.toEqual(
      {
        political,
      }
    );
    await expect(getCachedMapLayers({ viewerRealmId: "default" })).resolves.toBeNull();
  });
});
