/** @jest-environment node */
/** Cards refresh §3: capacity counts copies, checked on new-copy sources under one per-owner lock. */
import { assertCapacityTx, CapacityError, lockedCopyRoomTx } from "~/lib/cards/capacity";
import { clearUserPerksCache, invalidateVaultConfigCache } from "~/lib/vault/vault-perks";

function makeTx({
  held,
  roleLevel = 100,
  exempt = false,
}: {
  held: number;
  roleLevel?: number;
  exempt?: boolean;
}) {
  return {
    $executeRaw: jest.fn().mockResolvedValue(1),
    systemConfig: {
      findMany: jest
        .fn()
        .mockResolvedValue([
          { key: "vault_exemptStaffFromLimit", value: exempt ? "true" : "false" },
        ]),
    },
    user: { findUnique: jest.fn().mockResolvedValue({ role: { level: roleLevel } }) },
    cardOwnership: { count: jest.fn().mockResolvedValue(held) },
    vaultTransaction: { findMany: jest.fn().mockResolvedValue([]) },
    vaultStoreItem: { findMany: jest.fn().mockResolvedValue([]) },
  };
}

beforeEach(() => {
  invalidateVaultConfigCache();
  clearUserPerksCache();
});

describe("capacity on new-copy sources", () => {
  it("takes the owner's capacity lock (7334) before counting, so two sources cannot both pass", async () => {
    const tx = makeTx({ held: 148 });
    await expect(lockedCopyRoomTx(tx as never, "u1")).resolves.toBe(2);
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    const [strings, namespace, ownerId] = tx.$executeRaw.mock.calls[0];
    expect(strings.join("?")).toContain("pg_advisory_xact_lock(?::int, hashtext(?))");
    // 7332 is the Loreward contest-place lock and 7331 the serial lock
    expect([namespace, ownerId]).toEqual([7334, "u1"]);
    expect(tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.cardOwnership.count.mock.invocationCallOrder[0]!
    );
    expect(tx.user.findUnique).toHaveBeenCalledWith({
      where: { id: "u1" },
      select: { role: { select: { level: true } } },
    });
    expect(tx.cardOwnership.count).toHaveBeenCalledWith({ where: { ownerId: "u1" } });
  });

  it("counts only once the lock is held, so a second source waits for the first to commit", async () => {
    const tx = makeTx({ held: 148 });
    let grant: (value: number) => void = () => undefined;
    tx.$executeRaw.mockReturnValueOnce(new Promise<number>((resolve) => (grant = resolve)));

    const room = lockedCopyRoomTx(tx as never, "u1");
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(tx.cardOwnership.count).not.toHaveBeenCalled();

    grant(1);
    await expect(room).resolves.toBe(2);
    expect(tx.cardOwnership.count).toHaveBeenCalledTimes(1);
  });

  it("refuses a source that would overflow, and lets one that fits exactly through", async () => {
    const refusal = assertCapacityTx(makeTx({ held: 148 }) as never, "u1", 3);
    await expect(refusal).rejects.toBeInstanceOf(CapacityError);
    await expect(refusal).rejects.toMatchObject({
      name: "CapacityError",
      code: "PRECONDITION_FAILED",
      room: 2,
      message: "Your collection is full. Break down cards, or buy a capacity upgrade in the Store.",
    });
    await expect(
      assertCapacityTx(makeTx({ held: 148 }) as never, "u1", 2)
    ).resolves.toBeUndefined();
  });

  it("refuses even one copy at a full collection", async () => {
    await expect(assertCapacityTx(makeTx({ held: 150 }) as never, "u1", 1)).rejects.toMatchObject({
      room: 0,
    });
  });

  it("lets exempt staff past the limit, and holds others to it", async () => {
    await expect(
      assertCapacityTx(makeTx({ held: 9999, roleLevel: 10, exempt: true }) as never, "u1", 50)
    ).resolves.toBeUndefined();
    invalidateVaultConfigCache();
    await expect(
      assertCapacityTx(makeTx({ held: 9999, roleLevel: 100, exempt: true }) as never, "u1", 1)
    ).rejects.toBeInstanceOf(CapacityError);
  });

  it("reads an owner with no row or role as a player, not staff", async () => {
    const tx = makeTx({ held: 150, exempt: true });
    tx.user.findUnique.mockResolvedValue(null);
    await expect(assertCapacityTx(tx as never, "u1", 1)).rejects.toBeInstanceOf(CapacityError);
  });
});
