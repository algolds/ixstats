/** @jest-environment node */
// `jest` is the injected global on purpose: @swc/jest only hoists jest.mock() on the global.
jest.mock("~/lib/cache", () => ({
  __esModule: true,
  invalidateCache: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("~/server/api/routers/geo/core/layer-loader", () => ({
  loadLayerWithFallback: jest.fn(),
}));

import type { FeatureCollection } from "geojson";
import { loadLayerWithFallback } from "~/server/api/routers/geo/core/layer-loader";
import { unpackLayers, type PackedFeatureCollection } from "~/lib/maps/geojson-pack";
import { invalidateRealmMap } from "~/server/shared/map-invalidation";
import {
  getPackedLayer,
  warmGeoCache,
  warmGeoCacheDev,
} from "~/server/modules/maps/layer-delivery";

const loader = jest.mocked(loadLayerWithFallback);

const square = (x: number): FeatureCollection => ({
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { _id: `sq${x}` },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [x, 0],
            [x + 1, 0],
            [x + 1, 1],
            [x, 1],
            [x, 0],
          ],
        ],
      },
    },
  ],
});

/** A db whose realms sit at `versions` (realm id to map version); every bump goes through `bump`. */
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
    $executeRaw: jest.fn(),
  } as never;
}

const parse = (body: string) => JSON.parse(body) as PackedFeatureCollection;

let realmCounter = 0;
/** Each test gets its own realm ids: the packed cache is process-wide. */
const freshRealm = () => `r_${++realmCounter}`;

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
  loader.mockImplementation(async (_db, _layer, _bucket, _realm, version) => square(version ?? 0));
});
afterEach(() => jest.restoreAllMocks());

describe("getPackedLayer", () => {
  it("returns the layer in the packed wire format, as a JSON string the client decodes", async () => {
    const realm = freshRealm();
    const body = await getPackedLayer(dbAt({ [realm]: 0 }), realm, "political", 1);

    expect(typeof body).toBe("string");
    const packed = parse(body);
    expect(packed.type).toBe("FeatureCollection");
    // the political layer is packed at the 4 decimal places it was truncated to
    expect(packed.packed).toBe(4);
    expect(unpackLayers({ political: packed }).political?.features[0]?.geometry).toEqual(
      square(0).features[0]!.geometry
    );
  });

  it("builds a layer once under concurrent calls", async () => {
    const realm = freshRealm();
    const db = dbAt({ [realm]: 0 });
    let release: () => void = () => {};
    loader.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () => resolve(square(0));
        })
    );

    const calls = [1, 2, 3].map(() => getPackedLayer(db, realm, "political", 1));
    await new Promise((r) => setImmediate(r));
    release();
    const bodies = await Promise.all(calls);

    expect(loader).toHaveBeenCalledTimes(1);
    expect(new Set(bodies).size).toBe(1);
  });

  it("serves the second call from the cache, the same string", async () => {
    const realm = freshRealm();
    const db = dbAt({ [realm]: 0 });
    const first = await getPackedLayer(db, realm, "political", 1);
    const second = await getPackedLayer(db, realm, "political", 1);

    expect(loader).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
  });

  it("keeps a layer, a bucket and a realm apart", async () => {
    const [a, b] = [freshRealm(), freshRealm()];
    const db = dbAt({ [a]: 0, [b]: 0 });
    await getPackedLayer(db, a, "political", 1);
    await getPackedLayer(db, a, "political", 2);
    await getPackedLayer(db, a, "background", 1);
    await getPackedLayer(db, b, "political", 1);
    expect(loader).toHaveBeenCalledTimes(4);
  });

  it("builds the version it keyed by, so a version read before the data cannot cache newer data under it", async () => {
    const realm = freshRealm();
    await getPackedLayer(dbAt({ [realm]: 7 }), realm, "political", 1);
    expect(loader).toHaveBeenCalledWith(expect.anything(), "political", 1, realm, 7);
  });

  it("builds again after the realm's map was invalidated here, and not for another realm", async () => {
    const [a, b] = [freshRealm(), freshRealm()];
    const versions = { [a]: 0, [b]: 0 };
    const db = dbAt(versions);
    const before = await getPackedLayer(db, a, "political", 1);
    await getPackedLayer(db, b, "political", 1);
    loader.mockClear();

    await invalidateRealmMap(db, a);
    const after = await getPackedLayer(db, a, "political", 1);
    await getPackedLayer(db, b, "political", 1);

    expect(after).not.toBe(before);
    expect(parse(after).features[0]?.properties?._id).toBe("sq1");
    expect(loader).toHaveBeenCalledTimes(1);
    expect(loader).toHaveBeenCalledWith(expect.anything(), "political", 1, a, 1);
  });

  it("picks up a version another process bumped once this process re-reads it", async () => {
    const realm = freshRealm();
    const versions = { [realm]: 0 };
    const db = dbAt(versions);
    const now = jest.spyOn(Date, "now");
    now.mockReturnValue(1_000_000);
    await getPackedLayer(db, realm, "political", 1);

    // the cron worker's import: it bumps the column, and cannot clear this process's memory
    versions[realm] = 1;
    now.mockReturnValue(1_000_000 + 6_000);
    const after = await getPackedLayer(db, realm, "political", 1);

    expect(parse(after).features[0]?.properties?._id).toBe("sq1");
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("packs a layer with no features as an empty collection, rather than failing", async () => {
    const realm = freshRealm();
    loader.mockResolvedValue({ type: "FeatureCollection", features: [] });
    const packed = parse(await getPackedLayer(dbAt({ [realm]: 0 }), realm, "political", 1));
    expect(packed).toMatchObject({ type: "FeatureCollection", features: [] });
  });

  it("packs a layer the loader has none of (Ixnay without its file) as an empty collection", async () => {
    const realm = freshRealm();
    loader.mockResolvedValue(null);
    const packed = parse(await getPackedLayer(dbAt({ [realm]: 0 }), realm, "icecaps", 1));
    expect(packed).toMatchObject({ type: "FeatureCollection", features: [] });
  });

  it("does not cache a failed build", async () => {
    const realm = freshRealm();
    const db = dbAt({ [realm]: 0 });
    loader.mockRejectedValueOnce(new Error("db down"));

    await expect(getPackedLayer(db, realm, "political", 1)).rejects.toThrow("db down");
    await expect(getPackedLayer(db, realm, "political", 1)).resolves.toEqual(expect.any(String));
    expect(loader).toHaveBeenCalledTimes(2);
  });
});

describe("warming", () => {
  /** Ixnay's cache and its memoised version are process-wide: a bump gives each test a cold start. */
  async function ixnayDb() {
    const db = dbAt({ default: 0 });
    await invalidateRealmMap(db, "default");
    jest.clearAllMocks();
    return db;
  }

  it("builds Ixnay's /maps layers at the buckets the client asks for", async () => {
    const db = await ixnayDb();
    await warmGeoCache(db);

    const built = loader.mock.calls.map(
      ([, layer, bucket, realm]) => `${realm}:${layer}:${bucket}`
    );
    expect(built).toEqual(
      expect.arrayContaining([
        "default:political:1",
        "default:political:2",
        "default:country_labels:1",
        "default:background:1",
        "default:icecaps:2",
      ])
    );
    expect(new Set(built.map((b) => b.split(":")[0]))).toEqual(new Set(["default"]));
  });

  it("goes on past a layer that fails", async () => {
    const db = await ixnayDb();
    loader.mockRejectedValueOnce(new Error("bad layer"));
    await warmGeoCache(db);
    expect(loader.mock.calls.length).toBeGreaterThan(1);
  });

  it("dev warm-up builds just the first-paint layers at the default bucket", async () => {
    await warmGeoCacheDev(await ixnayDb());
    const buckets = new Set(loader.mock.calls.map(([, , bucket]) => bucket));
    expect(buckets).toEqual(new Set([1]));
  });
});
