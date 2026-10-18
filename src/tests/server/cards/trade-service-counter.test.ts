/** @jest-environment node */
/**
 * Card trades (spec §2.2, §2.3): a counter-offer edits the same row, and the roles swap.
 * The doubles are in trade-fixtures.ts.
 */
jest.mock("~/lib/vault/trade-settlement", () => ({
  claimPendingTradeTx: jest.fn(),
  lockCardsTx: jest.fn(),
  unlockCardsTx: jest.fn(),
  transferCardsTx: jest.fn(),
  recordTradeTransfersTx: jest.fn(),
}));
jest.mock("~/lib/cards/market/credit-leg", () => ({
  lockCreditLegVaultsTx: jest.fn(),
  settleCreditLegTx: jest.fn(),
}));
jest.mock("~/lib/cards/xp-utils", () => ({ grantCardXp: jest.fn() }));
jest.mock("~/lib/cards/card-notify", () => ({ notifyCard: jest.fn(), notifyCards: jest.fn() }));
jest.mock("~/server/shared/privacy-permissions", () => ({ refusesTradeOffer: jest.fn() }));
jest.mock("~/lib/vault/vault-perks", () => ({ getVaultConfig: jest.fn() }));
import { lockCardsTx, unlockCardsTx } from "~/lib/vault/trade-settlement";
import { notifyCard } from "~/lib/cards/card-notify";
import { getVaultConfig } from "~/lib/vault/vault-perks";
import { counterTradeOffer } from "~/server/modules/cards/trading/trade-service";
import {
  ALICE,
  ascending,
  BOB,
  copy,
  COUNTERED,
  makeDb,
  nameOf,
  NEXT_EXPIRY,
  NOW,
  OPEN,
  order,
  PENDING,
  resetTradeMocks,
  TRADES_HREF,
} from "./trade-fixtures";

beforeEach(() => {
  jest.clearAllMocks();
  resetTradeMocks();
});

afterEach(() => jest.restoreAllMocks());

describe("counterTradeOffer", () => {
  const table = {
    initiatorCardIds: ["a1", "a2"],
    recipientCardIds: ["b1"],
    initiatorCredits: 0,
    recipientCredits: 0,
  };
  const counter = (user = BOB, over: object = {}) => ({
    user,
    tradeId: "t1",
    revision: 0,
    table,
    now: NOW,
    nameOf,
    ...over,
  });

  it("edits the same row: Bob becomes proposer, Alice's cards unlock and Bob's lock, and Alice hears of it", async () => {
    const { db, tx } = makeDb([
      copy("a1", "alice", { isLocked: true }),
      copy("a2", "alice"),
      copy("b1", "bob"),
    ]);
    const updated = await counterTradeOffer(db as never, counter(BOB, { message: "Add a2?" }));

    expect(tx.tradeOffer.updateMany).toHaveBeenCalledWith({
      where: {
        id: "t1",
        status: "PENDING",
        revision: 0,
        proposerId: "alice",
        expiresAt: { gt: NOW },
      },
      data: {
        ...table,
        message: "Add a2?",
        proposerId: "bob",
        revision: { increment: 1 },
        expiresAt: NEXT_EXPIRY,
        // The table's time, which accepting compares signatures against
        updatedAt: NOW,
      },
    });
    expect(unlockCardsTx).toHaveBeenCalledWith(tx, ["a1"], "alice");
    expect(lockCardsTx).toHaveBeenCalledWith(tx, ["b1"], "bob");
    expect(
      ascending(
        order(
          tx.tradeOffer.updateMany,
          jest.mocked(unlockCardsTx),
          jest.mocked(lockCardsTx),
          tx.tradeOffer.findUniqueOrThrow
        )
      )
    ).toBe(true);
    expect(tx.tradeOffer.findUniqueOrThrow).toHaveBeenCalledWith({ where: { id: "t1" } });
    expect(updated).toMatchObject({ revision: 99 });
    expect(notifyCard).toHaveBeenCalledWith(db, {
      userId: "alice",
      title: "Counter-offer",
      message: "@bob countered: 1 card for 2 cards.",
      href: TRADES_HREF,
      priority: "high",
      metadata: { tradeId: "t1" },
    });
    expect(jest.mocked(notifyCard).mock.invocationCallOrder[0]).toBeGreaterThan(
      tx.tradeOffer.findUniqueOrThrow.mock.invocationCallOrder[0]!
    );
  });

  it("swaps back when Alice counters Bob's counter", async () => {
    const { db, tx } = makeDb([copy("a1", "alice"), copy("b1", "bob", { isLocked: true })], {
      trade: COUNTERED,
    });
    await counterTradeOffer(
      db as never,
      counter(ALICE, {
        revision: 1,
        table: { ...table, initiatorCardIds: ["a1"], initiatorCredits: 40 },
      })
    );
    expect(tx.tradeOffer.updateMany.mock.calls[0]![0].where).toEqual({
      id: "t1",
      status: "PENDING",
      revision: 1,
      proposerId: "bob",
      expiresAt: { gt: NOW },
    });
    expect(tx.tradeOffer.updateMany.mock.calls[0]![0].data).toMatchObject({
      proposerId: "alice",
      message: null,
    });
    expect(unlockCardsTx).toHaveBeenCalledWith(tx, ["b1"], "bob");
    expect(lockCardsTx).toHaveBeenCalledWith(tx, ["a1"], "alice");
    expect(db.myVault.findUnique).toHaveBeenCalledWith({
      where: { userId: "alice" },
      select: { credits: true },
    });
    expect(jest.mocked(notifyCard).mock.calls[0]![1]).toMatchObject({
      userId: "bob",
      message: "@alice countered: 1 card and 40 IxC for 1 card.",
    });
  });

  it("may ask for the cards this trade holds locked, but no other locked card on either side", async () => {
    const held = [copy("a1", "alice", { isLocked: true }), copy("b1", "bob")];
    await expect(
      counterTradeOffer(
        makeDb([...held, copy("a2", "alice", { isLocked: true })]).db as never,
        counter()
      )
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      counterTradeOffer(
        makeDb([
          copy("a1", "alice", { isLocked: true }),
          copy("a2", "alice"),
          copy("b1", "bob", { isLocked: true }),
        ]).db as never,
        counter()
      )
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(lockCardsTx).not.toHaveBeenCalled();
  });

  it("refuses the proposer countering their own table, a stale revision, and a bad table, changing nothing", async () => {
    const { db, tx } = makeDb([
      copy("a1", "alice", { isLocked: true }),
      copy("a2", "alice"),
      copy("b1", "bob"),
    ]);
    await expect(counterTradeOffer(db as never, counter(ALICE))).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      counterTradeOffer(db as never, counter(BOB, { revision: 3 }))
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "This trade changed. Review the latest table.",
    });
    await expect(
      counterTradeOffer(
        db as never,
        counter(BOB, { table: { ...table, recipientCardIds: ["a1"] } })
      )
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "A card can only be in the trade once.",
    });
    expect(tx.tradeOffer.updateMany).not.toHaveBeenCalled();
  });

  it("checks the counterer can pay what they offer", async () => {
    const { db } = makeDb(
      [copy("a1", "alice", { isLocked: true }), copy("a2", "alice"), copy("b1", "bob")],
      {
        credits: 10,
      }
    );
    await expect(
      counterTradeOffer(db as never, counter(BOB, { table: { ...table, recipientCredits: 11 } }))
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.myVault.findUnique).toHaveBeenCalledWith({
      where: { userId: "bob" },
      select: { credits: true },
    });
  });

  it("changes nothing when the table moved on first", async () => {
    const { db } = makeDb(
      [copy("a1", "alice", { isLocked: true }), copy("a2", "alice"), copy("b1", "bob")],
      {
        claimed: 0,
      }
    );
    await expect(counterTradeOffer(db as never, counter())).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(unlockCardsTx).not.toHaveBeenCalled();
    expect(lockCardsTx).not.toHaveBeenCalled();
    expect(notifyCard).not.toHaveBeenCalled();
  });

  it("is closed while trading is, and for a trade that ended or expired", async () => {
    const copies = [
      copy("a1", "alice", { isLocked: true }),
      copy("a2", "alice"),
      copy("b1", "bob"),
    ];
    jest
      .mocked(getVaultConfig)
      .mockResolvedValueOnce({ ...OPEN, isMaintenanceMode: true } as never);
    await expect(counterTradeOffer(makeDb(copies).db as never, counter())).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(
      counterTradeOffer(
        makeDb(copies, { trade: { ...PENDING, status: "ACCEPTED" } }).db as never,
        counter()
      )
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: "This trade is no longer open." });
    await expect(
      counterTradeOffer(
        makeDb(copies, { trade: { ...PENDING, expiresAt: NOW } }).db as never,
        counter()
      )
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: "This trade is no longer open." });
  });
});
