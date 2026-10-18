/** @jest-environment node */
/** Cards refresh §5.4: the daily card is a standard copy minted through mintCopy (source DAILY_CLAIM). */

jest.mock("~/lib/cards/xp-utils", () => ({
  grantCardXp: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("~/lib/vault/vault-ledger", () => ({
  ...jest.requireActual("~/lib/vault/vault-ledger"),
  getOrCreateVault: jest.fn(),
}));

import { grantCardXp } from "~/lib/cards/xp-utils";
import { getOrCreateVault } from "~/lib/vault/vault-ledger";
import { claimCombinedDailyClaim } from "~/lib/vault/vault-daily-bonus";
import { createMockPrisma, type MockPrismaProxy } from "~/tests/helpers/transactional-mock-db";

function makeDb(): MockPrismaProxy {
  const db = createMockPrisma({ $executeRaw: jest.fn().mockResolvedValue(1) });
  db.$transaction = jest.fn((cb: (tx: MockPrismaProxy) => Promise<never>) => cb(db));
  db.myVault.updateMany = jest.fn().mockResolvedValue({ count: 1 });
  db.card.count = jest.fn().mockResolvedValue(1);
  db.card.findFirst = jest
    .fn()
    .mockResolvedValue({ id: "card_1", title: "Test Card", rarity: "COMMON", artwork: null });
  db.cardOwnership.findFirst = jest.fn().mockResolvedValue({ serialNumber: 4 });
  db.cardOwnership.create = jest.fn().mockResolvedValue({ id: "co_1", serialNumber: 5 });
  return db;
}

beforeEach(() => {
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

it("mints a standard copy with a DAILY_CLAIM mint row and grants it XP", async () => {
  const db = makeDb();

  const result = await claimCombinedDailyClaim("user_1", "CARD", db as never);

  expect(result).toMatchObject({ success: true, rewardType: "card" });
  expect(db.cardOwnership.create).toHaveBeenCalledWith({
    data: {
      cardId: "card_1",
      ownerId: "user_1",
      serialNumber: 5,
      finish: "STANDARD",
      importDiscounted: false,
    },
  });
  expect(db.cardTransferEvent.create).toHaveBeenCalledWith({
    data: {
      ownershipId: "co_1",
      cardId: "card_1",
      serialNumber: 5,
      finish: "STANDARD",
      toUserId: "user_1",
      action: "DAILY_CLAIM",
    },
  });
  expect(grantCardXp).toHaveBeenCalledWith(
    db,
    "co_1",
    "DAILY_CLAIM",
    JSON.stringify({ cardId: "card_1" })
  );
});
