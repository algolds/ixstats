/** @jest-environment node */
/**
 * The Archetype Proposal Token did nothing when bought (no archetype proposal pipeline exists),
 * so it is retired: refused, hidden and every purchase refunded once, idempotently.
 */
import {
  applyRetiredItemRefund,
  isRetiredStoreItem,
  planRetiredItemRefunds,
  retiredItemRefundKey,
  type RetiredItemRefund,
  type StorePurchaseRow,
} from "~/lib/vault/retired-store-items";

const TOKEN = "upgrade_archetype_proposal";

function purchase(
  id: string,
  credits: number,
  itemId = TOKEN,
  userId = "user_a"
): StorePurchaseRow {
  return {
    id,
    vaultId: `vault_${userId}`,
    credits,
    metadata: JSON.stringify({ itemId, price: 3500 }),
    vault: { userId },
  };
}

describe("planRetiredItemRefunds", () => {
  it("refunds each purchase of a retired item once, at what was paid", () => {
    const plan = planRetiredItemRefunds(
      [
        purchase("tx1", -3500),
        purchase("tx2", -3500, TOKEN, "user_b"),
        purchase("tx3", -2000, "upgrade_card_capacity"),
      ],
      []
    );

    expect(plan).toEqual([
      {
        vaultId: "vault_user_a",
        userId: "user_a",
        itemId: TOKEN,
        sourceTransactionId: "tx1",
        amount: 3500,
        idempotencyKey: "retired_item_refund:tx1",
      },
      expect.objectContaining({ sourceTransactionId: "tx2", userId: "user_b", amount: 3500 }),
    ]);
  });

  it("adds a shortfall the exploit audit took back, and subtracts a refund already given", () => {
    const plan = planRetiredItemRefunds(
      [purchase("tx1", -1), purchase("tx2", -3500)],
      [
        { credits: -3499, metadata: JSON.stringify({ sourceTransactionId: "tx1" }) },
        { credits: 3500, metadata: { sourceTransactionId: "tx2" } },
      ]
    );

    expect(plan).toEqual([expect.objectContaining({ sourceTransactionId: "tx1", amount: 3500 })]);
  });

  it("knows which items are retired", () => {
    expect(isRetiredStoreItem(TOKEN)).toBe(true);
    expect(isRetiredStoreItem("upgrade_card_capacity")).toBe(false);
  });
});

describe("applyRetiredItemRefund", () => {
  const refund: RetiredItemRefund = {
    vaultId: "vault_a",
    userId: "user_a",
    itemId: TOKEN,
    sourceTransactionId: "tx1",
    amount: 3500,
    idempotencyKey: retiredItemRefundKey("tx1"),
  };

  function makeDb(alreadyApplied: boolean) {
    const tx = {
      vaultTransaction: {
        findUnique: jest.fn().mockResolvedValue(alreadyApplied ? { id: "r1" } : null),
        create: jest.fn().mockResolvedValue({}),
      },
      myVault: { update: jest.fn().mockResolvedValue({ credits: 3600 }) },
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    const db = { $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)) };
    return { db, tx };
  }

  it("credits the refund as a REFUND row keyed for idempotency", async () => {
    const { db, tx } = makeDb(false);

    await expect(applyRetiredItemRefund(db as never, refund)).resolves.toBe("applied");

    expect(tx.myVault.update).toHaveBeenCalledWith({
      where: { id: "vault_a" },
      data: { credits: { increment: 3500 }, lifetimeSpent: { decrement: 3500 } },
    });
    expect(tx.vaultTransaction.create.mock.calls[0][0].data).toMatchObject({
      vaultId: "vault_a",
      credits: 3500,
      balanceAfter: 3600,
      type: "REFUND",
      source: `retired_item_refund:${TOKEN}`,
      idempotencyKey: "retired_item_refund:tx1",
    });
  });

  it("changes nothing when the refund was already applied", async () => {
    const { db, tx } = makeDb(true);

    await expect(applyRetiredItemRefund(db as never, refund)).resolves.toBe("already_applied");

    expect(tx.myVault.update).not.toHaveBeenCalled();
    expect(tx.vaultTransaction.create).not.toHaveBeenCalled();
  });
});
