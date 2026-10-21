/** @jest-environment node */
/** Cards refresh §2.1 (bound), §3 (capacity counts copies), §5.3 (home realm of new cards). */
import { assertNoBoundCopies } from "~/lib/cards/bound";
import { copyRoom } from "~/lib/cards/capacity";
import { invalidateVaultConfigCache, clearUserPerksCache } from "~/lib/vault/vault-perks";

beforeEach(() => {
  invalidateVaultConfigCache();
  clearUserPerksCache();
});

describe("assertNoBoundCopies", () => {
  it("refuses any copy of a bound card", async () => {
    const count = jest.fn().mockResolvedValue(1);
    await expect(
      assertNoBoundCopies({ cardOwnership: { count } } as never, ["o1", "o2"])
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    expect(count).toHaveBeenCalledWith({
      where: { id: { in: ["o1", "o2"] }, cards: { isBound: true } },
    });
  });

  it("lets unbound copies through, and asks nothing for none", async () => {
    const count = jest.fn().mockResolvedValue(0);
    await expect(
      assertNoBoundCopies({ cardOwnership: { count } } as never, ["o1"])
    ).resolves.toBeUndefined();
    await assertNoBoundCopies({ cardOwnership: { count } } as never, []);
    expect(count).toHaveBeenCalledTimes(1);
  });
});

describe("copyRoom", () => {
  function db(held: number, config: Array<{ key: string; value: string }> = []) {
    return {
      systemConfig: { findMany: jest.fn().mockResolvedValue(config) },
      vaultTransaction: { findMany: jest.fn().mockResolvedValue([]) },
      vaultStoreItem: { findMany: jest.fn().mockResolvedValue([]) },
      cardOwnership: { count: jest.fn().mockResolvedValue(held) },
    };
  }

  it("is the capacity left, counting copies by owner", async () => {
    const d = db(140);
    await expect(copyRoom(d as never, { id: "u1", roleLevel: 100 })).resolves.toBe(10);
    expect(d.cardOwnership.count).toHaveBeenCalledWith({ where: { ownerId: "u1" } });
  });

  it("never goes below zero, and is unlimited for exempt staff", async () => {
    await expect(copyRoom(db(400) as never, { id: "u1", roleLevel: 100 })).resolves.toBe(0);
    const exempt = db(400, [{ key: "vault_exemptStaffFromLimit", value: "true" }]);
    await expect(copyRoom(exempt as never, { id: "u1", roleLevel: 10 })).resolves.toBe(
      Number.POSITIVE_INFINITY
    );
  });
});
