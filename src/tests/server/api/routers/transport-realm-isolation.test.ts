import { transportRouteMutationsRouter } from "~/server/api/routers/transport/routeMutations";
import { CALLER_COUNTRY, createIdorContext } from "~/tests/helpers/country-idor-context";

jest.mock("~/server/shared/transport-sync", () => ({
  syncTransportEconomicModifiers: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("~/server/shared/geo-resource-sync", () => ({
  syncResourcePoolModifiers: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("~/lib/economy/transport-generator", () => ({
  estimateCoastalCities: jest.fn((cities: unknown) => cities),
  generateTransportNetwork: jest.fn(() => [
    {
      routeType: "rail",
      name: "A–B Rail",
      geometry: { type: "LineString", coordinates: [] },
      stops: [{ cityId: "city_a" }, { cityId: "city_b" }],
      properties: {},
      isInternational: false,
      terrainDifficulty: 0.2,
      lengthKm: 10,
    },
  ]),
}));

const EURTH = "realm_eurth";

function realmDb() {
  return {
    transportRoute: {
      create: jest.fn(async ({ data }: { data: object }) => ({ id: "route_new", ...data })),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    transportHub: { create: jest.fn().mockResolvedValue({}) },
    pointOfInterest: { findMany: jest.fn().mockResolvedValue([]) },
    countryGeoProfile: { findUnique: jest.fn().mockResolvedValue(null) },
  };
}

function eurthCaller(db: ReturnType<typeof realmDb>) {
  const ctx = createIdorContext(db);
  ctx.db.country.findUnique = jest.fn(async ({ where }: { where: { id: string } }) => ({
    id: where.id,
    name: "Eurthland",
    realmId: EURTH,
    boundingBox: [0, 0, 1, 1],
    coastlineKm: 0,
    cities: [
      { id: "city_a", name: "A", coordinates: [0, 0], population: 1, isNationalCapital: true },
      { id: "city_b", name: "B", coordinates: [1, 1], population: 1, isNationalCapital: false },
    ],
  }));
  return transportRouteMutationsRouter.createCaller(ctx);
}

describe("AT-1: transport rows carry the owning country's realm", () => {
  it("generateRoutes saves routes and hubs in the country's realm", async () => {
    const db = realmDb();
    await eurthCaller(db).generateRoutes({ countryId: CALLER_COUNTRY });

    expect(db.transportRoute.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ realmId: EURTH }) })
    );
    expect(db.transportHub.create).toHaveBeenCalledTimes(2);
    for (const [arg] of db.transportHub.create.mock.calls) {
      expect(arg).toMatchObject({ data: { realmId: EURTH } });
    }
  });

  it("createRoute saves the route in the country's realm", async () => {
    const db = realmDb();
    await eurthCaller(db).createRoute({
      countryId: CALLER_COUNTRY,
      routeType: "rail",
      geometry: { type: "LineString", coordinates: [] },
    });

    expect(db.transportRoute.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ realmId: EURTH }) })
    );
  });
});
