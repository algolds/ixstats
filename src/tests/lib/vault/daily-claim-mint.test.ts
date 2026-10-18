/** @jest-environment node */
/**
 * Cards refresh §5.4: the daily card is a copy minted through mintCopy (source DAILY_CLAIM), its finish rolled, after
 * the owner's capacity lock (7334) and before the card's serial lock (7331).
 */

jest.mock("~/lib/cards/xp-utils", () => ({
  grantCardXp: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("~/lib/vault/vault-ledger", () => ({
  ...jest.requireActual("~/lib/vault/vault-ledger"),
  getOrCreateVault: jest.fn(),
}));

import { clearEconomyConfigCache } from "~/lib/cards/economy-config";
import { grantCardXp } from "~/lib/cards/xp-utils";
import { getOrCreateVault } from "~/lib/vault/vault-ledger";
import { claimCombinedDailyClaim } from "~/lib/vault/vault-daily-bonus";
import { clearUserPerksCache, invalidateVaultConfigCache } from "~/lib/vault/vault-perks";
import { createMockPrisma } from "~/tests/helpers/transactional-mock-db";

/** The app client and the transaction's own client; only the transaction client can take a lock. */
function makeDb() {
  const db = createMockPrisma();
  // A tagged template call: the SQL's strings, then the lock's namespace and key
  const lock = jest
    .fn<Promise<number>, [TemplateStringsArray, number, string]>()
    .mockResolvedValue(1);
  const tx = createMockPrisma({ $executeRaw: lock });
  db.$transaction = jest.fn((cb: (client: typeof tx) => Promise<never>) => cb(tx));
  // Every finish roll lands on Foil
  tx.systemConfig.findMany = jest
    .fn()
    .mockResolvedValue([{ key: "card_economy_finish_foil_pct", value: "100" }]);
  tx.myVault.updateMany = jest.fn().mockResolvedValue({ count: 1 });
  tx.cardOwnership.count = jest.fn().mockResolvedValue(3);
  tx.card.groupBy = jest.fn().mockResolvedValue([{ rarity: "COMMON", _count: { _all: 1 } }]);
  tx.card.findFirst = jest
    .fn()
    .mockResolvedValue({ id: "card_1", title: "Test Card", rarity: "COMMON", artwork: null });
  tx.cardOwnership.findFirst = jest.fn().mockResolvedValue({ serialNumber: 4 });
  tx.cardOwnership.create = jest
    .fn()
    .mockResolvedValue({ id: "co_1", serialNumber: 5, finish: "FOIL" });
  return { db, tx, lock };
}

beforeEach(() => {
  clearEconomyConfigCache();
  invalidateVaultConfigCache();
  clearUserPerksCache();
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.mocked(getOrCreateVault).mockResolvedValue({
    id: "vault_1",
    userId: "user_1",
    credits: 100,
    loginStreak: 3,
    lastLoginDate: new Date(Date.UTC(2020, 0, 1)),
    vaultLevel: 1,
  } as never);
});
afterEach(() => jest.restoreAllMocks());

it("mints a copy with a rolled finish and a DAILY_CLAIM mint row, and grants it XP", async () => {
  const { db, tx } = makeDb();

  const result = await claimCombinedDailyClaim("user_1", "CARD", db as never);

  expect(result).toMatchObject({
    success: true,
    rewardType: "card",
    cardAwarded: { finish: "FOIL" },
  });
  expect(tx.cardOwnership.create).toHaveBeenCalledWith({
    data: {
      cardId: "card_1",
      ownerId: "user_1",
      serialNumber: 5,
      finish: "FOIL",
      importDiscounted: false,
    },
  });
  expect(tx.cardTransferEvent.create).toHaveBeenCalledWith({
    data: {
      ownershipId: "co_1",
      cardId: "card_1",
      serialNumber: 5,
      finish: "FOIL",
      toUserId: "user_1",
      action: "DAILY_CLAIM",
    },
  });
  expect(grantCardXp).toHaveBeenCalledWith(
    tx,
    "co_1",
    "DAILY_CLAIM",
    JSON.stringify({ cardId: "card_1" }),
    expect.any(Date)
  );
});

it("takes the owner's capacity lock before the card's serial lock, both in the claim's transaction", async () => {
  const { db, lock } = makeDb();

  await claimCombinedDailyClaim("user_1", "CARD", db as never);

  const locks = lock.mock.calls.map(([, namespace, key]) => [namespace, key]);
  expect(locks).toEqual([
    [7334, "user_1"],
    [7331, "card_1"],
  ]);
});

it("mints nothing when the collection is full", async () => {
  const { db, tx, lock } = makeDb();
  tx.cardOwnership.count = jest.fn().mockResolvedValue(150);

  const result = await claimCombinedDailyClaim("user_1", "CARD", db as never);

  expect(result).toMatchObject({
    success: false,
    message: expect.stringMatching(/collection is full/),
  });
  expect(tx.cardOwnership.create).not.toHaveBeenCalled();
  expect(lock).toHaveBeenCalledTimes(1);
});
