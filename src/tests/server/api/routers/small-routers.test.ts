/** @jest-environment node */
/**
 * The small routers: per-user reads and writes stay keyed to the caller (builderDraft,
 * scheduledChanges), demo state is only revealed to the system owner, cache stats are admin
 * only, and the public country reads (resources, atomicGovernment, historical, system) filter
 * and validate as documented.
 *
 * `jest` is the ambient global (not imported from "@jest/globals") because the hoisted
 * jest.mock() factories below call jest.fn() inline; see trpc-impersonation.test.ts.
 */
jest.mock("~/lib/auth", () => ({
  __esModule: true,
  ...jest.requireActual("~/lib/auth"),
  isSystemOwner: (id: string | null | undefined) => id === "clerk_owner",
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { builderDraftRouter } from "~/server/api/routers/builderDraft";
import { scheduledChangesRouter } from "~/server/api/routers/scheduledChanges";
import { demoModeRouter } from "~/server/api/routers/demo-mode";
import { cacheRouter } from "~/server/api/routers/cache";
import { resourcesRouter } from "~/server/api/routers/resources";
import { atomicGovernmentRouter } from "~/server/api/routers/atomicGovernment";
import { historicalRouter } from "~/server/api/routers/historical";
import { systemRouter } from "~/server/api/routers/system";
import { externalApiCache } from "~/lib/cache";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma, type MockPrismaProxy } from "~/tests/helpers/mock-db";

function ctx(db: MockPrismaProxy, id: string | null, role = { name: "user", level: 100 }) {
  return createMockRouterContext({
    db,
    auth: id ? { userId: `clerk_${id}` } : null,
    user: id ? { id, clerkUserId: `clerk_${id}`, role } : null,
    rateLimitIdentifier: `${id}_${Math.random()}`,
  }) as never;
}

let db: MockPrismaProxy;

beforeEach(() => {
  db = createMockPrisma();
});

describe("builderDraft", () => {
  const draft = createCallerFactory(builderDraftRouter);

  it("rejects signed-out callers", async () => {
    await expect(draft(ctx(db, null)).get()).rejects.toThrow(/Authentication required/);
    await expect(draft(ctx(db, null)).save({ data: {} })).rejects.toThrow(
      /Authentication required/
    );
  });

  it("reads, saves and clears only the caller's own draft", async () => {
    const caller = draft(ctx(db, "u1"));
    const updatedAt = new Date(0);
    db.builderDraft.findUnique.mockResolvedValue({ data: { step: 2 }, updatedAt });

    await expect(caller.get()).resolves.toEqual({ data: { step: 2 }, updatedAt });
    await caller.save({ data: { step: 3 } });
    await caller.clear();

    expect(db.builderDraft.findUnique).toHaveBeenCalledWith({ where: { userId: "clerk_u1" } });
    expect(db.builderDraft.upsert).toHaveBeenCalledWith({
      where: { userId: "clerk_u1" },
      create: { userId: "clerk_u1", data: { step: 3 } },
      update: { data: { step: 3 } },
    });
    expect(db.builderDraft.deleteMany).toHaveBeenCalledWith({ where: { userId: "clerk_u1" } });
  });

  it("refuses a draft that is not an object", async () => {
    await expect(
      draft(ctx(db, "u1")).save({ data: "just a string" as never })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.builderDraft.upsert).not.toHaveBeenCalled();
  });
});

describe("scheduledChanges", () => {
  const changes = createCallerFactory(scheduledChangesRouter);

  it("lists the caller's pending changes for their own country", async () => {
    db.user.findUnique.mockResolvedValue({ id: "u1", countryId: "c1" });
    db.scheduledChange.findMany.mockResolvedValue([{ id: "ch1" }]);

    await expect(changes(ctx(db, "u1")).getPendingChanges()).resolves.toEqual([{ id: "ch1" }]);
    expect(db.scheduledChange.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { countryId: "c1", userId: "u1", status: "pending" } })
    );
  });

  it("returns nothing for a user without a country", async () => {
    db.user.findUnique.mockResolvedValue({ id: "u1", countryId: null });
    await expect(changes(ctx(db, "u1")).getPendingChanges()).resolves.toEqual([]);
    expect(db.scheduledChange.findMany).not.toHaveBeenCalled();
  });
});

describe("demoMode", () => {
  const demo = createCallerFactory(demoModeRouter);

  beforeEach(() => {
    db.systemConfig.findUnique.mockImplementation(async ({ where }: any) =>
      where.key === "demo_mode_active" ? { value: "true" } : { value: "demo_c" }
    );
  });

  it("reveals nothing to anyone but the system owner", async () => {
    await expect(
      demo(ctx(db, "admin", { name: "admin", level: 10 })).getDemoState()
    ).resolves.toEqual({ isActive: false, demoCountryId: null });
    expect(db.systemConfig.findUnique).not.toHaveBeenCalled();
  });

  it("reports the active demo country to the system owner", async () => {
    db.country.findFirst.mockResolvedValue({ id: "demo_c" });
    await expect(demo(ctx(db, "owner")).getDemoState()).resolves.toEqual({
      isActive: true,
      demoCountryId: "demo_c",
    });
  });

  it("switches demo mode off when the demo country has gone", async () => {
    db.country.findFirst.mockResolvedValue(null);
    await expect(demo(ctx(db, "owner")).getDemoState()).resolves.toEqual({
      isActive: false,
      demoCountryId: null,
    });
    expect(db.systemConfig.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { key: "demo_mode_active" }, update: { value: "false" } })
    );
  });
});

describe("cache", () => {
  const cache = createCallerFactory(cacheRouter);

  it("is admin only", async () => {
    await expect(cache(ctx(db, "u1")).getStats()).rejects.toThrow(/Admin privileges required/);
  });

  it("reports overall and per-service stats", async () => {
    const statsSpy = jest
      .spyOn(externalApiCache, "getStats")
      .mockImplementation(async (service?: string) => ({ service: service ?? "all" }) as never);

    const stats = await cache(ctx(db, "admin", { name: "admin", level: 10 })).getStats();

    expect(stats.overall).toEqual({ service: "all" });
    expect(Object.keys(stats.byService)).toEqual([
      "mediawiki",
      "unsplash",
      "wikimedia",
      "flagcdn",
      "restcountries",
    ]);
    statsSpy.mockRestore();
  });
});

describe("public country reads", () => {
  it("lists a country's resources and active government components", async () => {
    await createCallerFactory(resourcesRouter)(ctx(db, null)).getCountryResources({
      countryId: "c1",
    });
    await createCallerFactory(atomicGovernmentRouter)(ctx(db, null)).getComponents({
      countryId: "c1",
    });

    expect(db.geographicResource.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { countryId: "c1" } })
    );
    expect(db.governmentComponent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { countryId: "c1", isActive: true } })
    );
  });

  it("returns history oldest first within the date range and caps the limit", async () => {
    const historical = createCallerFactory(historicalRouter)(ctx(db, null));
    db.historicalDataPoint.findMany.mockResolvedValue([{ id: "new" }, { id: "old" }]);
    const startDate = new Date("2026-01-01");

    await expect(
      historical.getCountryHistory({ countryId: "c1", startDate, limit: 2 })
    ).resolves.toEqual([{ id: "old" }, { id: "new" }]);
    expect(db.historicalDataPoint.findMany).toHaveBeenCalledWith({
      where: { countryId: "c1", ixTimeTimestamp: { gte: startDate } },
      orderBy: { ixTimeTimestamp: "desc" },
      take: 2,
    });

    await expect(
      historical.getCountryHistory({ countryId: "c1", limit: 1001 })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("serves the current IxTime to anyone", async () => {
    const time = await createCallerFactory(systemRouter)(ctx(db, null)).getCurrentIxTime();
    expect(typeof time.currentIxTimeNumber).toBe("number");
    expect(typeof time.gameYear).toBe("number");
    expect(new Date(time.currentIxTime).getTime()).toBe(time.currentIxTimeNumber);
  });
});
