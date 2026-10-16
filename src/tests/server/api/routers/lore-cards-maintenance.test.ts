/** @jest-environment node */
/**
 * loreCards maintenance procedures are admin only. The author backfill only touches cards without real
 * attribution; reclassifying reads Lore cards only, and only the uncategorised ones unless forced.
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
  db.auditLog.create.mockResolvedValue({});
});

it("refuses players on every maintenance procedure", async () => {
  const player = callerAs(db, "player");
  await expect(player.backfillWikiAuthors({})).rejects.toThrow(/Admin privileges required/);
  await expect(player.reclassifyLoreCards({})).rejects.toThrow(/Admin privileges required/);
  expect(db.$queryRawUnsafe).not.toHaveBeenCalled();
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

describe("reclassifyLoreCards", () => {
  it("reads only the Lore cards that have no category", async () => {
    db.card.findMany.mockResolvedValue([]);

    await callerAs(db, "admin").reclassifyLoreCards({});

    expect(db.card.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { cardType: "LORE", category: null } })
    );
  });

  it("reads every Lore card of the wiki when the overwrite is forced", async () => {
    db.card.findMany.mockResolvedValue([]);

    await callerAs(db, "admin").reclassifyLoreCards({ wikiSource: "iiwiki", forceOverwrite: true });

    expect(db.card.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { cardType: "LORE", wikiSource: "iiwiki" } })
    );
  });
});
