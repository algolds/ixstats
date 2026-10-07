/** @jest-environment node */
// `jest` is the injected global on purpose: @swc/jest only hoists jest.mock() on the global.
jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" } }));
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("fs/promises", () => ({ readFile: jest.fn() }));

import { readFile } from "fs/promises";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";
import { clearTrpcMemoryCache } from "~/lib/cache/trpc-cache";
import { clearLayerCache } from "~/server/shared/layer-cache";
import { worldMapProcedures } from "~/server/api/routers/geo/core/world-map";
import { unpackLayers } from "~/lib/maps/geojson-pack";

type ModelMock = Record<string, jest.Mock>;

/** Every model answers empty unless overridden; no map layer rows, so IxWorld reads its static files. */
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

const square = (lng: number, lat: number, d: number) => ({
  type: "Polygon" as const,
  coordinates: [
    [
      [lng, lat],
      [lng + d, lat],
      [lng + d, lat + d],
      [lng, lat + d],
      [lng, lat],
    ],
  ],
});

beforeEach(() => {
  clearTrpcMemoryCache();
  clearLayerCache();
  jest.spyOn(console, "error").mockImplementation(() => {});
  (readFile as unknown as jest.Mock).mockResolvedValue(
    JSON.stringify({
      type: "FeatureCollection",
      features: [{ type: "Feature", properties: {}, geometry: square(10, 10, 1) }],
    })
  );
});

afterEach(() => jest.restoreAllMocks());

describe("geoCore.getMapBundle", () => {
  it("keeps the base layers when an overlay query fails", async () => {
    const broken = jest.fn().mockRejectedValue(new Error('column "realmId" does not exist'));
    const db = dbWith({ city: { findMany: broken }, pointOfInterest: { findMany: broken } });

    const bundle = await caller(ctxFor(db)).getMapBundle({ layers: ["lakes"] });

    expect(unpackLayers(bundle.worldMap).lakes?.features).toHaveLength(1);
    expect(bundle.features.pois.features).toEqual([]);
    expect(bundle.capitals.features).toEqual([]);
  });

  it("leaves cities and subdivisions to getMapBundleDetail", async () => {
    const bundle = await caller(ctxFor(dbWith())).getMapBundle({ layers: ["lakes"] });
    expect(Object.keys(bundle.features)).toEqual(["pois"]);
  });
});

describe("geoCore.getMapBundleDetail", () => {
  it("sends no cities or subdivisions, rather than failing, when their queries fail", async () => {
    const broken = jest.fn().mockRejectedValue(new Error('column "realmId" does not exist'));
    const db = dbWith({ city: { findMany: broken }, subdivision: { findMany: broken } });

    const detail = await caller(ctxFor(db)).getMapBundleDetail({});

    expect(detail.cities.features).toEqual([]);
    expect(detail.subdivisions.features).toEqual([]);
  });

  it("sends city and subdivision coordinates at map precision, not database precision", async () => {
    const country = { name: "Urcea", slug: "urcea" };
    const db = dbWith({
      city: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "c1",
            name: "Urceopolis",
            coordinates: [12.345678901234, -45.678901234567],
            country,
          },
        ]),
      },
      subdivision: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: "s1", name: "Canaery", geometry: square(1.123456789, 2.123456789, 0.5), country },
          ]),
      },
    });

    const detail = await caller(ctxFor(db)).getMapBundleDetail({});

    expect(detail.cities.features[0]!.geometry.coordinates).toEqual([12.34568, -45.6789]);
    const { subdivisions } = unpackLayers({ subdivisions: detail.subdivisions });
    const ring = (subdivisions!.features[0]!.geometry as { coordinates: number[][][] })
      .coordinates[0]!;
    expect(ring[0]).toEqual([1.1235, 2.1235]);
  });
});
