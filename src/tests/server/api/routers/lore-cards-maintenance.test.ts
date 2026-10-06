/** @jest-environment node */
/**
 * loreCards maintenance procedures are admin only. Purging duplicates keeps the first card of each
 * group and moves the others' ownerships onto it (merging quantities when the owner already holds
 * the keeper); the author backfill only touches cards without real attribution.
 *
 * `jest` is the ambient global (not imported from "@jest/globals") because the hoisted
 * jest.mock() factory below calls jest.fn() inline; see trpc-impersonation.test.ts.
 */
jest.mock("~/lib/wiki-os/adapters/ixstates/lore-card-generator", () => ({
  __esModule: true,
  wikiLoreCardGenerator: {
    fetchArticleAuthorInfoBatch: jest.fn(),
    fetchArticleMetadataBatch: jest.fn().mockResolvedValue([]),
  },
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { loreCardsMaintenanceRouter } from "~/server/api/routers/lore-cards/maintenance";
import { wikiLoreCardGenerator } from "~/lib/wiki-os/adapters/ixstates/lore-card-generator";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma, type MockPrismaProxy } from "~/tests/helpers/mock-db";

const createCaller = createCallerFactory(loreCardsMaintenanceRouter);

function callerAs(db: MockPrismaProxy, who: "admin" | "player") {
  return createCaller(
    createMockRouterContext({
      db,
      auth: { userId: `clerk_${who}` },
      user: {
        id: who,
        clerkUserId: `clerk_${who}`,
        role: who === "admin" ? { name: "admin", level: 10 } : { name: "user", level: 100 },
      },
      rateLimitIdentifier: `${who}_${Math.random()}`,
    }) as never
  );
}

let db: MockPrismaProxy;

beforeEach(() => {
  jest.clearAllMocks();
  db = createMockPrisma();
  db.$transaction.mockImplementation((cb: (tx: MockPrismaProxy) => unknown) => cb(db));
  db.$queryRawUnsafe = jest.fn().mockResolvedValue([]);
  db.card.deleteMany.mockImplementation(async ({ where }: any) => ({ count: where.id.in.length }));
  db.auditLog.create.mockResolvedValue({});
});

it("refuses players on every maintenance procedure", async () => {
  const player = callerAs(db, "player");
  await expect(player.getDuplicateCardsStats()).rejects.toThrow(/Admin privileges required/);
  await expect(player.purgeDuplicateCards({})).rejects.toThrow(/Admin privileges required/);
  await expect(player.backfillWikiAuthors({})).rejects.toThrow(/Admin privileges required/);
  await expect(player.reclassifyLoreCards({})).rejects.toThrow(/Admin privileges required/);
  expect(db.$queryRawUnsafe).not.toHaveBeenCalled();
  expect(db.card.deleteMany).not.toHaveBeenCalled();
});

describe("purgeDuplicateCards", () => {
  it("keeps the first card and merges the duplicates' ownerships into it", async () => {
    db.$queryRawUnsafe.mockResolvedValue([{ wikiArticleTitle: "Caphiria", wikiSource: "ixwiki" }]);
    db.card.findMany.mockResolvedValue([{ id: "keep" }, { id: "dup" }]);
    db.cardOwnership.findMany.mockResolvedValue([
      { id: "own_a", ownerId: "alice", quantity: 2 },
      { id: "own_b", ownerId: "bob", quantity: 1 },
    ]);
    // Alice already holds the keeper; Bob does not.
    db.cardOwnership.findFirst.mockImplementation(async ({ where }: any) =>
      where.ownerId === "alice" ? { id: "own_keep_a", quantity: 3 } : null
    );

    const result = await callerAs(db, "admin").purgeDuplicateCards({});

    expect(db.cardOwnership.update).toHaveBeenCalledWith({
      where: { id: "own_keep_a" },
      data: { quantity: 5 },
    });
    expect(db.cardOwnership.delete).toHaveBeenCalledWith({ where: { id: "own_a" } });
    expect(db.cardOwnership.update).toHaveBeenCalledWith({
      where: { id: "own_b" },
      data: { cardId: "keep" },
    });
    expect(db.card.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["dup"] } } });
    expect(result).toMatchObject({ success: true, purgedCount: 1, groupsResolved: 1 });
  });

  it("moves a merged-away ownership's auctions and history before deleting it", async () => {
    db.$queryRawUnsafe.mockResolvedValue([{ wikiArticleTitle: "Caphiria", wikiSource: "ixwiki" }]);
    db.card.findMany.mockResolvedValue([{ id: "keep" }, { id: "dup" }]);
    db.cardOwnership.findMany.mockResolvedValue([{ id: "own_a", ownerId: "alice", quantity: 1 }]);
    db.cardOwnership.findFirst.mockResolvedValue({ id: "own_keep_a", quantity: 1 });
    db.cardCollectionItem.findMany.mockResolvedValue([{ collectionId: "col_1" }]);

    await callerAs(db, "admin").purgeDuplicateCards({});

    // Auctions reference the ownership: deleting own_a would cascade them away.
    expect(db.cardAuction.updateMany).toHaveBeenCalledWith({
      where: { cardInstanceId: "own_a" },
      data: { cardInstanceId: "own_keep_a" },
    });
    expect(db.cardCollectionItem.deleteMany).toHaveBeenCalledWith({
      where: { cardOwnershipId: "own_a", collectionId: { in: ["col_1"] } },
    });
    expect(db.cardCollectionItem.updateMany).toHaveBeenCalledWith({
      where: { cardOwnershipId: "own_a" },
      data: { cardOwnershipId: "own_keep_a" },
    });
    for (const model of [db.cardExperienceEvent, db.cardTransferEvent]) {
      expect(model.updateMany).toHaveBeenCalledWith({
        where: { ownershipId: "own_a" },
        data: { ownershipId: "own_keep_a" },
      });
    }
    const moved = db.cardAuction.updateMany.mock.invocationCallOrder[0]!;
    const deleted = db.cardOwnership.delete.mock.invocationCallOrder[0]!;
    expect(moved).toBeLessThan(deleted);
  });

  it("reports duplicate groups with their redundant counts", async () => {
    db.$queryRawUnsafe
      .mockResolvedValueOnce([{ wikiArticleTitle: "Urcea", wikiSource: "ixwiki", count: 3n }])
      .mockResolvedValueOnce([]);

    const stats = await callerAs(db, "admin").getDuplicateCardsStats();

    expect(stats).toMatchObject({
      totalDuplicates: 2,
      totalGroups: 1,
      loreGroups: [{ title: "Urcea", count: 3, redundantCount: 2 }],
    });
  });
});

describe("backfillWikiAuthors", () => {
  it("only enriches cards without real author attribution", async () => {
    db.card.findMany.mockResolvedValue([
      { id: "c1", wikiArticleTitle: "Caphiria", wikiSource: "ixwiki", metadata: {} },
      {
        id: "c2",
        wikiArticleTitle: "Urcea",
        wikiSource: "ixwiki",
        metadata: { authorInfo: { creator: "Pecora", displayAuthor: "Pecora" } },
      },
      {
        id: "c3",
        wikiArticleTitle: "Kiravia",
        wikiSource: "iiwiki",
        metadata: { authorInfo: { creator: "Community" } },
      },
    ]);
    (wikiLoreCardGenerator.fetchArticleAuthorInfoBatch as jest.Mock).mockImplementation(
      async (titles: string[]) =>
        new Map(
          titles.map((t) => [t.toLowerCase(), { creator: "Writer", displayAuthor: "Writer" }])
        )
    );

    const result = await callerAs(db, "admin").backfillWikiAuthors({});

    expect(result.count).toBe(2);
    expect(db.card.update.mock.calls.map((c: any) => c[0].where.id).sort()).toEqual(["c1", "c3"]);
    expect(wikiLoreCardGenerator.fetchArticleAuthorInfoBatch).toHaveBeenCalledWith(
      ["Kiravia"],
      "iiwiki"
    );
  });

  it("caps the batch size", async () => {
    await expect(callerAs(db, "admin").backfillWikiAuthors({ limit: 501 })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});
