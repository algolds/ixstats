/** @jest-environment node */
// `jest` is the injected global on purpose: @swc/jest only hoists jest.mock() on the global.
jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" } }));
jest.mock("~/server/db", () => ({ db: {} }));
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";
import { clearTrpcMemoryCache } from "~/lib/cache/trpc-cache";
import { worldMapProcedures } from "~/server/api/routers/geo/core/world-map";
import { MAP_TRPC_KEYS } from "~/server/shared/map-invalidation";
import { GEO_FEATURE_INVALIDATE_KEYS } from "~/lib/cache/trpc-cache";
import { borderHistoryProcedures } from "~/server/api/routers/geo/core/border-history";
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

afterEach(() => jest.restoreAllMocks());

describe("geoCore.getMapBundleMarkers", () => {
  it("takes the realm's map version as part of its input: a moved version reads the database again", async () => {
    const capitals = jest.fn().mockResolvedValue([]);
    const db = dbWith({ city: { findMany: capitals } });

    await caller(ctxFor(db)).getMapBundleMarkers({ version: 1 });
    await caller(ctxFor(db)).getMapBundleMarkers({ version: 1 });
    expect(capitals).toHaveBeenCalledTimes(1);

    await caller(ctxFor(db)).getMapBundleMarkers({ version: 2 });
    expect(capitals).toHaveBeenCalledTimes(2);
  });
});

describe("map invalidation", () => {
  it("drops the cached map procedures by their exact paths, all of which exist", () => {
    const live = new Set(
      [...Object.keys(worldMapProcedures), ...Object.keys(borderHistoryProcedures)].map(
        (name) => `geoCore.${name}`
      )
    );
    for (const key of [
      "geoCore.getMapBundleMarkers",
      "geoCore.getMapBundleDetail",
      "geoCore.getWorldMapAsOf",
    ]) {
      expect(live.has(key)).toBe(true);
      expect(MAP_TRPC_KEYS).toContain(key);
      expect(GEO_FEATURE_INVALIDATE_KEYS).toContain(key);
    }
  });
});
describe("geoCore.getMapBundleDetail", () => {
  it("takes the realm's map version as part of its input: a moved version reads the database again", async () => {
    const cities = jest.fn().mockResolvedValue([]);
    const db = dbWith({ city: { findMany: cities } });

    await caller(ctxFor(db)).getMapBundleDetail({ version: 1 });
    await caller(ctxFor(db)).getMapBundleDetail({ version: 1 });
    expect(cities).toHaveBeenCalledTimes(1);

    await caller(ctxFor(db)).getMapBundleDetail({ version: 2 });
    expect(cities).toHaveBeenCalledTimes(2);
  });
});
