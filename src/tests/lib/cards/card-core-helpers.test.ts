/** @jest-environment node */
/** Cards refresh §2.1 (bound), §3 (one copy value, capacity counts copies), §5.3 (home realm of new cards). */
import { assertNoBoundCopies } from "~/lib/cards/bound";
import { copyRoom } from "~/lib/cards/capacity";
import { copyValue, COPY_VALUE_SQL, deckValue } from "~/lib/cards/copy-value";
import { articleHomeRealm } from "~/lib/cards/home-realm";
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

describe("copy value", () => {
  it("is the card's value per copy, and a deck is the sum of its copies", () => {
    expect(copyValue({ cards: { marketValue: 30 } })).toBe(30);
    expect(
      deckValue([
        { cards: { marketValue: 30 } },
        { cards: { marketValue: 30 } },
        { cards: { marketValue: 5 } },
      ])
    ).toBe(65);
    expect(COPY_VALUE_SQL).toBe('c."marketValue"');
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

describe("articleHomeRealm", () => {
  it("is the realm that imported the page earliest, asked by canonical title", async () => {
    const findMany = jest.fn().mockResolvedValue([{ realmId: "eurth" }]);
    await expect(articleHomeRealm({ realmPage: { findMany } }, "iiwiki", "foo_bar")).resolves.toBe(
      "eurth"
    );
    expect(findMany).toHaveBeenCalledWith({
      where: { wikiSource: "iiwiki", title: { equals: "Foo bar", mode: "insensitive" } },
      orderBy: [{ importedAt: "asc" }, { realmId: "asc" }],
      take: 1,
      select: { realmId: true },
    });
  });

  it("falls back to the wiki's realm", async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    await expect(articleHomeRealm({ realmPage: { findMany } }, null, "X")).resolves.toBe("default");
    await expect(articleHomeRealm({ realmPage: { findMany } }, "iiwiki", "X")).resolves.toBe(
      "iiwiki"
    );
  });
});
