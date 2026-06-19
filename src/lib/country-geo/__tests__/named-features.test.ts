import { upsertPeak, upsertNamedRiver, upsertNamedLake } from "../named-features";

jest.mock("~/lib/geo-validation", () => ({
  snapPointToCountryBorder: jest.fn((_db, _countryId, lng, lat) => Promise.resolve([lng, lat])),
  validatePointContainment: jest.fn(() => Promise.resolve()),
  validateGeometryBounds: jest.fn(() => {}),
}));

jest.mock("../spatial", () => ({
  findSubdivisionAtPoint: jest.fn((_db, _countryId, _lng, _lat) =>
    Promise.resolve({ id: "auto-sub-123", name: "Auto Province" })
  ),
}));

describe("named-features - upsert operations", () => {
  let mockDb: any;
  const countryId = "country-abc";

  beforeEach(() => {
    jest.clearAllMocks();

    mockDb = {
      peak: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      namedRiver: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      namedLake: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      $executeRawUnsafe: jest.fn().mockResolvedValue(1),
    };
  });

  describe("upsertPeak", () => {
    test("creates a new peak with auto-detected subdivision", async () => {
      const inputData = {
        name: "Mount Tall",
        coordinates: [12.34, 56.78],
        elevation: 4500,
        prominence: 1200,
        wikiPageTitle: "Mount_Tall",
      };

      const mockCreated = {
        id: "peak-1",
        countryId,
        subdivisionId: "auto-sub-123",
        name: "Mount Tall",
        coordinates: [12.34, 56.78],
        elevation: 4500,
        prominence: 1200,
        wikiPageTitle: "Mount_Tall",
      };

      mockDb.peak.create.mockResolvedValue(mockCreated);
      mockDb.peak.findUnique.mockResolvedValue(mockCreated);

      const result = await upsertPeak(mockDb, countryId, inputData);

      expect(mockDb.peak.create).toHaveBeenCalledWith({
        data: {
          countryId,
          name: "Mount Tall",
          coordinates: [12.34, 56.78],
          elevation: 4500,
          prominence: 1200,
          subdivisionId: "auto-sub-123", // Auto detected subdivision
          wikiPageTitle: "Mount_Tall",
          status: "approved",
          submittedBy: "owner",
        },
      });

      expect(mockDb.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE peaks SET geom_postgis"),
        12.34,
        56.78,
        "peak-1"
      );

      expect(result).toEqual(mockCreated);
    });

    test("updates existing peak and respects subdivisionId = 'none'", async () => {
      const inputData = {
        id: "peak-existing",
        name: "Mount Tall Updated",
        coordinates: [12.35, 56.79],
        elevation: 4501,
        prominence: 1201,
        subdivisionId: "none",
        wikiPageTitle: "Mount_Tall_Updated",
      };

      const mockExisting = { id: "peak-existing", countryId };
      const mockUpdated = {
        id: "peak-existing",
        countryId,
        subdivisionId: null,
        name: "Mount Tall Updated",
        coordinates: [12.35, 56.79],
        elevation: 4501,
        prominence: 1201,
        wikiPageTitle: "Mount_Tall_Updated",
      };

      mockDb.peak.findFirst.mockResolvedValue(mockExisting);
      mockDb.peak.update.mockResolvedValue(mockUpdated);
      mockDb.peak.findUnique.mockResolvedValue(mockUpdated);

      const result = await upsertPeak(mockDb, countryId, inputData);

      expect(mockDb.peak.findFirst).toHaveBeenCalledWith({
        where: { id: "peak-existing", countryId },
      });

      expect(mockDb.peak.update).toHaveBeenCalledWith({
        where: { id: "peak-existing" },
        data: {
          name: "Mount Tall Updated",
          coordinates: [12.35, 56.79],
          elevation: 4501,
          prominence: 1201,
          subdivisionId: null,
          wikiPageTitle: "Mount_Tall_Updated",
          status: "approved",
        },
      });

      expect(result.subdivisionId).toBeNull();
    });

    test("throws error if updating peak belonging to a different country", async () => {
      const inputData = {
        id: "peak-other",
        name: "Mount Other",
        coordinates: [10, 20],
        elevation: 1000,
      };

      mockDb.peak.findFirst.mockResolvedValue(null);

      await expect(upsertPeak(mockDb, countryId, inputData)).rejects.toThrow(
        "Peak not found or does not belong to this country."
      );
    });
  });

  describe("upsertNamedRiver", () => {
    test("creates a new river and computes its length in Km", async () => {
      const inputData = {
        name: "Blue River",
        geometry: {
          type: "LineString",
          coordinates: [
            [0, 0],
            [1, 1], // Length should be approx 157.4 km using haversine
          ],
        },
        wikiPageTitle: "Blue_River",
      };

      const mockCreated = {
        id: "river-1",
        countryId,
        name: "Blue River",
        geometry: inputData.geometry,
        lengthKm: 157.4,
        wikiPageTitle: "Blue_River",
      };

      mockDb.namedRiver.create.mockResolvedValue(mockCreated);
      mockDb.namedRiver.findUnique.mockResolvedValue(mockCreated);

      const result = await upsertNamedRiver(mockDb, countryId, inputData);

      expect(mockDb.namedRiver.create).toHaveBeenCalledWith({
        data: {
          countryId,
          name: "Blue River",
          geometry: inputData.geometry,
          lengthKm: expect.any(Number),
          wikiPageTitle: "Blue_River",
          status: "approved",
          submittedBy: "owner",
        },
      });

      expect(mockDb.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE named_rivers SET geom_postgis"),
        JSON.stringify(inputData.geometry),
        "river-1"
      );

      expect(result.lengthKm).toBeGreaterThan(0);
    });
  });

  describe("upsertNamedLake", () => {
    test("creates a new lake and computes its area in SqKm", async () => {
      const inputData = {
        name: "Green Lake",
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [0, 0],
              [1, 0],
              [1, 1],
              [0, 1],
              [0, 0],
            ],
          ],
        },
        maxDepthM: 250,
        wikiPageTitle: "Green_Lake",
      };

      const mockCreated = {
        id: "lake-1",
        countryId,
        name: "Green Lake",
        geometry: inputData.geometry,
        areaSqKm: 12345.6,
        maxDepthM: 250,
        wikiPageTitle: "Green_Lake",
      };

      mockDb.namedLake.create.mockResolvedValue(mockCreated);
      mockDb.namedLake.findUnique.mockResolvedValue(mockCreated);

      const result = await upsertNamedLake(mockDb, countryId, inputData);

      expect(mockDb.namedLake.create).toHaveBeenCalledWith({
        data: {
          countryId,
          name: "Green Lake",
          geometry: inputData.geometry,
          areaSqKm: expect.any(Number),
          maxDepthM: 250,
          wikiPageTitle: "Green_Lake",
          status: "approved",
          submittedBy: "owner",
        },
      });

      expect(mockDb.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE named_lakes SET geom_postgis"),
        JSON.stringify(inputData.geometry),
        "lake-1"
      );

      expect(result.areaSqKm).toBeGreaterThan(0);
    });
  });
});
