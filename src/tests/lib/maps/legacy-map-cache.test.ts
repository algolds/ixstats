import { dropLegacyMapCache } from "~/lib/maps/legacy-map-cache";

type Idb = { deleteDatabase: jest.Mock };

/** The module keeps "already asked" state, so each case loads a fresh copy under its own indexedDB. */
function withIndexedDb(idb: Idb | undefined, run: (drop: typeof dropLegacyMapCache) => void) {
  Object.defineProperty(globalThis, "indexedDB", {
    value: idb,
    configurable: true,
    writable: true,
  });
  try {
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      run(
        (
          require("~/lib/maps/legacy-map-cache") as {
            dropLegacyMapCache: typeof dropLegacyMapCache;
          }
        ).dropLegacyMapCache
      );
    });
  } finally {
    Reflect.deleteProperty(globalThis, "indexedDB");
  }
}

describe("dropLegacyMapCache", () => {
  it("deletes the retired layer database, once however often it is called", () => {
    const idb = { deleteDatabase: jest.fn() };
    withIndexedDb(idb, (drop) => {
      drop();
      drop();
    });
    expect(idb.deleteDatabase).toHaveBeenCalledTimes(1);
    expect(idb.deleteDatabase).toHaveBeenCalledWith("ixworld-map-cache");
  });

  it("does nothing where there is no IndexedDB (server render, old browsers)", () => {
    expect(() => withIndexedDb(undefined, (drop) => drop())).not.toThrow();
  });

  it("swallows a browser that refuses (private mode, blocked storage)", () => {
    const idb = {
      deleteDatabase: jest.fn(() => {
        throw new Error("SecurityError");
      }),
    };
    expect(() => withIndexedDb(idb, (drop) => drop())).not.toThrow();
    expect(idb.deleteDatabase).toHaveBeenCalledTimes(1);
  });
});
