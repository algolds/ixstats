/** @jest-environment node */
/** The CTE filter pages through every NationStates card and tags each against the active-nations dump. */
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/lib/nationstates/api-client", () => ({
  nsApiClient: { fetchActiveNationsDump: jest.fn() },
}));

import { nsApiClient } from "~/lib/nationstates/api-client";
import { CTE_DUMP_SANITY, processCTENationFilter } from "~/lib/nationstates/sync-processor";
import { createMockPrisma } from "~/tests/helpers/mock-db";

/** An active-nations set of `size` nations, holding `named` among them. */
const nations = (size: number, ...named: string[]) =>
  new Set([...named, ...Array.from({ length: size - named.length }, (_, i) => `nation ${i}`)]);

const lastRun = (activeNations: number) => ({ metadata: { activeNations, activeCount: 9 } });

beforeEach(() => jest.clearAllMocks());

it("holds its sanity thresholds in one named constant", () => {
  expect(CTE_DUMP_SANITY).toEqual({ minNations: 1_000, minShareOfLastRun: 0.5 });
});

it("tags each card by its nation's NS name, a page at a time, and keeps the rest of its metadata", async () => {
  jest
    .mocked(nsApiClient.fetchActiveNationsDump)
    .mockResolvedValue(nations(1_000, "heku of ix", "elm"));
  const db = createMockPrisma();
  db.card.findMany
    .mockResolvedValueOnce([
      // The card's title differs from its nation's name; the name decides.
      {
        id: "card_a",
        title: "Old title",
        metadata: { importedFrom: "x", nsData: { name: "Heku of Ix" } },
      },
      { id: "card_b", title: "Gone", metadata: null },
    ])
    .mockResolvedValueOnce([{ id: "card_c", title: " Elm ", metadata: "legacy" }])
    .mockResolvedValueOnce([]);

  await expect(processCTENationFilter(db as never, "cte_log")).resolves.toEqual({
    totalProcessed: 3,
    cteCount: 1,
    activeCount: 2,
  });

  expect(db.syncLog.findFirst).toHaveBeenCalledWith({
    where: { syncType: "NS_CTE_FILTER", status: "SUCCESS" },
    orderBy: { startedAt: "desc" },
    select: { metadata: true },
  });
  expect(db.card.findMany).toHaveBeenNthCalledWith(1, {
    where: { cardType: "NS" },
    select: { id: true, title: true, metadata: true },
    orderBy: { id: "asc" },
    take: 500,
  });
  expect(db.card.findMany.mock.calls[1]![0].where).toEqual({
    cardType: "NS",
    id: { gt: "card_b" },
  });
  expect(db.card.findMany.mock.calls[2]![0].where).toEqual({
    cardType: "NS",
    id: { gt: "card_c" },
  });

  const writes = new Map(
    db.card.update.mock.calls.map(([call]) => [call.where.id, call.data.metadata])
  );
  expect(writes.get("card_a")).toEqual({
    importedFrom: "x",
    nsData: { name: "Heku of Ix" },
    isCTE: false,
    cteCheckedAt: expect.any(String),
  });
  expect(writes.get("card_b")).toEqual({ isCTE: true, cteCheckedAt: expect.any(String) });
  expect(writes.get("card_c")).toEqual({ isCTE: false, cteCheckedAt: expect.any(String) });

  expect(db.syncLog.update).toHaveBeenCalledWith({
    where: { id: "cte_log" },
    data: { itemsProcessed: 2 },
  });
  expect(db.syncLog.update).toHaveBeenLastCalledWith({
    where: { id: "cte_log" },
    data: {
      status: "SUCCESS",
      completedAt: expect.any(Date),
      itemsProcessed: 3,
      // The next run's sanity check reads how many nations this dump held
      metadata: { totalProcessed: 3, cteCount: 1, activeCount: 2, activeNations: 1_000 },
    },
  });
});

describe("a dump that cannot be whole", () => {
  it.each([
    ["empty, with no run before it", 0, null],
    ["under 1,000 nations, with no run before it", 999, null],
    ["under half the last run's nations", 99_999, 200_000],
    ["under 1,000 nations, even when the last run read few", 999, 1_200],
  ])("is refused when %s, and no card is read or changed", async (_case, size, previous) => {
    jest.mocked(nsApiClient.fetchActiveNationsDump).mockResolvedValue(nations(size));
    const db = createMockPrisma();
    db.syncLog.findFirst.mockResolvedValue(previous === null ? null : lastRun(previous));

    await expect(processCTENationFilter(db as never, "cte_log")).rejects.toThrow(
      /too few to be whole.*No card was changed/
    );
    expect(db.card.findMany).not.toHaveBeenCalled();
    expect(db.card.update).not.toHaveBeenCalled();
    expect(db.syncLog.update).not.toHaveBeenCalled();
  });

  it("names the count it read and the count it needed", async () => {
    jest.mocked(nsApiClient.fetchActiveNationsDump).mockResolvedValue(nations(12));
    const db = createMockPrisma();
    db.syncLog.findFirst.mockResolvedValue(lastRun(240_000));
    await expect(processCTENationFilter(db as never, "cte_log")).rejects.toThrow(
      "The active-nations dump listed 12 nations, too few to be whole (at least 120,000; the last run read 240,000). No card was changed."
    );
  });

  it("runs on a dump at least half the last run's size", async () => {
    jest.mocked(nsApiClient.fetchActiveNationsDump).mockResolvedValue(nations(100_000));
    const db = createMockPrisma();
    db.syncLog.findFirst.mockResolvedValue(lastRun(200_000));
    await expect(processCTENationFilter(db as never, "cte_log")).resolves.toMatchObject({
      totalProcessed: 0,
    });
  });

  it("falls back to the floor when the last run recorded no nation count", async () => {
    jest.mocked(nsApiClient.fetchActiveNationsDump).mockResolvedValue(nations(1_000));
    const db = createMockPrisma();
    db.syncLog.findFirst.mockResolvedValue({ metadata: { activeCount: 50_000 } });
    await expect(processCTENationFilter(db as never, "cte_log")).resolves.toMatchObject({
      totalProcessed: 0,
    });
  });
});

it("keeps who started the filter in the log's metadata, so the Overview feed can name them", async () => {
  jest.mocked(nsApiClient.fetchActiveNationsDump).mockResolvedValue(nations(1_000));
  const db = createMockPrisma();
  db.syncLog.findFirst.mockResolvedValue(null);
  db.syncLog.findUnique.mockResolvedValue({ metadata: { startedBy: "db_admin" } });
  db.card.findMany.mockResolvedValue([]);
  await processCTENationFilter(db as never, "cte_log");
  expect(db.syncLog.update).toHaveBeenLastCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        metadata: expect.objectContaining({ startedBy: "db_admin" }),
      }),
    })
  );
});
