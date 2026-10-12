import {
  updateGeoRollupMode,
  rebaseNationalFromGeography,
  getCountryGeoBundle,
  syncGeographicDemographics,
  distributeSubdivisionDemographicsToCities,
} from "~/lib/country-geo";

describe("country-geo-service - Rollups & Reconciliation", () => {
  let mockDb: any;
  const countryId = "test-country-123";

  beforeEach(() => {
    mockDb = {
      country: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      subdivision: {
        findMany: jest.fn(),
        update: jest.fn(),
        aggregate: jest.fn(),
      },
      city: {
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        aggregate: jest.fn(),
      },
      mapLayer: {
        findFirst: jest.fn(),
      },
      countryGeoProfile: {
        findUnique: jest.fn(),
      },
      pointOfInterest: {
        findMany: jest.fn(),
      },
      storyPin: {
        findMany: jest.fn(),
      },
      mapLabel: {
        findMany: jest.fn(),
      },
      $queryRaw: jest.fn(),
      $queryRawUnsafe: jest.fn().mockResolvedValue([]),
      $executeRawUnsafe: jest.fn().mockResolvedValue(0),
      $transaction: jest.fn(async (operations: Promise<unknown>[]) => Promise.all(operations)),
    };
  });

  describe("updateGeoRollupMode", () => {
    it("should update country rollup mode", async () => {
      mockDb.country.update.mockResolvedValue({ id: countryId, geoRollupMode: "bottom-up" });
      mockDb.country.findUnique.mockResolvedValue({ id: countryId, geoRollupMode: "bottom-up" });
      mockDb.subdivision.aggregate.mockResolvedValue({
        _sum: { population: 100000, gdpContribution: 500000 },
      });

      await updateGeoRollupMode(mockDb, countryId, "bottom-up");

      expect(mockDb.country.update).toHaveBeenCalledWith({
        where: { id: countryId },
        data: { geoRollupMode: "bottom-up" },
      });
    });

    it("should throw error for invalid mode", async () => {
      await expect(updateGeoRollupMode(mockDb, countryId, "invalid-mode")).rejects.toThrow(
        "Invalid rollup mode: invalid-mode"
      );
    });
  });

  describe("rebaseNationalFromGeography", () => {
    it("should update national baseline stats using subdivisions sum", async () => {
      mockDb.subdivision.aggregate.mockResolvedValue({
        _sum: { population: 200000, gdpContribution: 600000 },
      });
      mockDb.country.update.mockResolvedValue({ id: countryId });

      await rebaseNationalFromGeography(mockDb, countryId);

      expect(mockDb.country.update).toHaveBeenCalledWith({
        where: { id: countryId },
        data: {
          currentPopulation: 200000,
          currentTotalGdp: 600000,
          currentGdpPerCapita: 3,
        },
      });
    });

    it("should fallback to cities if subdivisions sums are 0", async () => {
      mockDb.subdivision.aggregate.mockResolvedValue({
        _sum: { population: null, gdpContribution: null },
      });
      mockDb.city.aggregate.mockResolvedValue({
        _sum: { population: 150000, gdpContribution: 450000 },
      });
      mockDb.country.update.mockResolvedValue({ id: countryId });

      await rebaseNationalFromGeography(mockDb, countryId);

      expect(mockDb.city.aggregate).toHaveBeenCalled();
      expect(mockDb.country.update).toHaveBeenCalledWith({
        where: { id: countryId },
        data: {
          currentPopulation: 150000,
          currentTotalGdp: 450000,
          currentGdpPerCapita: 3,
        },
      });
    });

    it("should throw if calculated population is 0 or negative", async () => {
      mockDb.subdivision.aggregate.mockResolvedValue({
        _sum: { population: 0, gdpContribution: 0 },
      });
      mockDb.city.aggregate.mockResolvedValue({
        _sum: { population: 0, gdpContribution: 0 },
      });

      await expect(rebaseNationalFromGeography(mockDb, countryId)).rejects.toThrow(
        "Cannot rebase: geographic population must be greater than zero."
      );
    });
  });

  describe("syncGeographicDemographics", () => {
    it("should update subdivision demographics from child cities sum", async () => {
      mockDb.city.aggregate.mockResolvedValue({
        _sum: { population: 80000, gdpContribution: 240000 },
      });
      mockDb.country.findUnique.mockResolvedValue({ id: countryId, geoRollupMode: "hybrid" });

      await syncGeographicDemographics(mockDb, countryId, "subdiv-1");

      expect(mockDb.subdivision.update).toHaveBeenCalledWith({
        where: { id: "subdiv-1" },
        data: {
          population: 80000,
          gdpContribution: 240000,
        },
      });
      // Should NOT update country in hybrid mode
      expect(mockDb.country.update).not.toHaveBeenCalled();
    });

    it("should automatically sync country in bottom-up mode", async () => {
      mockDb.city.aggregate.mockResolvedValue({
        _sum: { population: 80000, gdpContribution: 240000 },
      });
      mockDb.subdivision.aggregate.mockResolvedValue({
        _sum: { population: 80000, gdpContribution: 240000 },
      });
      mockDb.country.findUnique.mockResolvedValue({ id: countryId, geoRollupMode: "bottom-up" });

      await syncGeographicDemographics(mockDb, countryId, "subdiv-1");

      expect(mockDb.country.update).toHaveBeenCalledWith({
        where: { id: countryId },
        data: {
          currentPopulation: 80000,
          currentTotalGdp: 240000,
          currentGdpPerCapita: 3,
        },
      });
    });
  });

  describe("getCountryGeoBundle top-down scaling", () => {
    it("should scale subdivision and city populations dynamically in top-down mode", async () => {
      // Setup mock return values
      mockDb.country.findUnique.mockResolvedValue({
        id: countryId,
        name: "Test Country",
        slug: "test-country",
        geoRollupMode: "top-down",
        currentPopulation: 100000,
        currentTotalGdp: 300000,
      });
      mockDb.mapLayer.findFirst.mockResolvedValue({
        geometry: {},
        centroid: {},
        boundingBox: {},
        areaSqKm: 500,
      });
      mockDb.subdivision.findMany.mockResolvedValue([
        { id: "s1", name: "Sub 1", population: 50000, gdpContribution: 150000 },
      ]);
      // City s1 has population 20000 (which is 40% of geo population sum)
      // City s2 has explicit populationShare of 10%
      mockDb.city.findMany.mockResolvedValue([
        {
          id: "c1",
          name: "City 1",
          population: 40000,
          gdpContribution: 120000,
          populationShare: null,
        },
        {
          id: "c2",
          name: "City 2",
          population: 10000,
          gdpContribution: 30000,
          populationShare: 10,
        },
      ]);
      mockDb.pointOfInterest.findMany.mockResolvedValue([]);
      mockDb.storyPin.findMany.mockResolvedValue([]);
      mockDb.mapLabel.findMany.mockResolvedValue([]);

      const bundle = await getCountryGeoBundle(mockDb, countryId);

      // Total geo population sum = 50000 (subdivision sum), 50000 (city sum)
      // Scale factor for subdivision = 100000 / 50000 = 2
      // Scale factor for city = 100000 / 50000 = 2
      expect(bundle.subdivisions[0].population).toBe(100000);
      expect(bundle.subdivisions[0].gdpContribution).toBe(300000);

      // City 1 is scaled proportionally: 40000 * 2 = 80000
      expect(bundle.cities[0].population).toBe(80000);

      // City 2 has explicit populationShare of 10%: 100000 * 0.10 = 10000
      expect(bundle.cities[1].population).toBe(10000);

      // Coverage should evaluate to 1.0 (100%) in top-down mode
      expect(bundle.rollups.populationCoverage).toBe(1.0);
      expect(bundle.rollups.gdpCoverage).toBe(1.0);
    });
  });

  describe("distributeSubdivisionDemographicsToCities", () => {
    /** The rows written by the batched UPDATE statements, in order: one `{ id, population, gdp }` each. */
    function writtenCityRows(): Array<{ id: string; population: number; gdp: number }> {
      return mockDb.$executeRawUnsafe.mock.calls.flatMap(
        ([, ids, populations, gdps]: [string, string[], number[], number[]]) =>
          ids.map((id, n) => ({ id, population: populations[n], gdp: gdps[n] }))
      );
    }

    it("should distribute proportionally using existing populations when scaleExisting is true", async () => {
      mockDb.subdivision.findMany.mockResolvedValue([
        { id: "sub-1", name: "Province 1", population: 100000, gdpContribution: 500000 },
      ]);
      mockDb.city.findMany.mockResolvedValue([
        {
          id: "city-1",
          name: "City 1",
          population: 3000,
          gdpContribution: 10000,
          subdivisionId: "sub-1",
        },
        {
          id: "city-2",
          name: "City 2",
          population: 7000,
          gdpContribution: 20000,
          subdivisionId: "sub-1",
        },
      ]);

      const result = await distributeSubdivisionDemographicsToCities(mockDb, countryId, true);

      expect(result.success).toBe(true);
      expect(result.totalCitiesUpdated).toBe(2);

      expect(writtenCityRows()).toEqual([
        { id: "city-1", population: 30000, gdp: 150000 },
        { id: "city-2", population: 70000, gdp: 350000 },
      ]);
    });

    it("should distribute by category weights when scaleExisting is false", async () => {
      mockDb.subdivision.findMany.mockResolvedValue([
        {
          id: "sub-1",
          name: "Province 1",
          population: 100000,
          gdpContribution: 500000,
          capital: "City 1",
        },
      ]);
      mockDb.city.findMany.mockResolvedValue([
        {
          id: "city-1",
          name: "City 1",
          population: 0,
          gdpContribution: 0,
          subdivisionId: "sub-1",
          isSubdivisionCapital: true,
        },
        {
          id: "city-2",
          name: "City 2",
          population: 0,
          gdpContribution: 0,
          subdivisionId: "sub-1",
          type: "town",
        },
      ]);

      const result = await distributeSubdivisionDemographicsToCities(mockDb, countryId, false);

      expect(result.success).toBe(true);
      expect(writtenCityRows()).toEqual([
        { id: "city-1", population: 85714, gdp: 428570 },
        { id: "city-2", population: 14286, gdp: 71430 },
      ]);
    });

    it("reads the cities of every subdivision in one query and writes them in one transaction", async () => {
      const subs = ["a", "b", "c"].map((id) => ({
        id,
        name: id,
        population: 1000,
        gdpContribution: 5000,
      }));
      mockDb.subdivision.findMany.mockResolvedValue(subs);
      mockDb.city.findMany.mockResolvedValue(
        subs.flatMap((sub) =>
          [1, 2].map((n) => ({
            id: `${sub.id}${n}`,
            name: `${sub.id}${n}`,
            population: 10,
            subdivisionId: sub.id,
          }))
        )
      );

      const result = await distributeSubdivisionDemographicsToCities(mockDb, countryId, true);

      expect(result.totalCitiesUpdated).toBe(6);
      expect(mockDb.city.findMany).toHaveBeenCalledTimes(1);
      expect(mockDb.city.findMany.mock.calls[0][0].where).toMatchObject({
        countryId,
        status: "approved",
        subdivisionId: { in: ["a", "b", "c"] },
      });
      expect(mockDb.city.update).not.toHaveBeenCalled();
      expect(mockDb.$transaction).toHaveBeenCalledTimes(1);
      expect(mockDb.$executeRawUnsafe).toHaveBeenCalledTimes(1);
      expect(writtenCityRows().map((row) => row.population)).toEqual([
        500, 500, 500, 500, 500, 500,
      ]);
    });

    it("writes a large country in bounded statements inside the one transaction", async () => {
      mockDb.subdivision.findMany.mockResolvedValue([
        { id: "big", name: "big", population: 1_200_000, gdpContribution: 0 },
      ]);
      mockDb.city.findMany.mockResolvedValue(
        Array.from({ length: 1201 }, (_, n) => ({
          id: `city-${n}`,
          name: `city ${n}`,
          population: 1,
          subdivisionId: "big",
        }))
      );

      await distributeSubdivisionDemographicsToCities(mockDb, countryId, true);

      expect(mockDb.$transaction).toHaveBeenCalledTimes(1);
      expect(mockDb.$transaction.mock.calls[0][0]).toHaveLength(3);
      expect(
        mockDb.$executeRawUnsafe.mock.calls.map((call: unknown[][]) => call[1].length)
      ).toEqual([500, 500, 201]);
    });

    it("skips subdivisions with no population or no cities, and writes nothing when nothing changes", async () => {
      mockDb.subdivision.findMany.mockResolvedValue([
        { id: "empty", name: "empty", population: 0, gdpContribution: 0 },
        { id: "cityless", name: "cityless", population: 100, gdpContribution: 0 },
      ]);
      mockDb.city.findMany.mockResolvedValue([]);

      const result = await distributeSubdivisionDemographicsToCities(mockDb, countryId, true);

      expect(result).toEqual({ success: true, totalCitiesUpdated: 0 });
      expect(mockDb.$transaction).not.toHaveBeenCalled();
    });
  });
});
