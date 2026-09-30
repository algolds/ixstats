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

function makeGroupByResult(field: string, id: string, count: number) {
  return { [field]: id, _count: { _all: count } };
}

function makeConflictRow(role: "initiatorId" | "defenderId", id: string, count: number) {
  return { [role]: id, _count: { _all: count } };
}

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

  it("derives health scores when metric is health", async () => {
    mockDb.country.findMany.mockResolvedValue([
      makeCountry("A", {
        lifeExpectancy: 82,
        literacyRate: 98,
        povertyRate: 5,
        currentGdpPerCapita: 50_000,
      }),
      makeCountry("B", {
        lifeExpectancy: 60,
        literacyRate: 50,
        povertyRate: 45,
        currentGdpPerCapita: 3_000,
      }),
    ]);

    const caller = createCallerFactory(testRouter)(baseContext);
    const result = (await caller.getRegionalChoropleth({
      metric: "health",
      groupBy: "country",
    })) as {
      features: { properties: { rawValue: number; value: number } }[];
    };

    expect(result.features).toHaveLength(2);
    const aRaw = result.features[0]?.properties.rawValue ?? 0;
    const bRaw = result.features[1]?.properties.rawValue ?? 0;
    expect(aRaw).toBeGreaterThan(bRaw);
    expect(result.features[0]?.properties.value).toBeGreaterThan(
      result.features[1]?.properties.value ?? 0
    );
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
    const result = (await caller.getRegionalChoropleth({
      metric: "tradeBalance",
      groupBy: "country",
    })) as {
      features: { properties: { id: string; rawValue: number; value: number } }[];
    };

    const byId = new Map(result.features.map((f) => [f.properties.id, f.properties]));
    expect(byId.get("A")?.rawValue).toBe(200);
    expect(byId.get("B")?.rawValue).toBe(-100);
    expect(byId.get("C")?.rawValue).toBe(-100);

    // Surplus (A) should have the lowest rank value, deficits the highest.
    expect(byId.get("A")?.value).toBeLessThan(byId.get("B")?.value ?? 1);
    expect(byId.get("A")?.value).toBeLessThan(byId.get("C")?.value ?? 1);
  });

  it("preserves existing metric paths", async () => {
    mockDb.country.findMany.mockResolvedValue([
      makeCountry("A", { currentGdpPerCapita: 50_000 }),
      makeCountry("B", { currentGdpPerCapita: 5_000 }),
    ]);

    const caller = createCallerFactory(testRouter)(baseContext);
    const result = (await caller.getRegionalChoropleth({
      metric: "gdpPerCapita",
      groupBy: "country",
    })) as {
      features: { properties: { rawValue: number; value: number } }[];
    };

    expect(result.features[0]?.properties.rawValue).toBe(50_000);
    expect(result.features[1]?.properties.rawValue).toBe(5_000);
    expect(result.features[0]?.properties.value).toBeGreaterThan(
      result.features[1]?.properties.value ?? 0
    );
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

  it("returns zero for all countries when no sources have counts", () => {
    const scores = computeCanonDensityScores(["A", "B"], {
      storytellerEffect: {},
      diplomaticEvent: {},
      resolvedNationalIssue: {},
      militaryConflict: {},
      storyPin: {},
    });

    expect(scores.get("A")).toBe(0);
    expect(scores.get("B")).toBe(0);
  });
});

describe("getCanonDensity", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns weighted scores and percentile ranks per country", async () => {
    mockDb.country.findMany.mockResolvedValue([
      makeCountry("A"),
      makeCountry("B"),
      makeCountry("C"),
    ]);

    mockDb.storytellerEffect.groupBy.mockResolvedValue([
      makeGroupByResult("countryId", "A", 2),
      makeGroupByResult("countryId", "B", 1),
    ]);
    mockDb.diplomaticEvent.groupBy.mockResolvedValue([makeGroupByResult("country1Id", "B", 3)]);
    mockDb.nationalIssue.groupBy.mockResolvedValue([]);
    mockDb.militaryConflict.groupBy
      .mockResolvedValueOnce([makeConflictRow("initiatorId", "A", 1)])
      .mockResolvedValueOnce([makeConflictRow("defenderId", "C", 2)]);
    mockDb.storyPin.groupBy.mockResolvedValue([makeGroupByResult("countryId", "C", 4)]);

    const caller = createCallerFactory(testRouter)(baseContext);
    const result = (await caller.getCanonDensity()) as {
      features: { properties: { id: string; rawValue: number; value: number } }[];
      metadata: { maxVal: number };
    };

    const byId = new Map(result.features.map((f) => [f.properties.id, f.properties]));

    expect(result.features).toHaveLength(3);
    expect(byId.get("A")?.rawValue).toBe(4);
    expect(byId.get("B")?.rawValue).toBe(4);
    expect(byId.get("C")?.rawValue).toBe(6);

    // C is the highest scorer and should outrank A and B.
    expect(byId.get("C")?.value).toBeGreaterThan(byId.get("A")?.value ?? 1);
    expect(byId.get("C")?.value).toBeGreaterThan(byId.get("B")?.value ?? 1);

    expect(result.metadata.maxVal).toBe(6);
  });
});

describe("getCrisisRiskMap", () => {
  type CrisisRiskResult = {
    riskMap: { features: { properties: { id: string } }[] };
    crisisEvents: {
      features: {
        geometry: { coordinates: [number, number] };
        properties: { id: string; countryName: string };
      }[];
    };
  };

  function makeProfile(countryId: string) {
    return {
      countryId,
      climateDistribution: null,
      elevationProfile: null,
      arableLandPercent: 40,
      coastlineKm: 500,
      isLandlocked: false,
      neighborCount: 3,
      terrainRoughness: 0.2,
      meanElevation: 300,
      country: {
        name: `Country ${countryId}`,
        slug: countryId,
        geometry: { type: "Polygon", coordinates: [[[0, 0]]] },
      },
    };
  }

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

  it("does not issue per-profile findUnique", async () => {
    mockDb.countryGeoProfile.findMany.mockResolvedValue([makeProfile("A"), makeProfile("B")]);
    mockDb.crisisEvent.findMany.mockResolvedValue([]);

    const caller = createCallerFactory(testRouter)(baseContext);
    const result = (await caller.getCrisisRiskMap()) as CrisisRiskResult;

    expect(mockDb.countryGeoProfile.findUnique).not.toHaveBeenCalled();
    expect(mockDb.country.findMany).not.toHaveBeenCalled();
    expect(result.riskMap.features).toHaveLength(2);
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
