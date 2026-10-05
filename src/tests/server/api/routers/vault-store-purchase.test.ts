/**
 * Roadmap M0 (code audit VT-1/VT-11): store purchases are priced and checked by the
 * server. The client sends only an item id; the old `vault.spendCredits`, which took
 * the amount, type and metadata from the client, is gone.
 */

jest.mock("~/lib/vault/vault-passive-income", () => ({
  catchUpPassiveIncome: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("~/lib/vault/vault-ledger", () => ({
  ...jest.requireActual("~/lib/vault/vault-ledger"),
  getOrCreateVault: jest.fn(),
  spendCreditsTx: jest.fn(),
}));
jest.mock("~/lib/vault/vault-perks", () => ({
  clearUserPerksCache: jest.fn(),
}));
jest.mock("~/server/modules/forum", () => ({
  syncUserToForum: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("~/lib/cache", () => ({
  ...jest.requireActual("~/lib/cache"), // the tRPC context needs the real Cache class
  globalCache: { delete: jest.fn().mockResolvedValue(undefined) },
}));

import { createCallerFactory } from "~/server/api/trpc";
import { vaultRouter } from "~/server/api/routers/vault";
import { vaultStoreRouter } from "~/server/api/routers/vault/store";
import { getOrCreateVault, LedgerError, spendCreditsTx } from "~/lib/vault/vault-ledger";
import { countStorePurchases, storePrerequisiteMet } from "~/lib/vault/store-purchases";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockDb, type MockPrismaProxy } from "~/tests/helpers/transactional-mock-db";

const createCaller = createCallerFactory(vaultStoreRouter);
const spendMock = jest.mocked(spendCreditsTx);
const vaultMock = jest.mocked(getOrCreateVault);

const USER = "user_db_id_1";

const ITEMS = {
  frame: {
    id: "frame_gold",
    name: "Gold Frame",
    price: 250,
    category: "cosmetics",
    isActive: true,
  },
  capacity: {
    id: "upgrade_card_capacity",
    name: "Card Capacity",
    price: 100,
    category: "upgrades",
    isActive: true,
  },
  mega: {
    id: "upgrade_card_capacity_mega",
    name: "Mega Capacity",
    price: 900,
    category: "upgrades",
    isActive: true,
  },
};

function purchaseRows(...itemIds: string[]) {
  return itemIds.map((itemId) => ({ metadata: JSON.stringify({ itemId }) }));
}

function makeCaller(
  item: Record<string, unknown> | null,
  opts: { purchases?: { metadata: unknown }[]; equipped?: string } = {}
) {
  const db = createMockDb({ $queryRaw: jest.fn().mockResolvedValue([]) });
  db.$transaction = jest.fn((cb: (tx: MockPrismaProxy) => Promise<never>) => cb(db));
  db.vaultStoreItem.findUnique = jest.fn().mockResolvedValue(item);
  db.user.findFirst = jest.fn().mockResolvedValue({ id: USER });
  db.vaultTransaction.findMany = jest.fn().mockResolvedValue(opts.purchases ?? []);
  vaultMock.mockResolvedValue({
    id: "vault_1",
    userId: USER,
    equippedCosmetics: opts.equipped ?? "",
  } as never);
  spendMock.mockImplementation(
    async (_tx, input) =>
      ({
        newBalance: 1000 - input.amount,
        amount: input.amount,
      }) as never
  );
  return { db, caller: createCaller(createMockRouterContext({ db }) as never) };
}

beforeEach(() => jest.clearAllMocks());

describe("vault.purchaseStoreItem", () => {
  it("charges the item's database price, whatever the client might want to pay", async () => {
    const { caller } = makeCaller(ITEMS.frame);

    const result = await caller.purchaseStoreItem({ itemId: "frame_gold" });

    expect(spendMock).toHaveBeenCalledTimes(1);
    expect(spendMock.mock.calls[0]![1]).toMatchObject({
      userId: USER,
      amount: 250,
      type: "SPEND_COSMETIC",
      metadata: { itemId: "frame_gold", price: 250 },
    });
    expect(result).toMatchObject({ success: true, amountSpent: 250, newBalance: 750 });
  });

  it("does not accept a client-supplied amount", async () => {
    const { caller } = makeCaller(ITEMS.frame);

    await caller.purchaseStoreItem({ itemId: "frame_gold", amount: 1 } as never);

    expect(spendMock.mock.calls[0]![1].amount).toBe(250);
  });

  it("rejects an unknown or inactive item without charging", async () => {
    const { caller } = makeCaller({ ...ITEMS.frame, isActive: false });

    await expect(caller.purchaseStoreItem({ itemId: "frame_gold" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(spendMock).not.toHaveBeenCalled();
  });

  it("refuses to sell a cosmetic the user already owns", async () => {
    const { caller } = makeCaller(ITEMS.frame, { purchases: purchaseRows("frame_gold") });

    await expect(caller.purchaseStoreItem({ itemId: "frame_gold" })).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(spendMock).not.toHaveBeenCalled();
  });

  it("treats an equipped cosmetic as owned", async () => {
    const { caller } = makeCaller(ITEMS.frame, { equipped: "other,frame_gold" });

    await expect(caller.purchaseStoreItem({ itemId: "frame_gold" })).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("locks the vault row before checking ownership", async () => {
    const { db, caller } = makeCaller(ITEMS.frame);

    await caller.purchaseStoreItem({ itemId: "frame_gold" });

    const sql = (db.$queryRaw.mock.calls[0]![0] as TemplateStringsArray).join("?");
    expect(sql).toContain("FOR UPDATE");
  });

  it("lets upgrades stack", async () => {
    const { caller } = makeCaller(ITEMS.capacity, {
      purchases: purchaseRows("upgrade_card_capacity", "upgrade_card_capacity"),
    });

    await caller.purchaseStoreItem({ itemId: "upgrade_card_capacity" });

    expect(spendMock.mock.calls[0]![1]).toMatchObject({ amount: 100, type: "SPEND_BOOST" });
  });

  it("enforces the mega-capacity prerequisite on the server", async () => {
    const four = purchaseRows(...Array(4).fill("upgrade_card_capacity"));
    const { caller } = makeCaller(ITEMS.mega, { purchases: four });

    await expect(
      caller.purchaseStoreItem({ itemId: "upgrade_card_capacity_mega" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(spendMock).not.toHaveBeenCalled();

    const five = purchaseRows(...Array(5).fill("upgrade_card_capacity"));
    const { caller: ready } = makeCaller(ITEMS.mega, { purchases: five });
    await ready.purchaseStoreItem({ itemId: "upgrade_card_capacity_mega" });
    expect(spendMock).toHaveBeenCalledTimes(1);
  });

  it("reports insufficient credits as a bad request", async () => {
    const { caller } = makeCaller(ITEMS.frame);
    spendMock.mockRejectedValueOnce(
      new LedgerError("INSUFFICIENT_CREDITS", "Insufficient credits", 10)
    );

    await expect(caller.purchaseStoreItem({ itemId: "frame_gold" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("refuses a retired item without charging, even if its row is reactivated", async () => {
    const { caller } = makeCaller({
      id: "upgrade_archetype_proposal",
      name: "Archetype Proposal Token",
      price: 3500,
      category: "upgrades",
      isActive: true,
    });

    await expect(
      caller.purchaseStoreItem({ itemId: "upgrade_archetype_proposal" })
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(spendMock).not.toHaveBeenCalled();
  });
});

describe("vault.listStoreItems", () => {
  it("hides retired items from the storefront", async () => {
    const { db, caller } = makeCaller(null);
    db.vaultStoreItem.findMany = jest.fn().mockResolvedValue([]);

    await caller.listStoreItems();

    expect(db.vaultStoreItem.findMany.mock.calls[0][0].where).toEqual({
      isActive: true,
      id: { notIn: ["upgrade_archetype_proposal"] },
    });
  });
});

describe("the vault router no longer lets clients spend arbitrary amounts", () => {
  it("does not expose spendCredits", () => {
    const procedures = Object.keys(vaultRouter._def.procedures);
    expect(procedures).toContain("purchaseStoreItem");
    expect(procedures).not.toContain("spendCredits");
  });
});

describe("store purchase helpers", () => {
  it("counts purchases from string and object metadata, ignoring junk", () => {
    expect(
      countStorePurchases([
        { metadata: JSON.stringify({ itemId: "a" }) },
        { metadata: { itemId: "a" } },
        { metadata: { itemId: "b" } },
        { metadata: "not json" },
        { metadata: null },
        { metadata: { other: 1 } },
      ])
    ).toEqual({ a: 2, b: 1 });
  });

  it("checks prerequisites only for items that have one", () => {
    expect(storePrerequisiteMet("frame_gold", undefined)).toBe(true);
    expect(storePrerequisiteMet("upgrade_card_capacity_mega", { upgrade_card_capacity: 4 })).toBe(
      false
    );
    expect(storePrerequisiteMet("upgrade_card_capacity_mega", { upgrade_card_capacity: 5 })).toBe(
      true
    );
  });
});
