/** @jest-environment node */
// `jest` is the injected global on purpose: @swc/jest only hoists jest.mock() on the global.
jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" } }));
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/server/modules/maps/layer-loader", () => ({
  loadLayerWithFallback: jest.fn(),
}));

import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";
import { clearTrpcMemoryCache } from "~/lib/cache/trpc-cache";
import { borderHistoryProcedures } from "~/server/api/routers/geo/core/border-history";
import { loadLayerWithFallback } from "~/server/modules/maps/layer-loader";

const EURTH = "r_eurth";
const IX_DAY_MS = 86_400_000;
const caller = createCallerFactory(createTRPCRouter({ ...borderHistoryProcedures }));

const political = {
  type: "FeatureCollection" as const,
  features: [
    {
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [0, 0] },
      properties: { countryId: "c1" },
    },
  ],
};

function makeDb() {
  return {
    borderHistory: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    realm: { findUnique: jest.fn().mockResolvedValue({ id: EURTH }) },
  };
}

function ctxFor(db: ReturnType<typeof makeDb>) {
  return {
    db,
    user: { id: "u1", clerkUserId: "clerk_u1", country: { id: "c1", realmId: EURTH } },
    auth: null,
    rateLimitIdentifier: "test",
    headers: new Headers(),
  } as never;
}

beforeEach(() => {
  clearTrpcMemoryCache();
  jest.mocked(loadLayerWithFallback).mockResolvedValue(political as never);
});

describe("getWorldMapAsOf history read", () => {
  it("reads the viewer's realm only, one latest snapshot per country, bounded", async () => {
    const db = makeDb();
    await caller(ctxFor(db)).getWorldMapAsOf({ ixTime: 20_000 * IX_DAY_MS + 5_000 });

    const args = db.borderHistory.findMany.mock.calls[0]![0];
    expect(args.where.country).toEqual({ realmId: EURTH });
    expect(args.distinct).toEqual(["countryId"]);
    expect(args.orderBy).toEqual([{ countryId: "asc" }, { changedAt: "desc" }]);
    expect(args.take).toBeGreaterThan(0);
    expect(args.take).toBeLessThanOrEqual(5_000);
  });

  it("asks for history as of the start of the IxTime day, matching its cache key", async () => {
    const db = makeDb();
    await caller(ctxFor(db)).getWorldMapAsOf({ ixTime: 20_000 * IX_DAY_MS + 5_000 });

    const lte = db.borderHistory.findMany.mock.calls[0]![0].where.changedAt.lte as Date;
    expect(lte.getTime()).toBe(20_000 * IX_DAY_MS);
  });

  it("answers two ixTimes of one day from one read", async () => {
    const db = makeDb();
    const api = caller(ctxFor(db));
    await api.getWorldMapAsOf({ ixTime: 20_000 * IX_DAY_MS + 1 });
    await api.getWorldMapAsOf({ ixTime: 20_000 * IX_DAY_MS + 9_999 });

    expect(db.borderHistory.findMany).toHaveBeenCalledTimes(1);
  });
});

describe("getHistoryRange", () => {
  // Ixnay's edit is the earliest; Eurth's earliest is later. A realm-blind read returns Ixnay's for everyone.
  const history = [
    { realmId: "default", changedAt: new Date(1_000) },
    { realmId: EURTH, changedAt: new Date(9_000) },
    { realmId: EURTH, changedAt: new Date(5_000) },
  ];

  function rangeDb(rows = history) {
    const db = makeDb();
    db.borderHistory.findFirst.mockImplementation(
      async ({ where }: { where: { country: { realmId: string } } }) => {
        const inRealm = rows
          .filter((row) => row.realmId === where.country.realmId)
          .sort((a, b) => a.changedAt.getTime() - b.changedAt.getTime());
        return inRealm[0] ? { changedAt: inRealm[0].changedAt } : null;
      }
    );
    db.realm.findUnique.mockResolvedValue(null); // "ixnay" resolves to Ixnay without a realm row
    return db;
  }

  it("starts at the earliest history of the viewer's realm, not of every realm", async () => {
    const db = rangeDb();
    const range = await caller(ctxFor(db)).getHistoryRange();

    expect(range.minTime).toBe(5_000);
    const args = db.borderHistory.findFirst.mock.calls[0]![0];
    expect(args.where).toEqual({ country: { realmId: EURTH } });
    expect(args.orderBy).toEqual({ changedAt: "asc" });
  });

  it("follows ?realm=: another realm's range excludes the viewer's own history", async () => {
    const db = rangeDb();
    const api = caller(ctxFor(db));

    expect((await api.getHistoryRange({ realm: "ixnay" })).minTime).toBe(1_000);
    expect((await api.getHistoryRange()).minTime).toBe(5_000);
  });

  it("has no range for a realm without history, so the scrubber stays hidden", async () => {
    const db = rangeDb(history.filter((row) => row.realmId === "default"));
    const range = await caller(ctxFor(db)).getHistoryRange();

    expect(range.minTime).toBeNull();
  });
});
