/** @jest-environment node */
jest.mock("~/server/db", () => ({ db: {} }));

import { usersCountryLinkingRouter } from "~/server/api/routers/users/country-linking";
import { buildBaselineCountryData } from "~/lib/countries/baseline-country";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const CLERK_ID = "clerk_new";

function setup() {
  const db = {
    $transaction: jest.fn(),
    user: {
      findUnique: jest.fn().mockResolvedValue({ id: "db_new", countryId: null }),
      upsert: jest.fn().mockResolvedValue({ id: "db_new" }),
      update: jest.fn().mockResolvedValue({}),
    },
    country: {
      create: jest.fn(({ data }: { data: object }) => Promise.resolve({ id: "c_new", ...data })),
      findUnique: jest.fn().mockResolvedValue({
        id: "c_new",
        realmId: "default",
        ownerUserId: null,
        realm: { settings: null },
      }),
      count: jest.fn().mockResolvedValue(0),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    historicalDataPoint: { create: jest.fn().mockResolvedValue({}) },
  };
  db.$transaction.mockImplementation((cb: (tx: typeof db) => Promise<void>) => cb(db));
  const ctx = createMockRouterContext({
    db,
    auth: { userId: CLERK_ID },
    user: { id: "db_new", clerkUserId: CLERK_ID, countryId: null, role: { name: "user" } },
  });
  return { db, caller: usersCountryLinkingRouter.createCaller(ctx as never) };
}

describe("users.createCountry builds its row from the shared baseline", () => {
  beforeEach(() => jest.spyOn(Date, "now").mockReturnValue(Date.parse("2026-09-28T12:00:00Z")));
  afterEach(() => jest.restoreAllMocks());

  it.each([
    ["no initial data", undefined],
    [
      "builder values",
      {
        continent: "Eurth",
        region: "North",
        baselinePopulation: 4_000_000,
        baselineGdpPerCapita: 20_000,
        landArea: 250_000,
        flag: "https://example.test/flag.png",
        government: "Republic",
        inflationRate: 0,
        lifeExpectancy: 81,
        currency: "Crown", // accepted by the input, never stored
      },
    ],
  ])("with %s", async (_label, initialData) => {
    const { db, caller } = setup();
    await caller.createCountry({ userId: CLERK_ID, countryName: "New Aurelia", initialData });

    const baseline = buildBaselineCountryData("New Aurelia", initialData);
    expect(db.country.create).toHaveBeenCalledWith({
      data: { ...baseline, slug: "new-aurelia" },
      include: {
        storytellerEffects: { where: { isActive: true }, orderBy: { ixTimeTimestamp: "desc" } },
      },
    });
    expect(db.country.updateMany).toHaveBeenCalledWith({
      where: { id: "c_new", ownerUserId: null },
      data: { ownerUserId: "db_new" },
    });
    expect(db.historicalDataPoint.create).toHaveBeenCalledWith({
      data: {
        countryId: "c_new",
        ixTimeTimestamp: baseline.baselineDate,
        population: baseline.currentPopulation,
        gdpPerCapita: baseline.currentGdpPerCapita,
        totalGdp: baseline.currentTotalGdp,
        populationGrowthRate: baseline.populationGrowthRate,
        gdpGrowthRate: baseline.adjustedGdpGrowth,
        landArea: baseline.landArea,
        populationDensity: baseline.populationDensity,
        gdpDensity: baseline.gdpDensity,
      },
    });
  });
});
