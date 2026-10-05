/** @jest-environment node */
/**
 * geoAdmin city import: needs a linked country and only imports into the caller's own (staff may
 * import anywhere); every row is re-checked against the border and rows outside it are skipped;
 * one failed row does not abort the batch.
 *
 * `jest` is the ambient global (not imported from "@jest/globals") because the hoisted
 * jest.mock() factories below call jest.fn() inline; see trpc-impersonation.test.ts.
 */
jest.mock("~/lib/country-geo", () => ({
  __esModule: true,
  upsertCity: jest.fn().mockResolvedValue({}),
}));

jest.mock("~/lib/maps/map-update-bus", () => ({
  __esModule: true,
  broadcastMapUpdate: jest.fn(),
}));

jest.mock("~/server/shared/layer-cache", () => ({
  __esModule: true,
  clearLayerCache: jest.fn(),
}));

jest.mock("~/lib/city-importer/svg-points", () => ({
  __esModule: true,
  parseCitySvg: jest.fn().mockReturnValue({ layers: [], points: [] }),
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { geoAdminCitiesRouter } from "~/server/api/routers/geo/admin/cities";
import { upsertCity } from "~/lib/country-geo";
import { broadcastMapUpdate } from "~/lib/maps/map-update-bus";
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

beforeEach(() => {
  jest.clearAllMocks();
  db = createMockPrisma();
  db.country.findUnique.mockResolvedValue({ id: "c_mine" });
  db.$queryRawUnsafe = jest.fn().mockResolvedValue([{ is_inside: true }]);
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
    db.country.findUnique.mockResolvedValue({ id: "c_other" });
    await expect(
      callerAs(db, "admin").commitCityImport({ countryId: "c_other", cities: [city("A")] })
    ).resolves.toEqual({ created: 1 });
  });

  it("skips rows outside the border and keeps going after a failed row", async () => {
    db.$queryRawUnsafe
      .mockResolvedValueOnce([{ is_inside: true }])
      .mockResolvedValueOnce([{ is_inside: false }])
      .mockResolvedValueOnce([{ is_inside: null }]);
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
    expect(broadcastMapUpdate).toHaveBeenCalledWith("bulk", "c_mine");
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
