/**
 * planRetiredItemRefunds refunds each purchase of a retired item once, and never a purchase an
 * admin revoked (the revoke keeps the row in the ledger, marked `revokedAt`).
 */
import { planRetiredItemRefunds, type StorePurchaseRow } from "~/lib/vault/retired-store-items";
import { revokedPurchaseMetadata } from "~/lib/vault/store-purchases";

const purchase = (id: string, metadata: string): StorePurchaseRow => ({
  id,
  vaultId: `vault_${id}`,
  credits: -500,
  metadata,
  vault: { userId: `user_${id}` },
});

const retired = JSON.stringify({ itemId: "upgrade_archetype_proposal" });

describe("planRetiredItemRefunds", () => {
  it("refunds a retired item's purchase in full", () => {
    const refunds = planRetiredItemRefunds([purchase("p1", retired)], []);
    expect(refunds).toHaveLength(1);
    expect(refunds[0]).toMatchObject({ sourceTransactionId: "p1", amount: 500 });
  });

  it("skips a purchase an admin revoked", () => {
    const revoked = purchase("p2", revokedPurchaseMetadata(retired, "admin_1"));
    expect(planRetiredItemRefunds([revoked, purchase("p3", retired)], [])).toEqual([
      expect.objectContaining({ sourceTransactionId: "p3" }),
    ]);
  });
});
