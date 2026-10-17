/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories rely on the ambient global.
//
// A one-time bonus inside the caller's transaction, for a caller that holds a lock across its own check and the
// grant (the Loreward payout). It writes through the ledger with the key `<source>:<User.id>`, as grantBonus does.
jest.mock("~/server/db", () => ({ __esModule: true, db: {} }));
jest.mock("~/lib/vault/vault-ledger", () => ({
  ...jest.requireActual("~/lib/vault/vault-ledger"),
  earnCreditsTx: jest.fn(),
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { earnCreditsTx } from "~/lib/vault/vault-ledger";
import { grantBonusTx } from "~/lib/vault/vault-bonus";
import { createMockPrisma } from "~/tests/helpers/mock-db";

let tx: ReturnType<typeof createMockPrisma>;

beforeEach(() => {
  jest.mocked(earnCreditsTx).mockReset().mockResolvedValue({ newBalance: 600, amount: 500 });
  tx = createMockPrisma();
  tx.user.findFirst.mockResolvedValue({ id: "u1" });
});

describe("grantBonusTx", () => {
  it("pays through the ledger in the caller's transaction, keyed by source and user", async () => {
    const metadata = { entryId: "e1" };
    expect(await grantBonusTx(tx as never, "clerk_1", "bonus:loreward:e1", 500, metadata)).toBe(
      true
    );
    expect(tx.user.findFirst).toHaveBeenCalledWith({
      where: { OR: [{ id: "clerk_1" }, { clerkUserId: "clerk_1" }] },
      select: { id: true },
    });
    expect(earnCreditsTx).toHaveBeenCalledWith(tx, {
      userId: "u1",
      amount: 500,
      type: "EARN_BONUS",
      source: "bonus:loreward:e1",
      metadata,
      idempotencyKey: "bonus:loreward:e1:u1",
    });
  });

  it("pays nothing to a user it cannot find", async () => {
    tx.user.findFirst.mockResolvedValue(null);
    expect(await grantBonusTx(tx as never, "nobody", "bonus:loreward:e1", 500)).toBe(false);
    expect(earnCreditsTx).not.toHaveBeenCalled();
  });

  it("pays nothing twice: an earlier bonus of the source, or a ledger row with the key", async () => {
    tx.vaultTransaction.findFirst.mockResolvedValueOnce({ id: "old" });
    expect(await grantBonusTx(tx as never, "u1", "bonus:loreward:e1", 500)).toBe(false);
    expect(tx.vaultTransaction.findFirst).toHaveBeenCalledWith({
      where: { source: "bonus:loreward:e1", type: "EARN_BONUS", vault: { userId: "u1" } },
      select: { id: true },
    });

    tx.vaultTransaction.findUnique.mockResolvedValueOnce({ balanceAfter: 600 });
    expect(await grantBonusTx(tx as never, "u1", "bonus:loreward:e1", 500)).toBe(false);
    expect(tx.vaultTransaction.findUnique).toHaveBeenCalledWith({
      where: { idempotencyKey: "bonus:loreward:e1:u1" },
      select: { balanceAfter: true },
    });
    expect(earnCreditsTx).not.toHaveBeenCalled();
  });
});
