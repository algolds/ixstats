/** @jest-environment node */
// Atlas R0 task 2: geo profile recalculation is queued by the admin mutation and run by the `geo-profiles` cron
// job, one country at a time, off the web request. `jest` is the ambient global so the hoisted jest.mock()
// factories can call jest.fn().
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/lib/maps/geographic-resources", () => ({
  __esModule: true,
  refreshGeographicResources: jest.fn(),
}));

import { Prisma } from "@prisma/client";
import { refreshGeographicResources } from "~/lib/maps/geographic-resources";
import {
  GEO_PROFILE_RUN_BUDGET_MS,
  GEO_PROFILE_STALE_AT,
  queueGeoProfileRecalculation,
  runGeoProfileRecalculation,
} from "~/server/api/routers/geo/core/profile-job";

const refresh = jest.mocked(refreshGeographicResources);

type Where = Prisma.CountryWhereInput;

const COUNTRIES = [
  { id: "c1", name: "Aurelia" },
  { id: "c2", name: "Borealis" },
  { id: "c3", name: "Cartadania" },
];

function makeDb(countries = COUNTRIES, lastRun: { startedAt: Date } | null = null) {
  const state = { running: 0, peak: 0 };
  return {
    state,
    country: {
      findMany: jest.fn(async (_args: { where: Where }) => countries),
      count: jest.fn(async (_args: { where: Where }) => countries.length),
      findUnique: jest.fn(async () => ({
        coastlineKm: 100,
        landArea: 50_000,
        areaSqMi: null,
        geometry: { type: "Polygon", coordinates: [] },
        boundingBox: [0, 0, 1, 1],
        realmId: "default",
        realm: { settings: {} },
      })),
    },
    cronRun: {
      findFirst: jest.fn(
        async (_args: {
          where: { job: string };
          orderBy: { startedAt: "desc" };
          select: { startedAt: true };
        }) => lastRun
      ),
    },
    mapLayer: { findMany: jest.fn(async () => []) },
    $queryRawUnsafe: jest.fn(async () => []),
    countryGeoProfile: {
      updateMany: jest.fn(async (_args: { where: { country: Where }; data: object }) => ({
        count: 2,
      })),
      upsert: jest.fn(async () => {
        state.running++;
        state.peak = Math.max(state.peak, state.running);
        await new Promise((resolve) => setImmediate(resolve));
        state.running--;
        return {};
      }),
    },
  };
}

beforeEach(() => {
  refresh.mockReset();
  refresh.mockResolvedValue(1);
});
afterEach(() => jest.restoreAllMocks());

describe("queueGeoProfileRecalculation", () => {
  it("marks the profiles of every country with geometry stale and counts them, computing nothing", async () => {
    const db = makeDb();
    const result = await queueGeoProfileRecalculation(db as never);

    expect(result).toEqual({ queued: 3, lastRunAt: null });
    const scope = db.country.count.mock.calls[0]?.[0].where;
    expect(scope).toEqual({
      AND: [{ geometry: { not: Prisma.DbNull } }, { geometry: { not: Prisma.JsonNull } }],
    });
    expect(db.countryGeoProfile.updateMany).toHaveBeenCalledWith({
      where: { country: scope },
      data: { lastCalculatedAt: GEO_PROFILE_STALE_AT },
    });
    expect(db.countryGeoProfile.upsert).not.toHaveBeenCalled();
    expect(db.country.findUnique).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("queues one country", async () => {
    const db = makeDb([COUNTRIES[0]!]);
    const result = await queueGeoProfileRecalculation(db as never, "c1");

    expect(result).toMatchObject({ queued: 1 });
    expect(db.country.count.mock.calls[0]?.[0].where).toMatchObject({ id: "c1" });
    expect(db.countryGeoProfile.updateMany.mock.calls[0]?.[0].where).toEqual({
      country: expect.objectContaining({ id: "c1" }),
    });
  });
});

describe("queueGeoProfileRecalculation: lastRunAt", () => {
  it("reports when the geo-profiles job last ran, so the admin can tell whether it is enabled", async () => {
    const startedAt = new Date("2026-10-11T12:00:00Z");
    const db = makeDb(COUNTRIES, { startedAt });

    const result = await queueGeoProfileRecalculation(db as never);

    expect(result).toEqual({ queued: 3, lastRunAt: startedAt });
    expect(db.cronRun.findFirst).toHaveBeenCalledWith({
      where: { job: "geo-profiles" },
      orderBy: { startedAt: "desc" },
      select: { startedAt: true },
    });
  });

  it("reports no run when the job never ran", async () => {
    const result = await queueGeoProfileRecalculation(makeDb() as never);
    expect(result.lastRunAt).toBeNull();
  });
});

describe("runGeoProfileRecalculation", () => {
  it("picks the countries whose profile is stale or missing", async () => {
    const db = makeDb();
    await runGeoProfileRecalculation(db as never, { onProgress: () => undefined });

    const where = db.country.findMany.mock.calls[0]?.[0].where;
    expect(where?.OR).toEqual([
      { geoProfile: null },
      { geoProfile: { lastCalculatedAt: { lte: GEO_PROFILE_STALE_AT } } },
    ]);
    expect(where?.AND).toEqual([
      { geometry: { not: Prisma.DbNull } },
      { geometry: { not: Prisma.JsonNull } },
    ]);
  });

  it("recomputes one country at a time and reports progress after each", async () => {
    refresh.mockResolvedValueOnce(3).mockResolvedValueOnce(1).mockResolvedValueOnce(2);
    const db = makeDb();
    const progress: Array<{ done: number; total: number; country: string }> = [];

    const result = await runGeoProfileRecalculation(db as never, {
      onProgress: (p) => progress.push(p),
    });

    expect(result).toEqual({
      total: 3,
      processed: 3,
      failed: 0,
      remaining: 0,
      resourcesWritten: 6,
      errors: [],
    });
    expect(refresh.mock.calls.map((call) => call[1])).toEqual(["c1", "c2", "c3"]);
    expect(db.countryGeoProfile.upsert).toHaveBeenCalledTimes(3);
    expect(db.state.peak).toBe(1);
    expect(progress).toEqual([
      { done: 1, total: 3, country: "Aurelia" },
      { done: 2, total: 3, country: "Borealis" },
      { done: 3, total: 3, country: "Cartadania" },
    ]);
  });

  it("leaves a failed country stale, reports it and carries on", async () => {
    const db = makeDb();
    db.country.findUnique.mockResolvedValueOnce(null as never);

    const result = await runGeoProfileRecalculation(db as never, { onProgress: () => undefined });

    expect(result).toMatchObject({ total: 3, processed: 2, failed: 1, remaining: 1 });
    expect(result.errors).toEqual(["Aurelia: no geometry"]);
    expect(refresh.mock.calls.map((call) => call[1])).toEqual(["c2", "c3"]);
  });

  it("reports a resource failure without losing the profile", async () => {
    refresh.mockRejectedValueOnce(new Error("postgis down")).mockResolvedValue(2);
    const db = makeDb();

    const result = await runGeoProfileRecalculation(db as never, { onProgress: () => undefined });

    expect(result).toMatchObject({ processed: 3, failed: 1, remaining: 0, resourcesWritten: 4 });
    expect(result.errors).toEqual(["Aurelia (resources): postgis down"]);
    expect(db.countryGeoProfile.upsert).toHaveBeenCalledTimes(3);
  });

  it("stops starting countries once the run budget is spent, leaving the rest queued", async () => {
    let clock = 1_000;
    jest.spyOn(Date, "now").mockImplementation(() => clock);
    const db = makeDb();
    db.countryGeoProfile.upsert.mockImplementation(async () => {
      clock += GEO_PROFILE_RUN_BUDGET_MS;
      return {};
    });

    const result = await runGeoProfileRecalculation(db as never, { onProgress: () => undefined });

    expect(result).toMatchObject({ total: 3, processed: 1, remaining: 2 });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("does nothing when no profile is stale", async () => {
    const db = makeDb([]);
    const result = await runGeoProfileRecalculation(db as never, { onProgress: () => undefined });

    expect(result).toEqual({
      total: 0,
      processed: 0,
      failed: 0,
      remaining: 0,
      resourcesWritten: 0,
      errors: [],
    });
    expect(db.countryGeoProfile.upsert).not.toHaveBeenCalled();
  });
});
