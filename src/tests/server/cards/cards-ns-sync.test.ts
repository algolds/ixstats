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
import { activeRunningJobs, processRegionCardsFromDump } from "~/lib/nationstates/sync-processor";
import {
  pauseSync,
  resumeSync,
  startRegionSync,
  stopSync,
} from "~/server/modules/cards/cards.ns-sync";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const ADMIN = { dbId: "db_admin", clerkId: "clerk_admin" };
const regionSync = jest.mocked(processRegionCardsFromDump);
const settle = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => {
  jest.clearAllMocks();
  activeRunningJobs.clear();
});
// The console.error spies some cases set up must not silence the cases after them
afterEach(() => jest.restoreAllMocks());

const MINUTE = 60_000;
const ago = (minutes: number) => new Date(Date.now() - minutes * MINUTE);
/** A region sync's SyncLog as `findUnique` returns it. */
const regionLog = (overrides: object) => ({
  id: "log",
  syncType: "NS_REGION_LAZARUS",
  status: "PAUSED",
  cardsCreated: 0,
  cardsUpdated: 0,
  startedAt: ago(60),
  metadata: { regionNames: ["Lazarus"], seasons: [1], totalCards: 10, lastProcessedIndex: 4 },
  ...overrides,
});
describe("startRegionSync", () => {
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
  it("marks a sync failed when its run breaks, rather than leaving it running", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    const db = createMockPrisma();
    db.syncLog.create.mockResolvedValue({ id: "log_a" });
    regionSync.mockRejectedValueOnce(new Error("connection reset"));
    await startRegionSync(db as never, ADMIN, { regions: ["Lazarus"] });
    await settle();
    expect(db.syncLog.updateMany).toHaveBeenCalledWith({
      where: { id: "log_a", status: { in: ["IN_PROGRESS", "PAUSED"] } },
      data: { status: "FAILED", errorMessage: "connection reset", completedAt: expect.any(Date) },
    });
    expect(db.syncLog.update).not.toHaveBeenCalled();
  });

  it("keeps an admin's stop when the run breaks after it", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    const db = createMockPrisma();
    db.syncLog.create.mockResolvedValue({ id: "log_a" });
    // The SyncLog as Stop left it. An `update` always lands; an `updateMany` only while the status is one it names.
    const log = { status: "FAILED", errorMessage: "Stopped by an admin" };
    db.syncLog.update.mockImplementation(async ({ data }: { data: typeof log }) =>
      Object.assign(log, data)
    );
    db.syncLog.updateMany.mockImplementation(
      async ({ where, data }: { where: { status: { in: string[] } }; data: typeof log }) => {
        if (!where.status.in.includes(log.status)) return { count: 0 };
        Object.assign(log, data);
        return { count: 1 };
      }
    );
    regionSync.mockRejectedValueOnce(new Error("connection reset"));
    await startRegionSync(db as never, ADMIN, { regions: ["Lazarus"] });
    await settle();
    expect(log).toEqual({ status: "FAILED", errorMessage: "Stopped by an admin" });
  });
});

describe("sync controls", () => {
  it.each(["NS_CTE_FILTER", "NS_SEASON_DUMP_1", "LORE_WIKI_SYNC"])(
    "controls only region syncs: a %s run is not found, and nothing is written",
    async (syncType) => {
      const db = createMockPrisma();
      db.syncLog.findUnique.mockResolvedValue(regionLog({ syncType, status: "IN_PROGRESS" }));
      for (const control of [pauseSync, resumeSync, stopSync]) {
        await expect(control(db as never, "log")).rejects.toMatchObject({ code: "NOT_FOUND" });
      }
      expect(db.syncLog.update).not.toHaveBeenCalled();
      expect(db.syncLog.updateMany).not.toHaveBeenCalled();
      expect(regionSync).not.toHaveBeenCalled();
    }
  );
  it("claims a paused sync for one run, if nothing changed it since it was read, then resumes after its last card", async () => {
    const db = createMockPrisma();
    const metadata = {
      regionNames: ["Lazarus"],
      seasons: [3, 1],
      totalCards: 10,
      lastProcessedIndex: 4,
    };
    db.syncLog.findUnique.mockResolvedValue(
      regionLog({ cardsCreated: 2, cardsUpdated: 1, metadata })
    );
    db.syncLog.updateMany.mockResolvedValue({ count: 1 });
    expect(await resumeSync(db as never, "log")).toEqual({ resumed: true });
    expect(db.syncLog.updateMany).toHaveBeenCalledWith({
      where: { id: "log", status: "PAUSED", metadata: { equals: metadata } },
      data: { status: "IN_PROGRESS", metadata: { ...metadata, heartbeatAt: expect.any(String) } },
    });
    expect(regionSync).toHaveBeenCalledWith(db, "log", ["Lazarus"], [1, 3], 5, {
      cardsCreated: 2,
      cardsUpdated: 1,
      errors: [],
    });
  });

  it("starts one run when two resumes race for the same sync", async () => {
    const db = createMockPrisma();
    db.syncLog.findUnique.mockResolvedValue(regionLog({}));
    db.syncLog.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    const results = await Promise.all([
      resumeSync(db as never, "log"),
      resumeSync(db as never, "log"),
    ]);
    expect(results).toEqual([{ resumed: true }, { resumed: false }]);
    expect(regionSync).toHaveBeenCalledTimes(1);
  });
  it("refuses to resume a running sync that is still writing, wherever its run is", async () => {
    const db = createMockPrisma();
    db.syncLog.findUnique.mockResolvedValue(
      regionLog({
        status: "IN_PROGRESS",
        metadata: { regionNames: ["Lazarus"], heartbeatAt: ago(9).toISOString() },
      })
    );
    await expect(resumeSync(db as never, "log")).rejects.toThrow(/still running/i);
    expect(db.syncLog.updateMany).not.toHaveBeenCalled();
    expect(regionSync).not.toHaveBeenCalled();
  });
  it("lifts a pause the running sync has not reached yet, without starting a second run", async () => {
    const db = createMockPrisma();
    activeRunningJobs.add("log");
    db.syncLog.findUnique.mockResolvedValue(regionLog({}));
    expect(await resumeSync(db as never, "log")).toEqual({ resumed: false });
    expect(db.syncLog.updateMany).toHaveBeenCalledWith({
      where: { id: "log", status: "PAUSED" },
      data: { status: "IN_PROGRESS" },
    });
    expect(regionSync).not.toHaveBeenCalled();
  });
});
