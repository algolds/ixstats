/** @jest-environment node */
/** NationStates region syncs run server-side, one SyncLog per region, and list exactly the cards they created. */
jest.mock("~/lib/nationstates/sync-processor", () => ({
  activeRunningJobs: new Set<string>(),
  processRegionCardsFromDump: jest.fn().mockResolvedValue(undefined),
  processCTENationFilter: jest
    .fn()
    .mockResolvedValue({ totalProcessed: 0, cteCount: 0, activeCount: 0 }),
}));
jest.mock("~/lib/nationstates/api-client", () => ({
  nsApiClient: { fetchRegionsByTag: jest.fn(), fetchRegionNationCount: jest.fn() },
}));

import { nsApiClient } from "~/lib/nationstates/api-client";
import {
  activeRunningJobs,
  processCTENationFilter,
  processRegionCardsFromDump,
} from "~/lib/nationstates/sync-processor";
import {
  DEFAULT_SYNC_SEASONS,
  activeSyncs,
  discoverTopRegions,
  listSyncLogs,
  normalizeSeasons,
  pauseSync,
  resumeSync,
  startCteFilter,
  startRegionSync,
  stopSync,
  syncLogCards,
} from "~/server/modules/cards/cards.ns-sync";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const ADMIN = { dbId: "db_admin", clerkId: "clerk_admin" };
const regionSync = jest.mocked(processRegionCardsFromDump);
const cteFilter = jest.mocked(processCTENationFilter);
const settle = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => {
  jest.clearAllMocks();
  activeRunningJobs.clear();
});

describe("normalizeSeasons", () => {
  it("keeps the valid seasons once, in order, and reads none as every season", () => {
    expect(normalizeSeasons([3, 1, 3, 0, 101, 2.5])).toEqual([1, 3]);
    expect(normalizeSeasons([])).toEqual(DEFAULT_SYNC_SEASONS);
    expect(normalizeSeasons(undefined)).toEqual(DEFAULT_SYNC_SEASONS);
    expect(DEFAULT_SYNC_SEASONS).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
  });
});

describe("startRegionSync", () => {
  it("starts one sync per distinct region, each with only its own region, over every season by default", async () => {
    const db = createMockPrisma();
    db.syncLog.create.mockResolvedValueOnce({ id: "log_a" }).mockResolvedValueOnce({ id: "log_b" });
    const started = await startRegionSync(db as never, ADMIN, {
      regions: ["Lazarus", " lazarus ", "The North Pacific"],
    });
    expect(started).toEqual([
      { regionName: "Lazarus", syncLogId: "log_a" },
      { regionName: "The North Pacific", syncLogId: "log_b" },
    ]);
    expect(db.syncLog.create).toHaveBeenCalledTimes(2);
    expect(db.syncLog.create.mock.calls[0]![0].data).toMatchObject({
      syncType: "NS_REGION_LAZARUS",
      status: "IN_PROGRESS",
      metadata: {
        regionNames: ["Lazarus"],
        seasons: DEFAULT_SYNC_SEASONS,
        totalCards: 0,
        lastProcessedIndex: -1,
        startedBy: "db_admin",
      },
    });
    expect(db.syncLog.create.mock.calls[1]![0].data.syncType).toBe("NS_REGION_THE_NORTH_PACIFIC");
    expect(regionSync).toHaveBeenCalledWith(db, "log_a", ["Lazarus"], DEFAULT_SYNC_SEASONS);
    expect(regionSync).toHaveBeenCalledWith(
      db,
      "log_b",
      ["The North Pacific"],
      DEFAULT_SYNC_SEASONS
    );
  });

  it("records who started each sync, since the sync's own metadata is rewritten as it runs", async () => {
    const db = createMockPrisma();
    db.syncLog.create.mockResolvedValue({ id: "log_a" });
    await startRegionSync(db as never, ADMIN, { regions: ["Lazarus"], seasons: [2, 1] });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "clerk_admin",
        action: "CARD_IMPORT",
        target: "log_a",
        details: "Started a NationStates region sync of Lazarus, seasons 1, 2",
      }),
    });
    expect(regionSync).toHaveBeenCalledWith(db, "log_a", ["Lazarus"], [1, 2]);
  });

  it("refuses an empty region list", async () => {
    const db = createMockPrisma();
    await expect(startRegionSync(db as never, ADMIN, { regions: [" "] })).rejects.toThrow(
      /at least one region/
    );
    expect(db.syncLog.create).not.toHaveBeenCalled();
  });

  it("marks a sync failed when its run breaks, rather than leaving it running", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    const db = createMockPrisma();
    db.syncLog.create.mockResolvedValue({ id: "log_a" });
    regionSync.mockRejectedValueOnce(new Error("connection reset"));
    await startRegionSync(db as never, ADMIN, { regions: ["Lazarus"] });
    await settle();
    expect(db.syncLog.update).toHaveBeenCalledWith({
      where: { id: "log_a" },
      data: { status: "FAILED", errorMessage: "connection reset", completedAt: expect.any(Date) },
    });
  });

  it("logs, rather than leaves unhandled, a failure it cannot record", async () => {
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const db = createMockPrisma();
    db.syncLog.create.mockResolvedValue({ id: "log_a" });
    db.syncLog.update.mockRejectedValue(new Error("db down"));
    regionSync.mockRejectedValueOnce(new Error("connection reset"));
    await startRegionSync(db as never, ADMIN, { regions: ["Lazarus"] });
    await settle();
    expect(error).toHaveBeenCalledWith(
      "[NS Import] Region sync Lazarus not marked failed:",
      expect.objectContaining({ message: "db down" })
    );
  });
});

describe("sync controls", () => {
  it("pauses only a running sync", async () => {
    const db = createMockPrisma();
    db.syncLog.findUnique.mockResolvedValue({ id: "log", status: "SUCCESS", metadata: {} });
    await expect(pauseSync(db as never, "log")).rejects.toThrow(/only a running sync/i);
    db.syncLog.findUnique.mockResolvedValue({ id: "log", status: "IN_PROGRESS", metadata: {} });
    await pauseSync(db as never, "log");
    expect(db.syncLog.update).toHaveBeenCalledWith({
      where: { id: "log" },
      data: { status: "PAUSED" },
    });
  });

  it("refuses a sync that does not exist", async () => {
    const db = createMockPrisma();
    await expect(stopSync(db as never, "gone")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("finishes rather than resumes a sync that already worked every card", async () => {
    const db = createMockPrisma();
    db.syncLog.findUnique.mockResolvedValue({
      id: "log",
      status: "PAUSED",
      cardsCreated: 4,
      cardsUpdated: 0,
      metadata: { regionNames: ["Lazarus"], seasons: [1], totalCards: 4, lastProcessedIndex: 3 },
    });
    expect(await resumeSync(db as never, "log")).toEqual({ resumed: false });
    expect(db.syncLog.update).toHaveBeenCalledWith({
      where: { id: "log" },
      data: expect.objectContaining({ status: "SUCCESS" }),
    });
    expect(regionSync).not.toHaveBeenCalled();
  });

  it("resumes a paused sync after its last card, with its counts so far", async () => {
    const db = createMockPrisma();
    db.syncLog.findUnique.mockResolvedValue({
      id: "log",
      status: "PAUSED",
      cardsCreated: 2,
      cardsUpdated: 1,
      metadata: {
        regionNames: ["Lazarus"],
        seasons: [3, 1],
        totalCards: 10,
        lastProcessedIndex: 4,
      },
    });
    expect(await resumeSync(db as never, "log")).toEqual({ resumed: true });
    expect(db.syncLog.update).toHaveBeenCalledWith({
      where: { id: "log" },
      data: { status: "IN_PROGRESS" },
    });
    expect(regionSync).toHaveBeenCalledWith(db, "log", ["Lazarus"], [1, 3], 5, {
      cardsCreated: 2,
      cardsUpdated: 1,
      errors: [],
    });
  });

  it("resumes from the first card a sync paused before it had read the dumps", async () => {
    const db = createMockPrisma();
    db.syncLog.findUnique.mockResolvedValue({
      id: "log",
      status: "PAUSED",
      cardsCreated: null,
      cardsUpdated: null,
      metadata: { regionNames: ["Lazarus"], seasons: [], totalCards: 0, lastProcessedIndex: -1 },
    });
    expect(await resumeSync(db as never, "log")).toEqual({ resumed: true });
    expect(regionSync).toHaveBeenCalledWith(db, "log", ["Lazarus"], DEFAULT_SYNC_SEASONS, 0, {
      cardsCreated: 0,
      cardsUpdated: 0,
      errors: [],
    });
  });

  it("leaves a sync that is still running here alone", async () => {
    const db = createMockPrisma();
    activeRunningJobs.add("log");
    db.syncLog.findUnique.mockResolvedValue({
      id: "log",
      status: "IN_PROGRESS",
      metadata: { regionNames: ["Lazarus"] },
    });
    expect(await resumeSync(db as never, "log")).toEqual({ resumed: false });
    expect(db.syncLog.update).not.toHaveBeenCalled();
    expect(regionSync).not.toHaveBeenCalled();
  });

  it("lifts a pause the running sync has not reached yet, without starting a second run", async () => {
    const db = createMockPrisma();
    activeRunningJobs.add("log");
    db.syncLog.findUnique.mockResolvedValue({
      id: "log",
      status: "PAUSED",
      metadata: { regionNames: ["Lazarus"], seasons: [1], totalCards: 0, lastProcessedIndex: -1 },
    });
    expect(await resumeSync(db as never, "log")).toEqual({ resumed: false });
    expect(db.syncLog.update).toHaveBeenCalledWith({
      where: { id: "log" },
      data: { status: "IN_PROGRESS" },
    });
    expect(regionSync).not.toHaveBeenCalled();
  });

  it("refuses to resume a finished sync, or one with no region list", async () => {
    const db = createMockPrisma();
    db.syncLog.findUnique.mockResolvedValue({ id: "log", status: "SUCCESS", metadata: {} });
    await expect(resumeSync(db as never, "log")).rejects.toThrow(/only a paused or interrupted/i);
    db.syncLog.findUnique.mockResolvedValue({ id: "log", status: "PAUSED", metadata: null });
    await expect(resumeSync(db as never, "log")).rejects.toThrow(/no region list/i);
    expect(regionSync).not.toHaveBeenCalled();
  });

  it("stops a running or paused sync, and nothing else", async () => {
    const db = createMockPrisma();
    db.syncLog.findUnique.mockResolvedValue({ id: "log", status: "PAUSED", metadata: {} });
    await stopSync(db as never, "log");
    expect(db.syncLog.update).toHaveBeenCalledWith({
      where: { id: "log" },
      data: {
        status: "FAILED",
        errorMessage: "Stopped by an admin",
        completedAt: expect.any(Date),
      },
    });
    db.syncLog.findUnique.mockResolvedValue({ id: "log", status: "FAILED", metadata: {} });
    await expect(stopSync(db as never, "log")).rejects.toThrow(/only a running or paused/i);
  });
});

describe("syncLogCards", () => {
  it("lists the cards that sync created, by the sync id they carry", async () => {
    const db = createMockPrisma();
    db.syncLog.findUnique.mockResolvedValue({
      id: "log",
      metadata: { regionNames: ["Lazarus"], seasons: [1] },
    });
    db.card.count.mockResolvedValue(0);
    await expect(
      syncLogCards(db as never, { syncLogId: "log", search: " elm ", limit: 50, offset: 0 })
    ).resolves.toEqual({ cards: [], total: 0, exact: true });
    expect(db.card.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          metadata: { path: ["syncLogId"], equals: "log" },
          title: { contains: "elm", mode: "insensitive" },
        },
        take: 50,
        skip: 0,
      })
    );
    expect(db.card.count.mock.calls[0]![0].where).toEqual(db.card.findMany.mock.calls[0]![0].where);
  });

  it("lists a sync from before syncs recorded their cards by the region it imported from", async () => {
    const db = createMockPrisma();
    db.syncLog.findUnique.mockResolvedValue({
      id: "old",
      metadata: { regionName: "greater_ixnay", nations: ["a"] },
    });
    db.card.count.mockResolvedValue(0);
    const result = await syncLogCards(db as never, { syncLogId: "old", limit: 20, offset: 40 });
    expect(result.exact).toBe(false);
    expect(db.card.findMany.mock.calls[0]![0]).toMatchObject({
      where: {
        cardType: "NS",
        metadata: { path: ["importedFrom"], equals: "region:greater_ixnay" },
      },
      take: 20,
      skip: 40,
    });
  });

  it("refuses a sync that does not exist", async () => {
    const db = createMockPrisma();
    await expect(
      syncLogCards(db as never, { syncLogId: "gone", limit: 50, offset: 0 })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("listSyncLogs and activeSyncs", () => {
  const log = (overrides: object) => ({
    id: "log",
    syncType: "NS_REGION_LAZARUS",
    status: "SUCCESS",
    cardsCreated: 3,
    cardsUpdated: null,
    itemsProcessed: 5,
    errorMessage: null,
    startedAt: new Date("2026-10-01"),
    completedAt: null,
    metadata: { regionNames: ["Lazarus"] },
    ...overrides,
  });

  it("names each run's region, from either metadata shape, and none for the CTE filter", async () => {
    const db = createMockPrisma();
    db.syncLog.findMany.mockResolvedValue([
      log({}),
      log({ id: "old", metadata: { regionName: "greater_ixnay" } }),
      log({ id: "cte", syncType: "NS_CTE_FILTER", metadata: { cteCount: 1 } }),
    ]);
    const logs = await listSyncLogs(db as never, 25);
    expect(db.syncLog.findMany).toHaveBeenCalledWith({
      where: { syncType: { startsWith: "NS_" } },
      orderBy: { startedAt: "desc" },
      take: 25,
    });
    expect(logs.map((row) => row.region)).toEqual(["Lazarus", "greater_ixnay", null]);
    expect(logs[0]).toMatchObject({ cardsCreated: 3, cardsUpdated: 0, itemsProcessed: 5 });
  });

  it("lists running and paused region syncs with their progress", async () => {
    const db = createMockPrisma();
    db.syncLog.findMany.mockResolvedValue([
      log({
        status: "IN_PROGRESS",
        metadata: { regionNames: ["Lazarus"], totalCards: 40, lastProcessedIndex: 9 },
      }),
      log({ id: "fresh", status: "PAUSED", metadata: { regionNames: ["Balder"] } }),
    ]);
    const active = await activeSyncs(db as never);
    expect(db.syncLog.findMany.mock.calls[0]![0].where).toEqual({
      syncType: { startsWith: "NS_REGION_" },
      status: { in: ["IN_PROGRESS", "PAUSED"] },
    });
    expect(active).toEqual([
      expect.objectContaining({
        region: "Lazarus",
        processed: 10,
        totalCards: 40,
        cardsCreated: 3,
      }),
      expect.objectContaining({ region: "Balder", processed: 0, totalCards: 0, status: "PAUSED" }),
    ]);
  });
});

describe("discoverTopRegions", () => {
  it("asks for at most 30 regions of the tag and returns the largest first", async () => {
    const names = Array.from({ length: 40 }, (_, i) => `r${i}`);
    jest.mocked(nsApiClient.fetchRegionsByTag).mockResolvedValue(names);
    jest
      .mocked(nsApiClient.fetchRegionNationCount)
      .mockImplementation(async (id) =>
        id === "r1" ? null : { name: id.toUpperCase(), numnations: Number(id.slice(1)) }
      );
    const regions = await discoverTopRegions("massive", 3);
    expect(nsApiClient.fetchRegionsByTag).toHaveBeenCalledWith("gargantuan");
    expect(nsApiClient.fetchRegionNationCount).toHaveBeenCalledTimes(30);
    expect(regions).toEqual([
      { id: "r29", name: "R29", numnations: 29 },
      { id: "r28", name: "R28", numnations: 28 },
      { id: "r27", name: "R27", numnations: 27 },
    ]);
  });

  it("says so when NationStates does not answer, rather than finding nothing", async () => {
    jest.mocked(nsApiClient.fetchRegionsByTag).mockResolvedValue(null);
    await expect(discoverTopRegions("gargantuan", 15)).rejects.toMatchObject({
      code: "BAD_GATEWAY",
    });
  });
});

describe("startCteFilter", () => {
  it("runs the filter in the background under its own SyncLog, and records who started it", async () => {
    const db = createMockPrisma();
    db.syncLog.create.mockResolvedValue({ id: "cte_log" });
    expect(await startCteFilter(db as never, ADMIN)).toEqual({ syncLogId: "cte_log" });
    expect(db.syncLog.create.mock.calls[0]![0].data).toMatchObject({
      syncType: "NS_CTE_FILTER",
      status: "IN_PROGRESS",
      metadata: { startedBy: "db_admin" },
    });
    expect(cteFilter).toHaveBeenCalledWith(db, "cte_log");
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "clerk_admin",
        action: "CARD_IMPORT",
        target: "cte_log",
      }),
    });
  });

  it("marks the filter failed with the reason when it breaks", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    const db = createMockPrisma();
    db.syncLog.create.mockResolvedValue({ id: "cte_log" });
    cteFilter.mockRejectedValueOnce(new Error("HTTP 503: Service Unavailable"));
    await startCteFilter(db as never, ADMIN);
    await settle();
    expect(db.syncLog.update).toHaveBeenCalledWith({
      where: { id: "cte_log" },
      data: {
        status: "FAILED",
        errorMessage: "HTTP 503: Service Unavailable",
        completedAt: expect.any(Date),
      },
    });
  });
});
