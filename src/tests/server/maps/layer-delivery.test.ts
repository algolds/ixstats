/** @jest-environment node */
// `jest` is the injected global on purpose: @swc/jest only hoists jest.mock() on the global.
jest.mock("~/lib/cache", () => ({
  __esModule: true,
  invalidateCache: jest.fn().mockResolvedValue(undefined),
}));
// A getter, so a test can move the loader's output format
let mockFormat = 1;
jest.mock("~/lib/maps/layer-format", () => ({
  get LAYER_FORMAT_VERSION() {
    return mockFormat;
  },
}));
jest.mock("~/server/modules/maps/layer-loader", () => ({
  loadLayerWithFallback: jest.fn(),
}));

import type { FeatureCollection } from "geojson";
import { loadLayerWithFallback } from "~/server/modules/maps/layer-loader";
import { type PackedFeatureCollection } from "~/lib/maps/geojson-pack";
import { invalidateRealmMap } from "~/server/shared/map-invalidation";
import {
  getPackedLayer
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
  mockFormat = 1;
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
  loader.mockImplementation(async (_db, _layer, _bucket, _realm, version) => square(version ?? 0));
});
afterEach(() => jest.restoreAllMocks());

describe("getPackedLayer", () => {
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
  it("keeps a layer, a bucket and a realm apart", async () => {
    const [a, b] = [freshRealm(), freshRealm()];
    const db = dbAt({ [a]: 0, [b]: 0 });
    await getPackedLayer(db, a, "political", 1);
    await getPackedLayer(db, a, "political", 2);
    await getPackedLayer(db, a, "background", 1);
    await getPackedLayer(db, b, "political", 1);
    expect(loader).toHaveBeenCalledTimes(4);
  });

  it("keeps a layer built by another loader format apart, so a changed build is never served an old copy", async () => {
    const realm = freshRealm();
    const db = dbAt({ [realm]: 0 });
    await getPackedLayer(db, realm, "political", 1);
    mockFormat = 2;
    await getPackedLayer(db, realm, "political", 1);
    expect(loader).toHaveBeenCalledTimes(2);
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
  it("does not cache a failed build", async () => {
    const realm = freshRealm();
    const db = dbAt({ [realm]: 0 });
    loader.mockRejectedValueOnce(new Error("db down"));

    await expect(getPackedLayer(db, realm, "political", 1)).rejects.toThrow("db down");
    await expect(getPackedLayer(db, realm, "political", 1)).resolves.toEqual(expect.any(String));
    expect(loader).toHaveBeenCalledTimes(2);
  });
});
