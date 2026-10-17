/** @jest-environment node */
/** The CTE filter pages through every NationStates card and tags each against the active-nations dump. */
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/lib/nationstates/api-client", () => ({
  nsApiClient: { fetchActiveNationsDump: jest.fn() },
}));

import { nsApiClient } from "~/lib/nationstates/api-client";
import { processCTENationFilter } from "~/lib/nationstates/sync-processor";
import { createMockPrisma } from "~/tests/helpers/mock-db";

it("tags each card by its nation's NS name, a page at a time, and keeps the rest of its metadata", async () => {
  jest.mocked(nsApiClient.fetchActiveNationsDump).mockResolvedValue(new Set(["heku of ix", "elm"]));
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
      metadata: { totalProcessed: 3, cteCount: 1, activeCount: 2 },
    },
  });
});
