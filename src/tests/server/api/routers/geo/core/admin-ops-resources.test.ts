/** @jest-environment node */
// Atlas R0 task 2: the admin geo-profile recalculation only queues the work (the `geo-profiles` cron job does
// it, see profile-job.test.ts), so the mutation returns at once with the number of countries queued.
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
      count: jest.fn(async (_args: { where: object }) => 2),
      findMany: jest.fn(async () => []),
      findUnique: jest.fn(async () => null),
    },
    cronRun: {
      findFirst: jest.fn(
        async (_args: { where: { job: string } }): Promise<{ startedAt: Date } | null> => null
      ),
    },
    mapLayer: { findMany: jest.fn(async () => []) },
    countryGeoProfile: {
      updateMany: jest.fn(async (_args: { data: object }) => ({ count: 2 })),
      upsert: jest.fn(async () => ({})),
    },
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

describe("geoCore.recalculateGeoProfiles queues the work (Atlas R0)", () => {
  beforeEach(() => {
    refresh.mockReset();
  });
  it("is admin only", async () => {
    const db = makeDb();
    await expect(caller(db, "user").recalculateGeoProfiles()).rejects.toThrow(/Admin/);
    expect(db.countryGeoProfile.updateMany).not.toHaveBeenCalled();
  });
});
