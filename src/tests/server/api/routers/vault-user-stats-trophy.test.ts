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
jest.mock("~/lib/cards/copy-value", () => ({ deckValueOf: jest.fn() }));

import { describe, it, expect } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { vaultBalanceCreditsRouter } from "~/server/api/routers/vault/balance-credits";
import { deckValueOf } from "~/lib/cards/copy-value";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockDb } from "~/tests/helpers/transactional-mock-db";

const createCaller = createCallerFactory(vaultBalanceCreditsRouter);

function setup(held: number, deck: { total: number; exTrophy: number; copies: number }) {
  const db = createMockDb();
  (db.cardOwnership.count as jest.Mock).mockResolvedValue(held);
  jest.mocked(deckValueOf).mockClear().mockResolvedValue(deck);
  const ctx = createMockRouterContext({
    auth: { userId: "user_self" },
    user: { id: "db_self", clerkUserId: "user_self", role: { name: "user", level: 100 } },
    db,
  });
  return { db, caller: createCaller(ctx as never) };
}

describe("vault.getUserStats", () => {
  it("shows trophy cards in the deck value and leaves them out of the economy's figure", async () => {
    const { db, caller } = setup(3, { total: 800, exTrophy: 200, copies: 3 });

    const stats = await caller.getUserStats();

    expect(stats).toEqual({ totalCards: 3, deckValue: 800, deckValueExTrophy: 200 });
    expect(jest.mocked(deckValueOf).mock.calls).toEqual([[db, "db_self"]]);
  });

  it("counts a hidden card's copies, as the inventory lists them, but does not value them", async () => {
    // Two of the three copies are of retired cards, which the shared copy value leaves out.
    const { db, caller } = setup(3, { total: 100, exTrophy: 100, copies: 1 });

    const stats = await caller.getUserStats();

    expect(stats).toEqual({ totalCards: 3, deckValue: 100, deckValueExTrophy: 100 });
    // Every copy the player holds is counted, retired cards included
    expect((db.cardOwnership.count as jest.Mock).mock.calls).toEqual([
      [{ where: { ownerId: "db_self" } }],
    ]);
  });
});
