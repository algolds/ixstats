/** @jest-environment node */
// `jest` is the injected global on purpose: @swc/jest only hoists jest.mock() on the global.
jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" } }));
jest.mock("~/server/db", () => ({ db: {} }));
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";
import { clearTrpcMemoryCache } from "~/lib/cache/trpc-cache";
import { worldMapProcedures } from "~/server/api/routers/geo/core/world-map";
import { MAP_TRPC_KEYS } from "~/server/shared/map-invalidation";
import { unpackLayers } from "~/lib/maps/geojson-pack";

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
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe("geoCore.getMapBundleMarkers", () => {
  it("sends no POIs or capitals, rather than failing, when their queries fail", async () => {
    const broken = jest.fn().mockRejectedValue(new Error('column "realmId" does not exist'));
    const db = dbWith({ city: { findMany: broken }, pointOfInterest: { findMany: broken } });

    const markers = await caller(ctxFor(db)).getMapBundleMarkers();

    expect(markers.features.pois.features).toEqual([]);
    expect(markers.capitals.features).toEqual([]);
  });

  it("carries no layers: those come from the versioned layer route", async () => {
    const markers = await caller(ctxFor(dbWith())).getMapBundleMarkers();
    expect(Object.keys(markers).sort()).toEqual(["capitals", "features", "realmId"]);
    expect(Object.keys(markers.features)).toEqual(["pois"]);
  });

  it("sends capital coordinates at map precision, tagged with their country", async () => {
    const db = dbWith({
      city: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "c1",
            name: "Urceopolis",
            coordinates: [12.345678901234, -45.678901234567],
            country: { name: "Urcea", slug: "urcea" },
          },
        ]),
      },
    });

    const { capitals } = await caller(ctxFor(db)).getMapBundleMarkers();

    expect(capitals.features[0]!.geometry.coordinates).toEqual([12.34568, -45.6789]);
    expect(capitals.features[0]!.properties).toMatchObject({ countryName: "Urcea" });
  });
});

describe("map invalidation", () => {
  it("drops the cached markers and detail with the map's other cached reads (keys match by substring)", () => {
    for (const procedure of ["geoCore.getMapBundleMarkers", "geoCore.getMapBundleDetail"]) {
      expect(MAP_TRPC_KEYS.some((key) => procedure.includes(key))).toBe(true);
    }
  });
});

describe("the geometry layers", () => {
  it("are no longer tRPC procedures: the layer route serves them", () => {
    expect(Object.keys(worldMapProcedures)).toEqual(
      expect.not.arrayContaining(["getWorldMap", "getWorldMapPacked", "getMapBundle"])
    );
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
