/** @jest-environment node */
/**
 * Card trades (spec §2.2, §2.3): accepting settles every copy and credit in one transaction.
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
import { Prisma } from "@prisma/client";
import {
  claimPendingTradeTx,
  recordTradeTransfersTx,
  transferCardsTx,
} from "~/lib/vault/trade-settlement";
import { lockCreditLegVaultsTx, settleCreditLegTx } from "~/lib/cards/market/credit-leg";
import { grantCardXp } from "~/lib/cards/xp-utils";
import { notifyCards } from "~/lib/cards/card-notify";
import { getVaultConfig } from "~/lib/vault/vault-perks";
import { acceptTradeOffer } from "~/server/modules/cards/trading/trade-service";
import {
  ALICE,
  ascending,
  BOB,
  cardOf,
  copy,
  COUNTERED,
  DAY_START,
  HOUR_MS,
  makeDb,
  nameOf,
  NOW,
  OPEN,
  order,
  PENDING,
  resetTradeMocks,
  TABLE_AT,
  TRADES_HREF,
  type CopyRow,
} from "./trade-fixtures";

beforeEach(() => {
  jest.clearAllMocks();
  resetTradeMocks();
});

afterEach(() => jest.restoreAllMocks());

describe("acceptTradeOffer", () => {
  const accept = (user = BOB, over: object = {}) => ({
    user,
    tradeId: "t1",
    revision: 0,
    now: NOW,
    nameOf,
    ...over,
  });
  const nation = (row: CopyRow) => ({
    ...row,
    cards: cardOf(row, { cardType: "NATION", countryId: "c1", realmId: "eurth", title: "Eurth" }),
  });

  it("moves both sides, settles each credit leg against the cards it pays for, logs XP and moves, and stores cross-realm", async () => {
    const a1 = nation(copy("a1", "alice", { isLocked: true }));
    const { db, tx } = makeDb([a1, copy("b1", "bob")]);
    jest
      .mocked(settleCreditLegTx)
      .mockResolvedValueOnce({ fee: 0, net: 0, royalties: [] })
      .mockResolvedValueOnce({
        fee: 30,
        net: 270,
        royalties: [{ recipientId: "carol", amount: 6, cardId: "card_a1" }],
      });

    const { trade, royaltyRecipientIds } = await acceptTradeOffer(db as never, accept());

    const legs = [
      {
        fromUserId: "alice",
        toUserId: "bob",
        amount: 0,
        tradeId: "t1",
        paidFor: [{ cardId: "card_b1", cardType: "LORE", countryId: null }],
      },
      {
        fromUserId: "bob",
        toUserId: "alice",
        amount: 300,
        tradeId: "t1",
        paidFor: [{ cardId: "card_a1", cardType: "NATION", countryId: "c1" }],
      },
    ];
    expect(claimPendingTradeTx).toHaveBeenCalledWith(tx, {
      tradeId: "t1",
      next: "ACCEPTED",
      now: NOW,
      revision: 0,
    });
    expect(lockCreditLegVaultsTx).toHaveBeenCalledWith(tx, legs);
    expect(transferCardsTx).toHaveBeenCalledWith(tx, {
      ids: ["a1"],
      fromId: "alice",
      toId: "bob",
      expectLocked: true,
      now: NOW,
    });
    // The responder's copies move only if still unsigned since the table (the signed-copy rule inside the CAS)
    expect(transferCardsTx).toHaveBeenCalledWith(tx, {
      ids: ["b1"],
      fromId: "bob",
      toId: "alice",
      expectLocked: false,
      now: NOW,
      notSignedAfter: TABLE_AT,
    });
    expect(jest.mocked(settleCreditLegTx).mock.calls).toEqual([
      [tx, legs[0]],
      [tx, legs[1]],
    ]);
    // The claim, then every vault, then the copies, then the credits
    expect(
      ascending(
        order(
          jest.mocked(claimPendingTradeTx),
          jest.mocked(lockCreditLegVaultsTx),
          jest.mocked(transferCardsTx),
          jest.mocked(settleCreditLegTx)
        )
      )
    ).toBe(true);
    const xp = JSON.stringify({ tradeId: "t1" });
    expect(jest.mocked(grantCardXp).mock.calls).toEqual([
      [tx, "a1", "CROSS_REALM_TRADE", xp, NOW],
      [tx, "b1", "CROSS_REALM_TRADE", xp, NOW],
    ]);
    expect(jest.mocked(recordTradeTransfersTx).mock.calls).toEqual([
      [tx, { ids: ["a1"], fromId: "alice", toId: "bob", action: "TRADE" }],
      [tx, { ids: ["b1"], fromId: "bob", toId: "alice", action: "TRADE" }],
    ]);
    expect(tx.tradeOffer.update).toHaveBeenCalledWith({
      where: { id: "t1" },
      data: { isCrossRealm: true },
    });
    expect(trade).toMatchObject({ status: "ACCEPTED", isCrossRealm: true });
    expect(royaltyRecipientIds).toEqual(["carol"]);
    expect(nameOf).toHaveBeenCalledWith("bob");
    expect(notifyCards).toHaveBeenCalledWith(db, [
      {
        userId: "alice",
        title: "Trade accepted",
        message: "@bob accepted your trade.",
        type: "success",
        href: TRADES_HREF,
        metadata: { tradeId: "t1" },
      },
      expect.objectContaining({
        userId: "carol",
        cardId: "card_a1",
        title: "Royalty paid",
        message: expect.stringContaining("Eurth"),
      }),
    ]);
  });

  it("settles a countered table the other way round: Bob proposed, Alice accepts", async () => {
    const { db, tx } = makeDb([copy("a1", "alice"), copy("b1", "bob", { isLocked: true })], {
      trade: COUNTERED,
    });
    await acceptTradeOffer(db as never, accept(ALICE, { revision: 1 }));
    expect(claimPendingTradeTx).toHaveBeenCalledWith(tx, {
      tradeId: "t1",
      next: "ACCEPTED",
      now: NOW,
      revision: 1,
    });
    expect(transferCardsTx).toHaveBeenCalledWith(tx, {
      ids: ["b1"],
      fromId: "bob",
      toId: "alice",
      expectLocked: true,
      now: NOW,
    });
    expect(transferCardsTx).toHaveBeenCalledWith(tx, {
      ids: ["a1"],
      fromId: "alice",
      toId: "bob",
      expectLocked: false,
      now: NOW,
      notSignedAfter: TABLE_AT,
    });
    expect(
      jest.mocked(settleCreditLegTx).mock.calls.map(([, leg]) => [leg.fromUserId, leg.amount])
    ).toEqual([
      ["bob", 300],
      ["alice", 0],
    ]);
    expect(jest.mocked(notifyCards).mock.calls[0]![1][0]).toMatchObject({
      userId: "bob",
      message: "@alice accepted your trade.",
    });
  });

  it("refuses a stale revision and the proposer accepting their own table, moving nothing", async () => {
    const { db } = makeDb([copy("a1", "alice", { isLocked: true }), copy("b1", "bob")]);
    await expect(acceptTradeOffer(db as never, accept(BOB, { revision: 1 }))).rejects.toMatchObject(
      { code: "CONFLICT" }
    );
    await expect(acceptTradeOffer(db as never, accept(ALICE))).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Wait for the other player to respond.",
    });
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(notifyCards).not.toHaveBeenCalled();
  });

  it("refuses a responder's copy that is listed, moved, burned or bound, after the claim and before anything moves", async () => {
    const a1 = copy("a1", "alice", { isLocked: true });
    const cases: Array<[CopyRow | null, string]> = [
      [copy("b1", "bob", { isLocked: true }), "CONFLICT"],
      [copy("b1", "carol"), "CONFLICT"],
      // Broken down or fused since the offer: the copy row is gone
      [null, "CONFLICT"],
      [
        copy("b1", "bob", { cards: cardOf(copy("b1", "bob"), { isBound: true }) }),
        "PRECONDITION_FAILED",
      ],
    ];
    for (const [b1, code] of cases) {
      const copies = b1 ? [a1, b1] : [a1];
      await expect(acceptTradeOffer(makeDb(copies).db as never, accept())).rejects.toMatchObject({
        code,
      });
    }
    // The proposer's copy must still be theirs too
    await expect(
      acceptTradeOffer(
        makeDb([copy("a1", "carol", { isLocked: true }), copy("b1", "bob")]).db as never,
        accept()
      )
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(claimPendingTradeTx).toHaveBeenCalledTimes(5);
    expect(lockCreditLegVaultsTx).not.toHaveBeenCalled();
    expect(transferCardsTx).not.toHaveBeenCalled();
  });

  it("refuses a copy the responder gives that was signed after the table was written, and nothing else", async () => {
    const a1 = copy("a1", "alice", { isLocked: true });
    const later = new Date(TABLE_AT.getTime() + 1);
    await expect(
      acceptTradeOffer(
        makeDb([a1, copy("b1", "bob", { inscribedAt: later })]).db as never,
        accept()
      )
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message:
        "A card you would give was signed after this offer was made. Send a counter-offer so the other player sees it.",
    });
    expect(lockCreditLegVaultsTx).not.toHaveBeenCalled();
    expect(transferCardsTx).not.toHaveBeenCalled();
    // Signed before the table, or as it was written: the proposer saw it
    for (const signedAt of [TABLE_AT, new Date(TABLE_AT.getTime() - 1)]) {
      await expect(
        acceptTradeOffer(
          makeDb([a1, copy("b1", "bob", { inscribedAt: signedAt })]).db as never,
          accept()
        )
      ).resolves.toBeDefined();
    }
    // The proposer's copies are locked from the table on, so nothing can sign them meanwhile
    await expect(
      acceptTradeOffer(
        makeDb([copy("a1", "alice", { isLocked: true, inscribedAt: later }), copy("b1", "bob")])
          .db as never,
        accept()
      )
    ).resolves.toBeDefined();
  });

  it("measures a signature against the current table, so a counter-offer shows what was signed before it", async () => {
    // Alice signed a1 after her first offer; Bob saw it and countered, asking for a1, an hour later
    const signedAt = new Date(TABLE_AT.getTime() + 60_000);
    const countered = { ...COUNTERED, updatedAt: new Date(TABLE_AT.getTime() + HOUR_MS) };
    const copies = [
      copy("a1", "alice", { inscribedAt: signedAt }),
      copy("b1", "bob", { isLocked: true }),
    ];
    await expect(
      acceptTradeOffer(
        makeDb(copies, { trade: countered }).db as never,
        accept(ALICE, { revision: 1 })
      )
    ).resolves.toBeDefined();
    // The transfer's CAS holds the same line, so a signature that commits after the read still fails the count
    expect(transferCardsTx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ fromId: "alice", notSignedAfter: countered.updatedAt })
    );
    // Signed after Bob's counter: Bob has not seen it
    const late = [
      copy("a1", "alice", { inscribedAt: new Date(countered.updatedAt.getTime() + 1) }),
      copy("b1", "bob", { isLocked: true }),
    ];
    await expect(
      acceptTradeOffer(
        makeDb(late, { trade: countered }).db as never,
        accept(ALICE, { revision: 1 })
      )
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("logs a one-sided table as a gift, which is never cross-realm", async () => {
    const gift = { ...PENDING, recipientCardIds: [], recipientCredits: 0 };
    const { db, tx } = makeDb([copy("a1", "alice", { isLocked: true })], { trade: gift });
    await acceptTradeOffer(db as never, accept());
    expect(jest.mocked(recordTradeTransfersTx).mock.calls.map(([, move]) => move.action)).toEqual([
      "GIFT",
      "GIFT",
    ]);
    expect(grantCardXp).toHaveBeenCalledWith(tx, "a1", "TRADE", expect.any(String), NOW);
    expect(tx.tradeOffer.update).toHaveBeenCalledWith({
      where: { id: "t1" },
      data: { isCrossRealm: false },
    });
    expect(tx.tradeOffer.count).not.toHaveBeenCalled();
  });

  it("gives double XP for a cross-realm trade once per trading partner per UTC day", async () => {
    const a1 = copy("a1", "alice", {
      isLocked: true,
      cards: cardOf(copy("a1", "alice"), { realmId: "iiwiki" }),
    });
    const { db, tx } = makeDb([a1, copy("b1", "bob")], { bonusUsed: 1 });
    await acceptTradeOffer(db as never, accept());
    expect(tx.tradeOffer.count).toHaveBeenCalledWith({
      where: {
        id: { not: "t1" },
        status: "ACCEPTED",
        isCrossRealm: true,
        respondedAt: { gte: DAY_START },
        initiatorId: { in: ["alice", "bob"] },
        recipientId: { in: ["alice", "bob"] },
      },
    });
    expect(jest.mocked(grantCardXp).mock.calls.map((call) => call[2])).toEqual(["TRADE", "TRADE"]);
    // Still a cross-realm trade, for the dividend
    expect(tx.tradeOffer.update).toHaveBeenCalledWith({
      where: { id: "t1" },
      data: { isCrossRealm: true },
    });
  });

  it("gives the trade amount, asking nothing more, when both sides come from the same realm", async () => {
    const { db, tx } = makeDb([copy("a1", "alice", { isLocked: true }), copy("b1", "bob")]);
    await acceptTradeOffer(db as never, accept());
    expect(tx.tradeOffer.count).not.toHaveBeenCalled();
    expect(jest.mocked(grantCardXp).mock.calls.map((call) => call[2])).toEqual(["TRADE", "TRADE"]);
  });

  it("turns a lost deadlock into a CONFLICT to try again, and passes any other failure through", async () => {
    const { db } = makeDb([copy("a1", "alice", { isLocked: true }), copy("b1", "bob")]);
    const deadlock = new Prisma.PrismaClientKnownRequestError("deadlock detected", {
      code: "P2034",
      clientVersion: "6",
    });
    jest.mocked(transferCardsTx).mockRejectedValueOnce(deadlock);
    await expect(acceptTradeOffer(db as never, accept())).rejects.toMatchObject({
      code: "CONFLICT",
      message: "Someone else was trading at the same moment. Try again.",
    });
    const boom = new Error("connection reset");
    jest.mocked(transferCardsTx).mockRejectedValueOnce(boom);
    await expect(acceptTradeOffer(db as never, accept())).rejects.toBe(boom);
    expect(notifyCards).not.toHaveBeenCalled();
  });

  it("is closed while trading is, and for an expired table", async () => {
    const copies = [copy("a1", "alice", { isLocked: true }), copy("b1", "bob")];
    jest
      .mocked(getVaultConfig)
      .mockResolvedValueOnce({ ...OPEN, isTradingEnabled: false } as never);
    await expect(acceptTradeOffer(makeDb(copies).db as never, accept())).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(
      acceptTradeOffer(
        makeDb(copies, { trade: { ...PENDING, expiresAt: NOW } }).db as never,
        accept()
      )
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(claimPendingTradeTx).not.toHaveBeenCalled();
  });

  it("hides a trade from anyone who is not a party", async () => {
    const { db } = makeDb([]);
    await expect(
      acceptTradeOffer(db as never, accept({ id: "carol", clerkUserId: "user_carol" }))
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    db.tradeOffer.findUnique.mockResolvedValueOnce(null);
    await expect(acceptTradeOffer(db as never, accept())).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
