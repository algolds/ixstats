// `jest` is the injected global on purpose: @swc/jest only hoists jest.mock() on the global.
import { describe, it, expect, beforeEach } from "@jest/globals";

jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" } }));
jest.mock("~/server/db", () => ({ db: {} }));

import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";
import { clearTrpcMemoryCache } from "~/lib/cache/trpc-cache";
import {
  overlayProcedures,
  computeCanonDensityScores,
} from "~/server/api/routers/geo/core/overlays";

type MockFn = jest.Mock<any, any>;

function makeCountry(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: `Country ${id}`,
    slug: id,
    geometry: { type: "Polygon", coordinates: [[[0, 0]]] },
    centroid: { coordinates: [0, 0] },
    continent: "Continent",
    region: "Region",
    currentPopulation: 10_000_000,
    currentGdpPerCapita: 20_000,
    currentTotalGdp: 200_000_000_000,
    economicVitality: 50,
    overallNationalHealth: 0,
    tradeBalance: 0,
    landArea: 100_000,
    lifeExpectancy: 75,
    literacyRate: 90,
    povertyRate: 15,
    urbanPopulationPercent: 60,
    populationWellbeing: 60,
    ...overrides,
  };
}

const mockDb = {
  country: {
    findMany: jest.fn() as MockFn,
  },
  bilateralTrade: {
    findMany: jest.fn() as MockFn,
  },
  storytellerEffect: {
    groupBy: jest.fn() as MockFn,
  },
  diplomaticEvent: {
    groupBy: jest.fn() as MockFn,
  },
  nationalIssue: {
    groupBy: jest.fn() as MockFn,
  },
  militaryConflict: {
    groupBy: jest.fn() as MockFn,
  },
  storyPin: {
    groupBy: jest.fn() as MockFn,
  },
  countryGeoProfile: {
    findMany: jest.fn() as MockFn,
    findUnique: jest.fn() as MockFn,
  },
  crisisEvent: {
    findMany: jest.fn() as MockFn,
  },
};

const baseContext = {
  db: mockDb,
  user: null,
  auth: null,
  rateLimitIdentifier: "test",
  headers: new Headers(),
} as any;

const testRouter = createTRPCRouter({
  ...overlayProcedures,
});

describe("getRegionalChoropleth", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it("derives net trade balance from bilateral trade rows and inverts ranking", async () => {
    mockDb.country.findMany.mockResolvedValue([
      makeCountry("A"),
      makeCountry("B"),
      makeCountry("C"),
    ]);

    // A has a surplus (+200), B and C have deficits.
    mockDb.bilateralTrade.findMany.mockResolvedValue([
      {
        country1Id: "A",
        country2Id: "B",
        exportsFrom1: 200,
        exportsFrom2: 100,
        tradeBalance1: 100,
      },
      {
        country1Id: "C",
        country2Id: "A",
        exportsFrom1: 50,
        exportsFrom2: 150,
        tradeBalance1: -100,
      },
    ]);

    const caller = createCallerFactory(testRouter)(baseContext);
    const result = await caller.getRegionalChoropleth({
      metric: "tradeBalance",
      groupBy: "country",
    });

    const byId = new Map(result.rows.map((row) => [row.countryId, row]));
    expect(byId.get("A")?.rawValue).toBe(200);
    expect(byId.get("B")?.rawValue).toBe(-100);
    expect(byId.get("C")?.rawValue).toBe(-100);

    // Surplus (A) should have the lowest rank value, deficits the highest.
    expect(byId.get("A")?.value).toBeLessThan(byId.get("B")?.value ?? 1);
    expect(byId.get("A")?.value).toBeLessThan(byId.get("C")?.value ?? 1);
  });
});

describe("computeCanonDensityScores", () => {
  it("applies source weights and defaults missing countries to 0", () => {
    const scores = computeCanonDensityScores(["A", "B", "C"], {
      storytellerEffect: { A: 2, B: 1 },
      diplomaticEvent: { B: 3 },
      resolvedNationalIssue: {},
      militaryConflict: { A: 1, C: 2 },
      storyPin: { C: 4 },
    });

    expect(scores.get("A")).toBe(2 * 1 + 1 * 2); // 4
    expect(scores.get("B")).toBe(1 * 1 + 3 * 1); // 4
    expect(scores.get("C")).toBe(2 * 2 + 4 * 0.5); // 6
  });
});
describe("getCrisisRiskMap", () => {
  type CrisisRiskResult = {
    rows: { countryId: string; value: number }[];
    crisisEvents: {
      features: {
        geometry: { coordinates: [number, number] };
        properties: { id: string; countryName: string };
      }[];
    };
  };

  function makeCrisis(id: string, affectedCountries: string | null) {
    return {
      id,
      title: `Crisis ${id}`,
      type: "natural_disaster",
      severity: "high",
      location: null,
      affectedCountries,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    clearTrpcMemoryCache();
  });
  it("resolves crisis points from JSON id arrays with one country query", async () => {
    mockDb.countryGeoProfile.findMany.mockResolvedValue([]);
    mockDb.crisisEvent.findMany.mockResolvedValue([
      makeCrisis("x1", '["A","B"]'),
      makeCrisis("x2", '["C"]'),
    ]);
    mockDb.country.findMany.mockResolvedValue([
      { id: "A", name: "Alpha", centroid: { coordinates: [1, 2] } },
      { id: "C", name: "Gamma", centroid: { coordinates: [3, 4] } },
    ]);

    const caller = createCallerFactory(testRouter)(baseContext);
    const result = (await caller.getCrisisRiskMap()) as CrisisRiskResult;

    expect(mockDb.country.findMany).toHaveBeenCalledTimes(1);
    expect(result.crisisEvents.features).toHaveLength(2);
    const byCrisis = new Map(result.crisisEvents.features.map((f) => [f.properties.id, f]));
    expect(byCrisis.get("x1")?.properties.countryName).toBe("Alpha");
    expect(byCrisis.get("x1")?.geometry.coordinates).toEqual([1, 2]);
    expect(byCrisis.get("x2")?.properties.countryName).toBe("Gamma");
  });

  it("skips crises whose affected countries have no centroid", async () => {
    mockDb.countryGeoProfile.findMany.mockResolvedValue([]);
    mockDb.crisisEvent.findMany.mockResolvedValue([
      makeCrisis("x1", '["A"]'),
      makeCrisis("x2", "A, B"),
      makeCrisis("x3", null),
    ]);
    mockDb.country.findMany.mockResolvedValue([
      { id: "A", name: "Alpha", centroid: null },
      { id: "B", name: "Beta", centroid: { coordinates: [5, 6] } },
    ]);

    const caller = createCallerFactory(testRouter)(baseContext);
    const result = (await caller.getCrisisRiskMap()) as CrisisRiskResult;

    expect(result.crisisEvents.features).toHaveLength(1);
    expect(result.crisisEvents.features[0]?.properties.id).toBe("x2");
    expect(result.crisisEvents.features[0]?.properties.countryName).toBe("Beta");
  });
});
