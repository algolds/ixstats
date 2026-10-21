import { upsertPeak, upsertNamedRiver, upsertNamedLake } from "~/lib/country-geo/named-features";
import { validatePolygonContainment } from "~/lib/maps/geo-validation";

jest.mock("~/lib/maps/geo-validation", () => ({
  snapPointToCountryBorder: jest.fn((_db, _countryId, lng, lat) => Promise.resolve([lng, lat])),
  validatePointContainment: jest.fn(() => Promise.resolve()),
  validateGeometryBounds: jest.fn(() => {}),
  validatePolygonContainment: jest.fn(() => Promise.resolve()),
}));

jest.mock("~/lib/country-geo/spatial", () => ({
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

      expect(validatePolygonContainment).toHaveBeenCalledWith(
        mockDb,
        countryId,
        inputData.geometry,
        "River"
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

      expect(validatePolygonContainment).toHaveBeenCalledWith(
        mockDb,
        countryId,
        inputData.geometry,
        "Lake"
      );

      expect(result.areaSqKm).toBeGreaterThan(0);
    });
  });
});
