/** @jest-environment node */
/**
 * Country geography (src/lib/country-geo, src/lib/maps/geographic-resources): a nation's cached outline and metrics
 * from its own realm's regions (unioned in PostGIS by atlas_country_union, a region drawn across +-180 kept beside
 * the union), never wiped by a failed or missing union or by a region without metrics; national figures rolled up
 * and distributed to cities in bounded writes; named features scoped to their country (IDOR) and measured from their
 * geometry; the geo bundle naming the country's realm; a city's border, subdivision, terrain (in the country's realm)
 * and water checks with no NaN distance; geographic resources replaced from the map.
 *
 * Only the PostGIS-backed geo-validation checks are stubbed; every other step runs for real against a fake db whose
 * raw queries are answered by what they ask for.
 *
 * Folds: src/tests/lib/country-geo-service.test.ts, src/tests/lib/country-geo/base-layer-query.test.ts,
 * src/tests/lib/country-geo/bundle.test.ts, src/tests/lib/country-geo/named-features.test.ts,
 * src/tests/lib/country-geo/spatial.test.ts, src/tests/lib/country-geo/sync-union.test.ts,
 * src/tests/lib/country-geo/sync.test.ts, src/tests/lib/country-geo/upsert-city.test.ts,
 * src/tests/lib/maps/geographic-resources.test.ts
 */
jest.mock("~/lib/maps/geo-validation", () => ({
  ...jest.requireActual<typeof import("~/lib/maps/geo-validation")>("~/lib/maps/geo-validation"),
  snapPointToCountryBorder: jest.fn(async (_db: object, _id: string, lng: number, lat: number) => [
    lng,
    lat,
  ]),
  validatePointContainment: jest.fn().mockResolvedValue(undefined),
  validatePolygonContainment: jest.fn().mockResolvedValue(undefined),
}));

import {
  getCountryGeoBundle,
  rebaseNationalFromGeography,
  syncCountryGeometryFromMapLayer,
  syncGeographicDemographics,
  upsertCity,
  upsertNamedLake,
  upsertNamedRiver,
  upsertPeak,
} from "~/lib/country-geo";
import { refreshGeographicResources } from "~/lib/maps/geographic-resources";
import { snapPointToCountryBorder, validatePointContainment } from "~/lib/maps/geo-validation";

beforeEach(() => jest.clearAllMocks());

const square = (x: number, y: number) => ({
  type: "Polygon" as const,
  coordinates: [
    [
      [x, y],
      [x + 1, y],
      [x + 1, y + 1],
      [x, y + 1],
      [x, y],
    ],
  ],
});

describe("a nation's outline and metrics from its linked regions", () => {
  const region = (areaSqKm: number | null, centroid: number[] | null, box: number[] | null) => ({
    centroid,
    boundingBox: box,
    areaSqKm,
  });
  /** What atlas_country_union returns, as the driver hands the row back. */
  const unionOf = (geometry: object | null, wide: object[] | null = null) => [
    { result: { geometry, wide } },
  ];

  function dbWith(unionRows: object[], regions: object[]) {
    return {
      // the once-per-process probe for atlas_country_union: present
      $queryRaw: jest.fn().mockResolvedValue([{ present: true }]),
      $queryRawUnsafe: jest.fn().mockResolvedValue(unionRows),
      mapLayer: { findMany: jest.fn().mockResolvedValue(regions) },
      country: {
        findUnique: jest.fn().mockResolvedValue({ realmId: "r_eurth" }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
  }

  it("unions the nation's regions of its own realm once, keeps a region drawn across +-180 beside it, and sums the metrics", async () => {
    const wide = square(170, 0);
    const db = dbWith(unionOf(square(0, 0), [wide]), [
      region(3000, [0.5, 0.5], [0, 0, 1, 1]),
      region(1000, [170.5, 0.5], [170, 0, 171, 1]),
    ]);
    await syncCountryGeometryFromMapLayer(db, "c1");

    expect(db.mapLayer.findMany.mock.calls[0][0].where).toEqual({
      layerType: "political",
      countryId: "c1",
      isActive: true,
      realmId: "r_eurth",
    });
    expect(db.$queryRawUnsafe).toHaveBeenCalledTimes(1);
    expect(db.$queryRawUnsafe.mock.calls[0].slice(1)).toEqual(["c1", "r_eurth"]);
    expect(db.country.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: {
        geometry: {
          type: "MultiPolygon",
          coordinates: [square(0, 0).coordinates, wide.coordinates],
        },
        centroid: [43, 0.5],
        boundingBox: [0, 0, 171, 1],
        landArea: 4000,
        areaSqMi: 4000 * 0.386102,
      },
    });
  });

  /** A fresh copy of the sync module, so its once-per-process probe for atlas_country_union starts unanswered. */
  async function freshSync() {
    let loaded: typeof import("~/lib/country-geo/sync") | undefined;
    await jest.isolateModulesAsync(async () => {
      loaded = await import("~/lib/country-geo/sync");
    });
    if (!loaded) throw new Error("the sync module did not load");
    return loaded.syncCountryGeometryFromMapLayer;
  }

  it.each([
    {
      name: "a union the database could not compute (NULL) and a region imported without metrics leave its outline, centre, box and stated land area",
      union: [{ result: null }],
      regions: [region(null, null, null)],
      unionFunction: true,
      unionCalls: 1,
      data: {},
    },
    {
      // asking a missing function inside a caller's transaction would abort it
      name: "a database without atlas_country_union (the R0 SQL not applied) is never asked for one, and the outline stays",
      union: unionOf(square(0, 0)),
      regions: [region(2000, [0.5, 0.5], [0, 0, 1, 1])],
      unionFunction: false,
      unionCalls: 0,
      data: {
        centroid: [0.5, 0.5],
        boundingBox: [0, 0, 1, 1],
        landArea: 2000,
        areaSqMi: 2000 * 0.386102,
      },
    },
    {
      name: "a nation drawn only across +-180 keeps the geometry it was stored with",
      union: unionOf(null, [square(170, 0)]),
      regions: [region(2000, [170.5, 0.5], null)],
      unionFunction: true,
      unionCalls: 1,
      data: {
        geometry: square(170, 0),
        centroid: [170.5, 0.5],
        landArea: 2000,
        areaSqMi: 2000 * 0.386102,
      },
    },
  ])(
    "never wipes what the country has: $name",
    async ({ union, regions, unionFunction, unionCalls, data }) => {
      const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
      const db = dbWith(union, regions);
      db.$queryRaw.mockResolvedValue([{ present: unionFunction }]);
      const sync = unionFunction ? syncCountryGeometryFromMapLayer : await freshSync();

      await sync(db, "c1");

      expect(db.$queryRawUnsafe).toHaveBeenCalledTimes(unionCalls);
      expect(db.country.update).toHaveBeenCalledWith({ where: { id: "c1" }, data });
      warn.mockRestore();
    }
  );
});

describe("national figures and city demographics", () => {
  it("a bottom-up nation without subdivisions keeps its national figures (the urban city total never replaces them)", async () => {
    const db = {
      country: {
        findUnique: jest.fn().mockResolvedValue({ geoRollupMode: "bottom-up" }),
        update: jest.fn().mockResolvedValue({}),
      },
      subdivision: {
        aggregate: jest
          .fn()
          .mockResolvedValue({ _sum: { population: null, gdpContribution: null } }),
      },
      city: {
        aggregate: jest
          .fn()
          .mockResolvedValue({ _sum: { population: 5_000, gdpContribution: 9_000 } }),
      },
    };
    await syncGeographicDemographics(db, "c1");
    expect(db.country.update).not.toHaveBeenCalled();
    expect(db.city.aggregate).not.toHaveBeenCalled();
  });

  /** A nation of 1M people and 10B GDP with a 2B budget; its subdivisions sum to 2M people and 30B. */
  const rebaseDb = (geoRollupMode = "bottom-up") => ({
    country: {
      findUnique: jest.fn().mockResolvedValue({
        geoRollupMode,
        currentPopulation: 1_000_000,
        currentTotalGdp: 10_000_000_000,
        totalWorkforce: 600_000,
        landArea: 1_000,
      }),
      update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: "c1", ...data })),
    },
    subdivision: {
      aggregate: jest
        .fn()
        .mockResolvedValue({ _sum: { population: 2_000_000, gdpContribution: 30_000_000_000 } }),
    },
    city: { aggregate: jest.fn() },
    governmentStructure: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    budgetAllocation: {
      findFirst: jest.fn().mockResolvedValue({ budgetYear: 2042 }),
      updateMany: jest.fn().mockResolvedValue({ count: 3 }),
    },
  });

  it.each([
    [
      "the bottom-up rollup",
      (db: ReturnType<typeof rebaseDb>) => syncGeographicDemographics(db, "c1"),
    ],
    [
      "rebase from the map",
      (db: ReturnType<typeof rebaseDb>) => rebaseNationalFromGeography(db, "c1"),
    ],
  ])(
    "%s sets the baseline (so the projection keeps it) and moves the budget with the GDP",
    async (_name, run) => {
      const db = rebaseDb();
      await run(db);
      const data = db.country.update.mock.calls[0]![0].data;
      expect(data).toMatchObject({
        baselinePopulation: 2_000_000,
        baselineGdpPerCapita: 15_000,
        currentPopulation: 2_000_000,
        currentTotalGdp: 30_000_000_000,
        totalWorkforce: 1_200_000,
      });
      expect(data.baselineDate).toBeInstanceOf(Date);
      expect(db.governmentStructure.updateMany).toHaveBeenCalledWith({
        where: { countryId: "c1" },
        data: { totalBudget: { multiply: 3 } },
      });
      expect(db.budgetAllocation.updateMany).toHaveBeenCalledWith({
        where: { governmentStructure: { countryId: "c1" }, budgetYear: 2042 },
        data: { allocatedAmount: { multiply: 3 }, availableAmount: { multiply: 3 } },
      });
    }
  );

  it("a hybrid nation's figures are left alone by the rollup", async () => {
    const db = rebaseDb("hybrid");
    await syncGeographicDemographics(db, "c1");
    expect(db.country.update).not.toHaveBeenCalled();
    expect(db.governmentStructure.updateMany).not.toHaveBeenCalled();
  });
});

describe("named features", () => {
  function featureDb() {
    const model = () => ({
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => ({ id: where.id })),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: "new-1",
        ...data,
      })),
      update: jest.fn(),
    });
    return {
      peak: model(),
      namedRiver: model(),
      namedLake: model(),
      $queryRawUnsafe: jest.fn().mockResolvedValue([]),
      $executeRawUnsafe: jest.fn().mockResolvedValue(1),
    };
  }

  it("refuses to update another country's peak and writes nothing", async () => {
    const db = featureDb();
    await expect(
      upsertPeak(db, "country-abc", {
        id: "peak-other",
        name: "Mount Other",
        coordinates: [10, 20],
        elevation: 1000,
      })
    ).rejects.toThrow("Peak not found or does not belong to this country.");
    expect(db.peak.findFirst).toHaveBeenCalledWith({
      where: { id: "peak-other", countryId: "country-abc" },
    });
    expect(db.peak.update).not.toHaveBeenCalled();
    expect(db.peak.create).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: "a river's length",
      upsert: upsertNamedRiver,
      model: "namedRiver" as const,
      geometry: {
        type: "LineString",
        coordinates: [
          [0, 0],
          [1, 1],
        ],
      },
      field: "lengthKm",
      expected: 157.25,
    },
    {
      name: "a lake's area",
      upsert: upsertNamedLake,
      model: "namedLake" as const,
      geometry: square(0, 0),
      field: "areaSqKm",
      expected: 12391.84,
    },
  ])(
    "records $name measured from its geometry",
    async ({ upsert, model, geometry, field, expected }) => {
      const db = featureDb();
      await upsert(db, "country-abc", { name: "Feature", geometry });
      const { data } = db[model].create.mock.calls[0][0];
      expect(data).toMatchObject({ countryId: "country-abc", geometry, status: "approved" });
      expect(data[field]).toBeCloseTo(expected, 1);
    }
  );
});

describe("getCountryGeoBundle", () => {
  it.each([
    {
      name: "its realm's slug",
      realm: { realmId: "r_eurth", realm: { slug: "eurth" } },
      slug: "eurth",
    },
    {
      name: "Ixnay's slug for a country of Ixnay, whose realm row may not be there",
      realm: { realmId: "default", realm: null },
      slug: "ixnay",
    },
  ])("names the country's own realm: $name", async ({ realm, slug }) => {
    const db = {
      country: {
        findUnique: jest.fn().mockResolvedValue({
          ...realm,
          id: "c1",
          name: "Caphiria",
          slug: "caphiria",
          geoRollupMode: "hybrid",
        }),
      },
      mapLayer: {
        findFirst: jest.fn().mockResolvedValue({
          id: "ml1",
          featureId: "Caphiria",
          displayName: "Caphiria",
          geometry: square(1, 1),
        }),
      },
      subdivision: { findMany: jest.fn().mockResolvedValue([]) },
      city: { findMany: jest.fn().mockResolvedValue([]) },
      pointOfInterest: { findMany: jest.fn().mockResolvedValue([]) },
      storyPin: { findMany: jest.fn().mockResolvedValue([]) },
      mapLabel: { findMany: jest.fn().mockResolvedValue([]) },
      countryGeoProfile: { findUnique: jest.fn().mockResolvedValue(null) },
      $queryRawUnsafe: jest.fn().mockResolvedValue([]),
    };
    const bundle = await getCountryGeoBundle(db, "c1");
    expect(bundle.country.realmSlug).toBe(slug);
  });
});

describe("upsertCity", () => {
  /** Answers each raw query by what it asks for: the covering subdivision, the terrain, the climate, the water. */
  function rawAnswer(sql: string) {
    if (sql.includes("'altitudes'")) {
      const band = (zoneId: string, elevationMin: number, elevationMax: number) => ({
        layerType: "altitudes",
        featureId: zoneId,
        properties: { zoneId, zoneName: zoneId, elevationMin, elevationMax, fill: "#000" },
      });
      // overlapping bands: the highest wins, not the first row
      return [band("lowland", 0, 500), band("alpine", 2000, 3000)];
    }
    if (sql.includes("FROM subdivisions")) return [{ id: "sub-north", name: "North" }];
    if (sql.includes("lt(layer)")) return [{ type: "rivers", distance: 3.456 }];
    return [];
  }

  function cityDb() {
    const city = { id: "city1", name: "Port", subdivisionId: "sub-north", coordinates: [1, 2] };
    return {
      city: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(city),
        findUnique: jest.fn().mockResolvedValue(city),
        update: jest.fn().mockResolvedValue(city),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        aggregate: jest.fn().mockResolvedValue({ _sum: { population: 0, gdpContribution: 0 } }),
      },
      subdivision: { update: jest.fn().mockResolvedValue({}) },
      country: {
        findUnique: jest.fn().mockResolvedValue({ realmId: "r_eurth", geoRollupMode: "hybrid" }),
      },
      nationalIdentity: { upsert: jest.fn().mockResolvedValue({}) },
      policy: { create: jest.fn().mockResolvedValue({}) },
      $queryRawUnsafe: jest.fn(async (sql: string) => rawAnswer(sql)),
      $executeRawUnsafe: jest.fn().mockResolvedValue(1),
    };
  }

  it("a new city is checked against the border, placed in its subdivision, given its elevation from the country's realm, and its water access has no NaN", async () => {
    const db = cityDb();
    await upsertCity(db, "k1", { name: "Port", coordinates: [1, 2] });

    expect(snapPointToCountryBorder).toHaveBeenCalledWith(db, "k1", 1, 2);
    expect(validatePointContainment).toHaveBeenCalledWith(db, "k1", 1, 2, "City");
    expect(db.city.create.mock.calls[0][0].data).toMatchObject({
      countryId: "k1",
      subdivisionId: "sub-north",
      elevation: 2500,
    });
    const terrain = db.$queryRawUnsafe.mock.calls.find(([sql]) => sql.includes("'altitudes'"));
    expect(terrain?.slice(1)).toEqual([1, 2, "r_eurth"]);
    // the realm has no lake: 9999 km, not NaN
    expect(db.city.update.mock.calls[0][0].data.waterAccess).toEqual({
      nearRiver: true,
      nearLake: false,
      riverDistanceKm: 3.46,
      lakeDistanceKm: 9999,
    });
  });
});

describe("refreshGeographicResources", () => {
  function resourceDb(geometry: object | null) {
    const rowsFor = (sql: string) => {
      if (sql.includes("'rivers'")) return [{ name: "Vel", size: 300, lng: 1.23456, lat: 2 }];
      if (sql.includes("'lakes'") || sql.includes("'climate'")) return [];
      return [{ lng: 5, lat: 6, areaSqKm: 50_000 }];
    };
    return {
      country: {
        findUnique: jest.fn(async () =>
          geometry ? { name: "Aurelia", coastlineKm: 400, landArea: 1, geometry } : null
        ),
      },
      $queryRawUnsafe: jest.fn(async (sql: string, _countryId: string) => rowsFor(sql)),
      geographicResource: {
        deleteMany: jest.fn((args: object) => ({ op: "deleteMany", args })),
        createMany: jest.fn((args: object) => ({ op: "createMany", args })),
      },
      $transaction: jest.fn(async (ops: unknown[]) => ops),
    };
  }

  it.each([
    {
      name: "replaces the country's resources with those its mapped geography shows",
      geometry: { type: "Polygon", coordinates: [] },
      rows: [
        {
          countryId: "c1",
          resourceType: "freshwater",
          name: "Vel",
          coordinates: [1.2346, 2],
          quantity: 0.3,
          climateZone: null,
        },
        {
          countryId: "c1",
          resourceType: "fishery",
          name: "Aurelia coastal waters",
          coordinates: [5, 6],
          quantity: 0.2,
          climateZone: null,
        },
      ],
    },
    { name: "clears the resources of a country without geometry", geometry: null, rows: [] },
  ])("$name", async ({ geometry, rows }) => {
    const db = resourceDb(geometry);
    expect(await refreshGeographicResources(db as never, "c1")).toBe(rows.length);
    expect(db.geographicResource.deleteMany).toHaveBeenCalledWith({ where: { countryId: "c1" } });
    expect(db.geographicResource.createMany).toHaveBeenCalledWith({ data: rows });
    // every PostGIS query is scoped to the country by parameter
    const scopes = db.$queryRawUnsafe.mock.calls.map((call) => call[1]);
    expect(scopes).toEqual(scopes.map(() => "c1"));
  });
});
