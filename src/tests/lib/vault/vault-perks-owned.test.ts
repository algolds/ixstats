/**
 * Code audit VT-13: store perks could silently vanish. The perk lookup read only the 100
 * newest store purchases and only items still listed (`isActive`), so a long purchase
 * history or a delisted item dropped perks the player had paid for. The yield boosts the dividend multiplies by stack
 * per purchase (folded from vault-service).
 */

import {
  clearUserPerksCache,
  getCardCapacityBoost,
  getYieldBoostMultiplier,
} from "~/lib/vault/vault-perks";

const CAPACITY_ITEM = {
  id: "upgrade_card_capacity",
  isActive: false, // delisted after purchase
  effects: { perks: { cardCapacity: 10 } },
};

function makeDb(purchases: number) {
  const rows = Array.from({ length: purchases }, (_, i) => ({
    // Mix object and JSON-string metadata, as both exist in the ledger
    metadata:
      i % 2 === 0 ? { itemId: CAPACITY_ITEM.id } : JSON.stringify({ itemId: CAPACITY_ITEM.id }),
  }));
  return {
    vaultTransaction: {
      findMany: jest.fn().mockImplementation(async (args: any) => rows.slice(0, args.take)),
    },
    vaultStoreItem: {
      findMany: jest
        .fn()
        .mockImplementation(async (args: any) =>
          args.where.isActive === true && !CAPACITY_ITEM.isActive ? [] : [CAPACITY_ITEM]
        ),
    },
  };
}

describe("store perks", () => {
  beforeEach(() => clearUserPerksCache());

  it("counts every purchase, not just the newest 100", async () => {
    const db = makeDb(150);
    expect(await getCardCapacityBoost("u1", db as any)).toBe(1500);
    expect(db.vaultTransaction.findMany.mock.calls[0][0].take).toBeUndefined();
  });

  it("sums the yield boosts of every upgrade owned, each purchase counted", async () => {
    const effects = { y5: 0.05, y10: 0.1 };
    const db = {
      vaultTransaction: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { metadata: { itemId: "y5" } },
            { metadata: JSON.stringify({ itemId: "y5" }) },
            { metadata: { itemId: "y10" } },
            { metadata: { other: "junk" } },
          ]),
      },
      vaultStoreItem: {
        findMany: jest
          .fn()
          .mockResolvedValue(
            Object.entries(effects).map(([id, yieldBoost]) => ({
              id,
              effects: { perks: { yieldBoost } },
            }))
          ),
      },
    };
    expect(await getYieldBoostMultiplier("u3", db as never)).toBeCloseTo(0.2);
  });

  it("keeps applying a perk after its store item is delisted", async () => {
    const db = makeDb(2);
    expect(await getCardCapacityBoost("u2", db as any)).toBe(20);
    expect(db.vaultStoreItem.findMany.mock.calls[0][0].where).not.toHaveProperty("isActive");
  });
});
