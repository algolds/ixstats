jest.mock("~/lib/country-geo/spatial", () => ({
  findSubdivisionAtPoint: jest.fn().mockResolvedValue({ id: "sub-found" }),
  updateCitySpatialProfile: jest.fn().mockResolvedValue(null),
  updateSubdivisionSpatialProfile: jest.fn(),
  alignSubdivisionBorders: jest.fn(),
}));
jest.mock("~/lib/country-geo/policy", () => ({
  triggerGeographyPolicy: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("~/lib/country-geo/sync", () => ({
  recalculateLargestCity: jest.fn().mockResolvedValue(undefined),
  syncGeographicDemographics: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("~/lib/country-geo/base-layer-query", () => ({
  getTerrainAtPoint: jest.fn().mockResolvedValue({ elevationZone: null }),
}));
jest.mock("~/lib/maps/geo-validation", () => ({
  snapPointToCountryBorder: jest.fn(async (_db: object, _id: string, lng: number, lat: number) => [
    lng,
    lat,
  ]),
  validatePointContainment: jest.fn().mockResolvedValue(undefined),
}));

import { upsertCity } from "~/lib/country-geo/upsert";
import { findSubdivisionAtPoint, updateCitySpatialProfile } from "~/lib/country-geo/spatial";
import { snapPointToCountryBorder, validatePointContainment } from "~/lib/maps/geo-validation";

function makeDb() {
  const city = { id: "city1", name: "Port", subdivisionId: null, coordinates: [1, 2] };
  return {
    city: {
      findFirst: jest.fn().mockResolvedValue(null),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      create: jest.fn().mockResolvedValue(city),
      findUnique: jest.fn().mockResolvedValue(city),
    },
    country: { findUnique: jest.fn().mockResolvedValue({ realmId: "default" }) },
    nationalIdentity: { upsert: jest.fn().mockResolvedValue({}) },
    $executeRawUnsafe: jest.fn().mockResolvedValue(0),
  };
}

const row = (over: object = {}) => ({ name: "Port", coordinates: [1, 2], elevation: 5, ...over });
const water = { riverKm: 3, lakeKm: 40 };

beforeEach(() => jest.clearAllMocks());

describe("upsertCity with the import batch's lookup", () => {
  it("trusts a point the batch found inside the border: no per-city containment, subdivision or water query", async () => {
    const db = makeDb();
    await upsertCity(db, "k1", row(), { inside: true, subdivisionId: "sub1", water });

    expect(snapPointToCountryBorder).not.toHaveBeenCalled();
    expect(validatePointContainment).not.toHaveBeenCalled();
    expect(findSubdivisionAtPoint).not.toHaveBeenCalled();
    expect(db.city.create.mock.calls[0][0].data.subdivisionId).toBe("sub1");
    expect(updateCitySpatialProfile).toHaveBeenCalledWith(db, "city1", water);
  });

  it("leaves a city with no covering subdivision without one", async () => {
    const db = makeDb();
    await upsertCity(db, "k1", row(), { inside: true, subdivisionId: null, water });

    expect(db.city.create.mock.calls[0][0].data.subdivisionId).toBeNull();
  });

  it("still honours a subdivision the row names, and 'none'", async () => {
    const named = makeDb();
    await upsertCity(named, "k1", row({ subdivisionId: "chosen" }), {
      inside: true,
      subdivisionId: "sub1",
      water,
    });
    expect(named.city.create.mock.calls[0][0].data.subdivisionId).toBe("chosen");

    const none = makeDb();
    await upsertCity(none, "k1", row({ subdivisionId: "none" }), {
      inside: true,
      subdivisionId: "sub1",
      water,
    });
    expect(none.city.create.mock.calls[0][0].data.subdivisionId).toBeNull();
  });

  it("measures water itself when the batch could not", async () => {
    const db = makeDb();
    await upsertCity(db, "k1", row(), { inside: true, subdivisionId: null, water: null });

    expect(updateCitySpatialProfile).toHaveBeenCalledWith(db, "city1", undefined);
  });

  it.each([
    ["no lookup", undefined],
    ["a point whose border is unknown", { inside: null, subdivisionId: null, water }],
  ])("checks the border, subdivision and water per city with %s", async (_label, lookup) => {
    const db = makeDb();
    await upsertCity(db, "k1", row(), lookup);

    expect(snapPointToCountryBorder).toHaveBeenCalledTimes(1);
    expect(validatePointContainment).toHaveBeenCalledTimes(1);
    expect(findSubdivisionAtPoint).toHaveBeenCalledTimes(1);
    expect(db.city.create.mock.calls[0][0].data.subdivisionId).toBe("sub-found");
    expect(updateCitySpatialProfile).toHaveBeenCalledWith(db, "city1", undefined);
  });
});
