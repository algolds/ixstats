/** @jest-environment node */
/**
 * Card trades (spec §2.2, §2.3): offering a table, and ending one (the responder rejects, the proposer withdraws).
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
import { claimPendingTradeTx, lockCardsTx, unlockCardsTx } from "~/lib/vault/trade-settlement";
import { notifyCard } from "~/lib/cards/card-notify";
import { refusesTradeOffer } from "~/server/shared/privacy-permissions";
import { getVaultConfig } from "~/lib/vault/vault-perks";
import {
  assertTradingOpen,
  cancelTradeOffer,
  createTradeOffer,
  rejectTradeOffer,
  TRADE_TTL_MS,
} from "~/server/modules/cards/trading/trade-service";
import {
  ALICE,
  ascending,
  BOB,
  cardOf,
  copy,
  COUNTERED,
  makeDb,
  nameOf,
  NEXT_EXPIRY,
  NOW,
  offer,
  OPEN,
  order,
  PENDING,
  resetTradeMocks,
  TABLE_AT,
  TRADES_HREF,
} from "./trade-fixtures";

beforeEach(() => {
  jest.clearAllMocks();
  resetTradeMocks();
});

afterEach(() => jest.restoreAllMocks());

describe("assertTradingOpen", () => {
  it("closes trading in maintenance and while P2P trading is switched off", () => {
    expect(() => assertTradingOpen(OPEN as never)).not.toThrow();
    expect(() => assertTradingOpen({ ...OPEN, isMaintenanceMode: true } as never)).toThrow(
      expect.objectContaining({
        code: "BAD_REQUEST",
        message: "Vault economy is currently in maintenance mode.",
      })
    );
    expect(() => assertTradingOpen({ ...OPEN, isTradingEnabled: false } as never)).toThrow(
      expect.objectContaining({
        code: "BAD_REQUEST",
        message: "Card trading is switched off right now.",
      })
    );
  });

  it("gives a table 24 hours", () => {
    expect(TRADE_TTL_MS).toBe(86_400_000);
  });
});

describe("createTradeOffer", () => {
  it("locks the proposer's cards, then opens a pending table with them as proposer, and tells the partner", async () => {
    const { db, tx } = makeDb([copy("a1", "alice"), copy("b1", "bob")]);
    const trade = await createTradeOffer(db as never, offer({}, { message: "Swap?" }));

    expect(db.user.findUnique).toHaveBeenCalledWith({
      where: { id: "bob" },
      select: { id: true, clerkUserId: true },
    });
    expect(refusesTradeOffer).toHaveBeenCalledWith(db, "user_alice", "user_bob");
    expect(lockCardsTx).toHaveBeenCalledWith(tx, ["a1"], "alice");
    expect(tx.tradeOffer.create).toHaveBeenCalledWith({
      data: {
        initiatorId: "alice",
        recipientId: "bob",
        proposerId: "alice",
        initiatorCardIds: ["a1"],
        recipientCardIds: ["b1"],
        initiatorCredits: 0,
        recipientCredits: 0,
        message: "Swap?",
        status: "PENDING",
        expiresAt: NEXT_EXPIRY,
      },
    });
    expect(ascending(order(jest.mocked(lockCardsTx), tx.tradeOffer.create))).toBe(true);
    expect(trade).toMatchObject({ id: "t1", proposerId: "alice", status: "PENDING" });
    expect(nameOf).toHaveBeenCalledWith("alice");
    expect(notifyCard).toHaveBeenCalledWith(db, {
      userId: "bob",
      title: "New trade offer",
      message: "@alice sent you a trade offer: 1 card for 1 card.",
      href: TRADES_HREF,
      priority: "high",
      metadata: { tradeId: "t1" },
    });
  });

  it("stores no message when none is given, and names a sender with no name, or whose name fails, a player", async () => {
    const { db, tx } = makeDb([copy("a1", "alice"), copy("b1", "bob")]);
    nameOf.mockResolvedValueOnce(null as never);
    await createTradeOffer(db as never, offer({}));
    expect(tx.tradeOffer.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ message: null }),
    });
    expect(jest.mocked(notifyCard).mock.calls[0]![1].message).toBe(
      "A player sent you a trade offer: 1 card for 1 card."
    );

    nameOf.mockRejectedValueOnce(new Error("names down"));
    await createTradeOffer(db as never, offer({}));
    expect(jest.mocked(notifyCard).mock.calls[1]![1].message).toMatch(/^A player sent you/);
  });

  it("allows credits for a card, a gift, and a signed copy", async () => {
    const { db } = makeDb([copy("a1", "alice", { inscribedAt: TABLE_AT }), copy("b1", "bob")]);
    await expect(
      createTradeOffer(db as never, offer({ initiatorCardIds: [], initiatorCredits: 500 }))
    ).resolves.toBeDefined();
    await expect(
      createTradeOffer(db as never, offer({ recipientCardIds: [] }))
    ).resolves.toBeDefined();
    expect(lockCardsTx).toHaveBeenLastCalledWith(expect.anything(), ["a1"], "alice");
  });

  it("refuses a bad table, a trade with yourself, and a partner who is not there, before reading any card", async () => {
    const { db } = makeDb([copy("a1", "alice")]);
    await expect(
      createTradeOffer(
        db as never,
        offer({ initiatorCardIds: [], recipientCardIds: [], initiatorCredits: 500 })
      )
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Add at least one card. Credits alone can't be traded.",
    });
    await expect(
      createTradeOffer(db as never, offer({}, { partnerId: "alice" }))
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Choose another player to trade with.",
    });
    db.user.findUnique.mockResolvedValueOnce(null);
    await expect(createTradeOffer(db as never, offer({}))).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(db.cardOwnership.findMany).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("refuses a partner who refuses offers from the sender", async () => {
    const { db } = makeDb([copy("a1", "alice"), copy("b1", "bob")]);
    jest.mocked(refusesTradeOffer).mockResolvedValueOnce(true);
    await expect(createTradeOffer(db as never, offer({}))).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("refuses bound copies, copies that are not the player's, and copies listed or in another trade", async () => {
    const bound = copy("a1", "alice", { cards: cardOf(copy("a1", "alice"), { isBound: true }) });
    await expect(
      createTradeOffer(makeDb([bound, copy("b1", "bob")]).db as never, offer({}))
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    await expect(
      createTradeOffer(makeDb([copy("a1", "alice"), copy("b1", "carol")]).db as never, offer({}))
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "Some cards in this trade are no longer that player's.",
    });
    await expect(
      createTradeOffer(
        makeDb([copy("a1", "alice", { isLocked: true }), copy("b1", "bob")]).db as never,
        offer({})
      )
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "Some cards in this trade are listed, at auction or in another trade.",
    });
    await expect(
      createTradeOffer(
        makeDb([copy("a1", "alice"), copy("b1", "bob", { isLocked: true })]).db as never,
        offer({})
      )
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(lockCardsTx).not.toHaveBeenCalled();
  });

  it("checks the proposer can pay what they offer, exactly their balance included", async () => {
    const { db } = makeDb([copy("a1", "alice"), copy("b1", "bob")], { credits: 500 });
    await expect(
      createTradeOffer(db as never, offer({ initiatorCredits: 500 }))
    ).resolves.toBeDefined();
    expect(db.myVault.findUnique).toHaveBeenCalledWith({
      where: { userId: "alice" },
      select: { credits: true },
    });
    await expect(
      createTradeOffer(db as never, offer({ initiatorCredits: 501 }))
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "You don't have enough IxCredits for this trade.",
    });
    db.myVault.findUnique.mockResolvedValueOnce(null);
    await expect(
      createTradeOffer(db as never, offer({ initiatorCredits: 1 }))
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    // Asking for credits needs none of the proposer's
    db.myVault.findUnique.mockClear();
    await createTradeOffer(db as never, offer({ recipientCredits: 900 }));
    expect(db.myVault.findUnique).not.toHaveBeenCalled();
  });

  it("is closed while trading is", async () => {
    const { db } = makeDb([copy("a1", "alice"), copy("b1", "bob")]);
    jest
      .mocked(getVaultConfig)
      .mockResolvedValueOnce({ ...OPEN, isTradingEnabled: false } as never);
    await expect(createTradeOffer(db as never, offer({}))).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });
});

describe("ending a trade", () => {
  const end = (user: typeof ALICE) => ({ user, tradeId: "t1", now: NOW });

  it("the responder rejects and the proposer withdraws; both unlock the proposer's cards at the revision read", async () => {
    const rejected = makeDb([]);
    await expect(rejectTradeOffer(rejected.db as never, end(BOB))).resolves.toMatchObject({
      revision: 99,
    });
    expect(claimPendingTradeTx).toHaveBeenLastCalledWith(rejected.tx, {
      tradeId: "t1",
      next: "REJECTED",
      now: NOW,
      revision: 0,
    });
    expect(unlockCardsTx).toHaveBeenLastCalledWith(rejected.tx, ["a1"], "alice");
    expect(
      ascending(
        order(
          jest.mocked(claimPendingTradeTx),
          jest.mocked(unlockCardsTx),
          rejected.tx.tradeOffer.findUniqueOrThrow
        )
      )
    ).toBe(true);

    const cancelled = makeDb([]);
    await cancelTradeOffer(cancelled.db as never, end(ALICE));
    expect(claimPendingTradeTx).toHaveBeenLastCalledWith(cancelled.tx, {
      tradeId: "t1",
      next: "CANCELLED",
      now: NOW,
      revision: 0,
    });
    expect(unlockCardsTx).toHaveBeenLastCalledWith(cancelled.tx, ["a1"], "alice");
  });

  it("follows the proposer after a counter-offer", async () => {
    const { db, tx } = makeDb([], { trade: COUNTERED });
    await cancelTradeOffer(db as never, end(BOB));
    expect(claimPendingTradeTx).toHaveBeenLastCalledWith(tx, {
      tradeId: "t1",
      next: "CANCELLED",
      now: NOW,
      revision: 1,
    });
    expect(unlockCardsTx).toHaveBeenLastCalledWith(tx, ["b1"], "bob");
    await rejectTradeOffer(db as never, end(ALICE));
    expect(unlockCardsTx).toHaveBeenLastCalledWith(tx, ["b1"], "bob");
  });

  it("refuses the wrong party, and a trade that ended", async () => {
    await expect(rejectTradeOffer(makeDb([]).db as never, end(ALICE))).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Withdraw your own offer instead.",
    });
    await expect(cancelTradeOffer(makeDb([]).db as never, end(BOB))).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Only the player whose offer it is can withdraw it.",
    });
    await expect(
      cancelTradeOffer(
        makeDb([], { trade: { ...PENDING, status: "REJECTED" } }).db as never,
        end(ALICE)
      )
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(claimPendingTradeTx).not.toHaveBeenCalled();
  });

  it("unlocks nothing when the claim is lost (a counter or an accept got there first)", async () => {
    jest
      .mocked(claimPendingTradeTx)
      .mockRejectedValueOnce(Object.assign(new Error("changed"), { code: "CONFLICT" }));
    await expect(cancelTradeOffer(makeDb([]).db as never, end(ALICE))).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(unlockCardsTx).not.toHaveBeenCalled();
  });

  it("works while trading is closed, so a player can always free their cards", async () => {
    jest.mocked(getVaultConfig).mockResolvedValue({ ...OPEN, isMaintenanceMode: true } as never);
    await expect(cancelTradeOffer(makeDb([]).db as never, end(ALICE))).resolves.toBeDefined();
    await expect(rejectTradeOffer(makeDb([]).db as never, end(BOB))).resolves.toBeDefined();
  });
});
