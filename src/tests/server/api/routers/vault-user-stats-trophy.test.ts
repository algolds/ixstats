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
    (db.cardOwnership.count as jest.Mock).mockResolvedValue(3);
    (db.cardOwnership.findMany as jest.Mock).mockResolvedValue([
      { quantity: 2, cards: { marketValue: 100, lorewardEntryId: null } },
      { quantity: 1, cards: { marketValue: 600, lorewardEntryId: "e1" } },
    ]);
    const ctx = createMockRouterContext({
      auth: { userId: "user_self" },
      user: { id: "db_self", clerkUserId: "user_self", role: { name: "user", level: 100 } },
      db,
    });

    const stats = await createCaller(ctx as never).getUserStats();

    expect(stats).toMatchObject({ totalCards: 3, deckValue: 800, deckValueExTrophy: 200 });
  });
});
