/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories rely on the ambient global.
jest.mock("~/lib/vault/vault-service", () => ({
  __esModule: true,
  vaultService: {},
}));
jest.mock("~/lib/cache/advanced-cache-system", () => ({
  __esModule: true,
  globalCache: { get: jest.fn().mockResolvedValue(null), set: jest.fn(), delete: jest.fn() },
}));

import { describe, it, expect } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { vaultBalanceCreditsRouter } from "~/server/api/routers/vault/balance-credits";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockDb } from "~/tests/helpers/transactional-mock-db";

const createCaller = createCallerFactory(vaultBalanceCreditsRouter);

describe("vault.getUserStats", () => {
  it("shows trophy cards in the deck value and leaves them out of the economy's figure", async () => {
    const db = createMockDb();
    (db.cardOwnership.findMany as jest.Mock).mockResolvedValue([
      { cards: { marketValue: 100, cardType: "LORE" } },
      { cards: { marketValue: 100, cardType: "LORE" } },
      { cards: { marketValue: 600, cardType: "TROPHY" } },
    ]);
    const ctx = createMockRouterContext({
      auth: { userId: "user_self" },
      user: { id: "db_self", clerkUserId: "user_self", role: { name: "user", level: 100 } },
      db,
    });

    const stats = await createCaller(ctx as never).getUserStats();

    expect(stats).toMatchObject({ totalCards: 3, deckValue: 800, deckValueExTrophy: 200 });
    expect(stats).not.toHaveProperty("collectorLevel");
  });

  it("counts a hidden card's copies, as the inventory lists them, but does not value them", async () => {
    const db = createMockDb();
    (db.cardOwnership.findMany as jest.Mock).mockResolvedValue([
      { cards: { marketValue: 100, cardType: "LORE", isRetired: false } },
      { cards: { marketValue: 500, cardType: "NS", isRetired: true } },
      { cards: { marketValue: 600, cardType: "TROPHY", isRetired: true } },
    ]);
    const ctx = createMockRouterContext({
      auth: { userId: "user_self" },
      user: { id: "db_self", clerkUserId: "user_self", role: { name: "user", level: 100 } },
      db,
    });

    const stats = await createCaller(ctx as never).getUserStats();

    expect(stats).toEqual({ totalCards: 3, deckValue: 100, deckValueExTrophy: 100 });
    // Every copy the player holds is read, retired cards included
    expect((db.cardOwnership.findMany as jest.Mock).mock.calls[0]![0].where).toEqual({
      ownerId: "db_self",
    });
  });
});
