/**
 * Plan 331: P2P trade transitions are conditional writes inside one transaction.
 * The mock `$transaction` runs the callback against the same mock db; a real
 * database would roll back, so the assertions check that later writes were never
 * attempted once a precondition failed.
 */

jest.mock("~/lib/vault/vault-service", () => ({
  getVaultConfig: jest.fn(),
}));
// vault-ledger <-> vault-passive-income import each other; without this mock the
// re-entrant require would spread a half-initialised ledger (TDZ on LedgerError).
jest.mock("~/lib/vault/vault-passive-income", () => ({
  catchUpPassiveIncome: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("~/lib/vault/vault-ledger", () => ({
  ...jest.requireActual("~/lib/vault/vault-ledger"),
  earnCreditsTx: jest.fn(),
  spendCreditsTx: jest.fn(),
}));
jest.mock("~/lib/notifications/api", () => ({
  notificationAPI: { create: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock("~/lib/cache", () => ({
  ...jest.requireActual("~/lib/cache"), // the tRPC context needs the real Cache class
  globalCache: { delete: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock("~/lib/cards/xp-utils", () => ({
  grantCardXp: jest.fn().mockResolvedValue(undefined),
}));

import { createCallerFactory } from "~/server/api/trpc";
import { tradingOffersRouter } from "~/server/api/routers/trading/offers";
import { getVaultConfig } from "~/lib/vault/vault-service";
import { earnCreditsTx, LedgerError, spendCreditsTx } from "~/lib/vault/vault-ledger";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockDb, type MockPrismaProxy } from "~/tests/helpers/transactional-mock-db";

const createCaller = createCallerFactory(tradingOffersRouter);

const spendMock = jest.mocked(spendCreditsTx);
const earnMock = jest.mocked(earnCreditsTx);

// createMockRouterContext's default user is the recipient of the fixture trade.
const RECIPIENT = "user_db_id_1";
const INITIATOR = "user_init";

function makeTrade(overrides: Record<string, unknown> = {}) {
  return {
    id: "trade_1",
    initiatorId: INITIATOR,
    recipientId: RECIPIENT,
    initiatorCardIds: ["ci_1"],
    recipientCardIds: ["cr_1", "cr_2"],
    initiatorCredits: 50,
    recipientCredits: 0,
    status: "PENDING",
    expiresAt: new Date(Date.now() + 3_600_000),
    initiator: { id: INITIATOR, clerkUserId: "clerk_init" },
    recipient: { id: RECIPIENT, clerkUserId: "test_user_clerk_id" },
    ...overrides,
  };
}

function makeCaller(trade = makeTrade()) {
  const db = createMockDb();
  // Run transaction callbacks against the proxy so models first touched inside a
  // transaction are auto-mocked (the helper's default hands the callback the raw target).
  db.$transaction = jest.fn((cb: (tx: MockPrismaProxy) => Promise<never>) => cb(db));
  db.tradeOffer.findUnique = jest.fn().mockResolvedValue(trade as never);
  db.tradeOffer.findUniqueOrThrow = jest
    .fn()
    .mockResolvedValue({ ...trade, status: "ACCEPTED" } as never);
  const ctx = createMockRouterContext({ db });
  return { db, caller: createCaller(ctx as never) };
}

const acceptInput = { tradeId: "trade_1", action: "ACCEPT" as const };

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.mocked(getVaultConfig).mockResolvedValue({
    isMaintenanceMode: false,
    isTradingEnabled: true,
  } as never);
  spendMock.mockResolvedValue({ newBalance: 0, amount: 50 });
  earnMock.mockResolvedValue({ newBalance: 50, amount: 50 });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("respondToTrade ACCEPT", () => {
  it("concurrent accept: loses the conditional status write -> CONFLICT, no cards or credits move", async () => {
    const { db, caller } = makeCaller();
    db.tradeOffer.updateMany = jest.fn().mockResolvedValue({ count: 0 } as never);

    await expect(caller.respondToTrade(acceptInput)).rejects.toMatchObject({ code: "CONFLICT" });

    expect(db.tradeOffer.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "trade_1", status: "PENDING", expiresAt: { gt: expect.any(Date) } },
        data: { status: "ACCEPTED", respondedAt: expect.any(Date) },
      })
    );
    expect(db.cardOwnership.updateMany).not.toHaveBeenCalled();
    expect(spendMock).not.toHaveBeenCalled();
    expect(earnMock).not.toHaveBeenCalled();
    expect(db.myVault.update).not.toHaveBeenCalled();
  });

  it("insufficient balance at accept: guarded debit fails -> BAD_REQUEST, the other side is never credited", async () => {
    const { db, caller } = makeCaller();
    db.tradeOffer.updateMany = jest.fn().mockResolvedValue({ count: 1 } as never);
    db.cardOwnership.updateMany = jest
      .fn()
      .mockResolvedValueOnce({ count: 1 } as never)
      .mockResolvedValueOnce({ count: 2 } as never);
    spendMock.mockRejectedValue(
      new LedgerError("INSUFFICIENT_CREDITS", "Insufficient credits for transaction.", 10)
    );

    await expect(caller.respondToTrade(acceptInput)).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });

    expect(spendMock).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ userId: INITIATOR, amount: 50, type: "SPEND_MARKET" })
    );
    expect(earnMock).not.toHaveBeenCalled();
    expect(db.myVault.update).not.toHaveBeenCalled();
  });

  it("recipient card moved: the owner-scoped transfer matches fewer rows -> CONFLICT, no credits move", async () => {
    const { db, caller } = makeCaller();
    db.tradeOffer.updateMany = jest.fn().mockResolvedValue({ count: 1 } as never);
    db.cardOwnership.updateMany = jest
      .fn()
      .mockResolvedValueOnce({ count: 1 } as never)
      .mockResolvedValueOnce({ count: 1 } as never); // 2 requested

    await expect(caller.respondToTrade(acceptInput)).rejects.toMatchObject({ code: "CONFLICT" });

    expect(db.cardOwnership.updateMany).toHaveBeenCalledTimes(2);
    expect(spendMock).not.toHaveBeenCalled();
    expect(earnMock).not.toHaveBeenCalled();
  });

  it("happy path: both owner-scoped transfers run, credits move through the ledger, the trade is returned", async () => {
    const { db, caller } = makeCaller();
    db.tradeOffer.updateMany = jest.fn().mockResolvedValue({ count: 1 } as never);
    db.cardOwnership.updateMany = jest
      .fn()
      .mockResolvedValueOnce({ count: 1 } as never)
      .mockResolvedValueOnce({ count: 2 } as never);

    const result = await caller.respondToTrade(acceptInput);

    expect(result).toMatchObject({ id: "trade_1", status: "ACCEPTED" });
    expect(db.cardOwnership.updateMany).toHaveBeenCalledTimes(2);
    expect(db.cardOwnership.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: { in: ["ci_1"] }, ownerId: INITIATOR, isLocked: true },
      data: expect.objectContaining({ ownerId: RECIPIENT, userId: RECIPIENT, isLocked: false }),
    });
    expect(db.cardOwnership.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: { in: ["cr_1", "cr_2"] }, ownerId: RECIPIENT, isLocked: false },
      data: expect.objectContaining({ ownerId: INITIATOR, userId: INITIATOR, isLocked: false }),
    });
    expect(spendMock).toHaveBeenCalledTimes(1);
    expect(earnMock).toHaveBeenCalledTimes(1);
    expect(earnMock).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ userId: RECIPIENT, amount: 50, type: "EARN_CARDS" })
    );
    expect(db.tradeOffer.update).not.toHaveBeenCalled();
  });

  it("expired trade: expires it only if still PENDING and releases the initiator's locked cards", async () => {
    const { db, caller } = makeCaller(makeTrade({ expiresAt: new Date(Date.now() - 1000) }));
    db.tradeOffer.updateMany = jest.fn().mockResolvedValue({ count: 1 } as never);
    db.cardOwnership.updateMany = jest.fn().mockResolvedValue({ count: 1 } as never);

    await expect(caller.respondToTrade(acceptInput)).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Trade has expired",
    });

    expect(db.tradeOffer.updateMany).toHaveBeenCalledWith({
      where: { id: "trade_1", status: "PENDING" },
      data: { status: "EXPIRED" },
    });
    expect(db.cardOwnership.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["ci_1"] }, ownerId: INITIATOR },
      data: { isLocked: false },
    });
  });
});

describe("createtradeOffer", () => {
  it("refuses a recipient whose trade-offer setting excludes the sender (SL-4)", async () => {
    const { db, caller } = makeCaller();
    db.user.findUnique = jest.fn().mockResolvedValue({ id: "user_recip" } as never);
    db.userConnection.findMany = jest.fn(async (args: any) =>
      args.where.connectionType === "privacy_config"
        ? [{ userId: "clerk_recip", status: JSON.stringify({ tradeOffers: "nobody" }) }]
        : []
    ) as never;

    await expect(
      caller.createtradeOffer({
        recipientId: "clerk_recip",
        initiatorCardIds: ["ci_1"],
        recipientCardIds: ["cr_1"],
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.tradeOffer.create).not.toHaveBeenCalled();
  });

  it("double lock: a card already locked elsewhere fails the lock -> CONFLICT, no offer created", async () => {
    const { db, caller } = makeCaller();
    db.user.findUnique = jest.fn().mockResolvedValue({ id: "user_recip" } as never);
    db.cardOwnership.findMany = jest
      .fn()
      .mockResolvedValueOnce([
        { id: "ci_1", inscription: null, cards: { marketValue: 10 } },
      ] as never)
      .mockResolvedValueOnce([
        { id: "cr_1", inscription: null, cards: { marketValue: 5 } },
      ] as never);
    db.cardOwnership.updateMany = jest.fn().mockResolvedValue({ count: 0 } as never);

    await expect(
      caller.createtradeOffer({
        recipientId: "clerk_recip",
        initiatorCardIds: ["ci_1"],
        recipientCardIds: ["cr_1"],
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });

    expect(db.cardOwnership.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["ci_1"] }, ownerId: RECIPIENT, isLocked: false },
      data: { isLocked: true },
    });
    expect(db.tradeOffer.create).not.toHaveBeenCalled();
  });
});

describe("cancelTrade", () => {
  it("loses the race against an accept -> CONFLICT, cards are not unlocked", async () => {
    const { db, caller } = makeCaller(makeTrade({ initiatorId: RECIPIENT }));
    db.tradeOffer.updateMany = jest.fn().mockResolvedValue({ count: 0 } as never);

    await expect(caller.cancelTrade({ tradeId: "trade_1" })).rejects.toMatchObject({
      code: "CONFLICT",
    });

    expect(db.tradeOffer.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "trade_1", status: "PENDING" } })
    );
    expect(db.cardOwnership.updateMany).not.toHaveBeenCalled();
  });
});
