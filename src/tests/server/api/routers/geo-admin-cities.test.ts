/** @jest-environment node */
/**
 * geoAdmin city import: needs a linked country and only imports into the caller's own (staff may
 * import anywhere); every row is re-checked against the border (one query for the whole batch) and rows
 * outside it are skipped; one failed row does not abort the batch.
 *
 * `jest` is the ambient global (not imported from "@jest/globals") because the hoisted
 * jest.mock() factories below call jest.fn() inline; see trpc-impersonation.test.ts. So is `expect`: the
 * imported one types toHaveBeenCalledWith(db, ...) by the real function's parameters, and a mock db is no PrismaClient.
 */
jest.mock("~/lib/country-geo", () => ({
  __esModule: true,
  // the batch lookup is the real one, answered by the mock db's raw SQL
  ...jest.requireActual("~/lib/country-geo/spatial"),
  upsertCity: jest.fn().mockResolvedValue({}),
}));

jest.mock("~/lib/maps/map-update-bus", () => ({
  __esModule: true,
  broadcastMapUpdate: jest.fn(),
}));

jest.mock("~/server/shared/map-invalidation", () => ({
  __esModule: true,
  invalidateRealmMap: jest.fn().mockResolvedValue(1),
}));

jest.mock("~/lib/city-importer/svg-points", () => ({
  __esModule: true,
  parseCitySvg: jest.fn().mockReturnValue({ layers: [], points: [] }),
}));

import { describe, it, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { geoAdminCitiesRouter } from "~/server/api/routers/geo/admin/cities";
import { upsertCity } from "~/lib/country-geo";
import { broadcastMapUpdate } from "~/lib/maps/map-update-bus";
import { invalidateRealmMap } from "~/server/shared/map-invalidation";
import { parseCitySvg } from "~/lib/city-importer/svg-points";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma, type MockPrismaProxy } from "~/tests/helpers/mock-db";

const createCaller = createCallerFactory(geoAdminCitiesRouter);

function callerAs(db: MockPrismaProxy, who: "player" | "admin" | "landless") {
  const countryId = who === "player" ? "c_mine" : null;
  return createCaller(
    createMockRouterContext({
      db,
      auth: { userId: `clerk_${who}` },
      user: {
        id: who,
        clerkUserId: `clerk_${who}`,
        countryId,
        country: countryId ? { id: countryId, name: "Mine", slug: "mine" } : null,
        role: who === "admin" ? { name: "admin", level: 10 } : { name: "user", level: 100 },
      },
      rateLimitIdentifier: `${who}_${Math.random()}`,
    }) as never
  );
}

const city = (name: string, lng = 10) => ({ name, lat: 45, lng });

let db: MockPrismaProxy;

type Containment = { is_inside: boolean | null; subdivisionId: string | null };

/** Answers the batch containment query (it reads subdivisions) and the water query for every point sent. */
function answerBatch(
  containment: (i: number) => Containment = () => ({ is_inside: true, subdivisionId: "s1" })
) {
  return jest.fn(async (sql: string, _countryId: string, indexes: number[]) => {
    if (sql.includes("subdivisions")) return indexes.map((i) => ({ i, ...containment(i) }));
    return indexes.flatMap((i) => [
      { i, type: "rivers", distance: 1 + i },
      { i, type: "lakes", distance: 50 },
    ]);
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  db = createMockPrisma();
  db.country.findUnique.mockResolvedValue({ id: "c_mine", realmId: "r_eurth" });
  db.$queryRawUnsafe = answerBatch();
});

describe("commitCityImport", () => {
  it("refuses a player importing into another country", async () => {
    await expect(
      callerAs(db, "player").commitCityImport({ countryId: "c_other", cities: [city("A")] })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(upsertCity).not.toHaveBeenCalled();
  });

  it("refuses a user with no country", async () => {
    await expect(
      callerAs(db, "landless").commitCityImport({ countryId: "c_mine", cities: [city("A")] })
    ).rejects.toThrow(/Country ownership required/);
  });

  it("lets staff import into any country", async () => {
    db.country.findUnique.mockResolvedValue({ id: "c_other", realmId: "default" });
    await expect(
      callerAs(db, "admin").commitCityImport({ countryId: "c_other", cities: [city("A")] })
    ).resolves.toEqual({ created: 1 });
    expect(invalidateRealmMap).toHaveBeenCalledWith(db, "default");
  });

  it("skips rows outside the border and keeps going after a failed row", async () => {
    db.$queryRawUnsafe = answerBatch((i) => ({
      is_inside: [true, false, null][i] ?? true,
      subdivisionId: null,
    }));
    (upsertCity as jest.Mock)
      .mockRejectedValueOnce(new Error("duplicate"))
      .mockResolvedValueOnce({});
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    const result = await callerAs(db, "player").commitCityImport({
      countryId: "c_mine",
      cities: [city("Inside"), city("Outside"), city("Unknown border")],
    });

    expect(result).toEqual({ created: 1 });
    expect((upsertCity as jest.Mock).mock.calls.map((c) => c[2].name)).toEqual([
      "Inside",
      "Unknown border",
    ]);
    // The change names its realm, so a viewer of another realm's map ignores it
    expect(broadcastMapUpdate).toHaveBeenCalledWith("bulk", "c_mine", "r_eurth");
    // An import bumps the map version of the country's realm, so detail queries and layer URLs refresh
    expect(invalidateRealmMap).toHaveBeenCalledTimes(1);
    expect(invalidateRealmMap).toHaveBeenCalledWith(db, "r_eurth");
    errorSpy.mockRestore();
  });

  it.each([3, 30])(
    "looks the border, subdivisions and water up once for the whole batch of %i rows",
    async (n) => {
      const cities = Array.from({ length: n }, (_, i) => city(`City ${i}`, 10 + i / 10));
      await expect(
        callerAs(db, "player").commitCityImport({ countryId: "c_mine", cities })
      ).resolves.toEqual({ created: n });

      // one containment query and one water query, however many rows
      expect(db.$queryRawUnsafe).toHaveBeenCalledTimes(2);
      expect(upsertCity).toHaveBeenCalledTimes(n);
    }
  );

  it("hands each row's own lookup to upsertCity", async () => {
    await callerAs(db, "player").commitCityImport({
      countryId: "c_mine",
      cities: [city("A", 10), city("B", 11)],
    });

    const lookups = (upsertCity as jest.Mock).mock.calls.map((c) => c[3]);
    expect(lookups).toEqual([
      { inside: true, subdivisionId: "s1", water: { riverKm: 1, lakeKm: 50 } },
      { inside: true, subdivisionId: "s1", water: { riverKm: 2, lakeKm: 50 } },
    ]);
  });

  it("still imports every row when the batch lookup fails (each city is checked on its own)", async () => {
    db.$queryRawUnsafe = jest.fn().mockRejectedValue(new Error("PostGIS unavailable"));
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      callerAs(db, "player").commitCityImport({
        countryId: "c_mine",
        cities: [city("A"), city("B")],
      })
    ).resolves.toEqual({ created: 2 });
    expect((upsertCity as jest.Mock).mock.calls.map((c) => c[3])).toEqual([
      { inside: null, subdivisionId: null, water: null },
      { inside: null, subdivisionId: null, water: null },
    ]);
    errorSpy.mockRestore();
  });

  it("reports an unknown country", async () => {
    db.country.findUnique.mockResolvedValue(null);
    await expect(
      callerAs(db, "admin").commitCityImport({ countryId: "gone", cities: [] })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("validates coordinates", async () => {
    await expect(
      callerAs(db, "player").commitCityImport({
        countryId: "c_mine",
        cities: [{ name: "Nowhere", lat: 91, lng: 0 }],
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("parseCitySvg", () => {
  it("parses only for the caller's own country", async () => {
    await expect(
      callerAs(db, "player").parseCitySvg({ countryId: "c_other", svgContent: "<svg/>" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(parseCitySvg).not.toHaveBeenCalled();

    await callerAs(db, "player").parseCitySvg({
      countryId: "c_mine",
      svgContent: "<svg/>",
      citiesLayerId: "cities",
    });
    expect(parseCitySvg).toHaveBeenCalledWith("<svg/>", {
      citiesLayerId: "cities",
      capitalLayerId: undefined,
      cityNameLayerId: undefined,
    });
  });
});
