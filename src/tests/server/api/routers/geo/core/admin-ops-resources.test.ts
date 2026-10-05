/** @jest-environment node */
// AT-9: the admin geo-profile recalculation also rewrites each country's map-derived
// GeographicResource rows; a resource failure is reported without losing the profile.
// `jest` is the ambient global so the hoisted jest.mock() factories can call jest.fn().
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/lib/country-geo", () => ({ syncCountryGeometryFromMapLayer: jest.fn() }));
jest.mock("~/lib/maps/geographic-resources", () => ({
  __esModule: true,
  refreshGeographicResources: jest.fn(),
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";
import { adminOpsProcedures } from "~/server/api/routers/geo/core/admin-ops";
import { refreshGeographicResources } from "~/lib/maps/geographic-resources";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const refresh = refreshGeographicResources as unknown as jest.Mock;
const router = createTRPCRouter(adminOpsProcedures);

function makeDb() {
  return {
    user: {
      findUnique: jest.fn(async ({ where }: { where: { clerkUserId?: string } }) =>
        where.clerkUserId === "admin_1"
          ? { id: "db_admin", role: { name: "admin", level: 10 } }
          : { id: "db_user", role: { name: "user", level: 100 } }
      ),
    },
    auditLog: { create: jest.fn(async () => ({})) },
    country: {
      findMany: jest.fn(async () => [
        { id: "c1", name: "Aurelia" },
        { id: "c2", name: "Borealis" },
      ]),
      findUnique: jest.fn(async () => ({
        coastlineKm: 100,
        landArea: 50_000,
        areaSqMi: null,
        geometry: { type: "Polygon", coordinates: [] },
        boundingBox: [0, 0, 1, 1],
        realmId: "default",
      })),
    },
    mapLayer: { findMany: jest.fn(async () => []) },
    countryGeoProfile: { upsert: jest.fn(async () => ({})) },
  };
}

const caller = (db: ReturnType<typeof makeDb>, role = "admin") =>
  createCallerFactory(router)(
    createMockRouterContext({
      db,
      auth: { userId: `${role}_1` },
      user: {
        id: `db_${role}`,
        clerkUserId: `${role}_1`,
        role: { name: role, level: role === "admin" ? 10 : 100 },
      },
      rateLimitIdentifier: `${role}_${Math.random()}`,
    }) as never
  );

describe("geoCore.recalculateGeoProfiles writes geographic resources (AT-9)", () => {
  beforeEach(() => {
    refresh.mockReset();
  });

  it("refreshes each country's resources after its profile and totals them", async () => {
    refresh.mockResolvedValueOnce(3).mockResolvedValueOnce(1);
    const db = makeDb();
    const res = await caller(db).recalculateGeoProfiles();

    expect(res).toMatchObject({ processed: 2, resourcesWritten: 4, failed: 0, total: 2 });
    expect(refresh.mock.calls.map((c) => c[1])).toEqual(["c1", "c2"]);
    expect(db.countryGeoProfile.upsert).toHaveBeenCalledTimes(2);
  });

  it("reports a resource failure but keeps the profile", async () => {
    refresh.mockRejectedValueOnce(new Error("postgis down")).mockResolvedValueOnce(2);
    const db = makeDb();
    const res = await caller(db).recalculateGeoProfiles();

    expect(res.processed).toBe(2);
    expect(res.resourcesWritten).toBe(2);
    expect(res.errors).toEqual(["Aurelia (resources): postgis down"]);
  });

  it("is admin only", async () => {
    const db = makeDb();
    await expect(caller(db, "user").recalculateGeoProfiles()).rejects.toThrow(/Admin/);
    expect(refresh).not.toHaveBeenCalled();
  });
});
