/** @jest-environment node */
/**
 * Card trades (spec §2.2, §2.3): one table per trade, real counter-offers on the same row, and accept settling every
 * copy and credit in one transaction. The transaction double gives writes only to `tx`: a write on `db` throws.
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
  lockCardsTx,
  recordTradeTransfersTx,
  transferCardsTx,
  unlockCardsTx,
} from "~/lib/vault/trade-settlement";
import { lockCreditLegVaultsTx, settleCreditLegTx } from "~/lib/cards/market/credit-leg";
import { grantCardXp } from "~/lib/cards/xp-utils";
import { notifyCard, notifyCards } from "~/lib/cards/card-notify";
import { refusesTradeOffer } from "~/server/shared/privacy-permissions";
import { getVaultConfig } from "~/lib/vault/vault-perks";
import {
  acceptTradeOffer,
  assertTradingOpen,
  cancelTradeOffer,
  counterTradeOffer,
  createTradeOffer,
  rejectTradeOffer,
  TRADE_TTL_MS,
} from "~/server/modules/cards/trading/trade-service";

const NOW = new Date("2026-11-02T12:00:00Z");
const DAY_START = new Date("2026-11-02T00:00:00Z");
const TABLE_AT = new Date("2026-11-02T11:00:00Z");
const NEXT_EXPIRY = new Date(NOW.getTime() + 86_400_000);
const HOUR_MS = 3_600_000;
const ALICE = { id: "alice", clerkUserId: "user_alice" };
const BOB = { id: "bob", clerkUserId: "user_bob" };
const OPEN = { isMaintenanceMode: false, isTradingEnabled: true };
const TRADES_HREF = "/vault/cards/market?tab=trades&trade=t1";

interface CopyRow {
  id: string;
  ownerId: string;
  isLocked: boolean;
  cardId: string;
  inscribedAt: Date | null;
  cards: {
    title: string;
    isBound: boolean;
    cardType: string;
    countryId: string | null;
    realmId: string;
  };
}

const copy = (id: string, ownerId: string, over: Partial<CopyRow> = {}): CopyRow => ({
  id,
  ownerId,
  isLocked: false,
  cardId: `card_${id}`,
  inscribedAt: null,
  cards: {
    title: `Title ${id}`,
    isBound: false,
    cardType: "LORE",
    countryId: null,
    realmId: "default",
  },
  ...over,
});
const cardOf = (row: CopyRow, over: Partial<CopyRow["cards"]>) => ({ ...row.cards, ...over });

/** Alice offered a1 for Bob's b1 and 300 of his IxC; Alice wrote the table, so a1 is locked. */
const PENDING = {
  id: "t1",
  initiatorId: "alice",
  recipientId: "bob",
  proposerId: "alice",
  revision: 0,
  initiatorCardIds: ["a1"],
  recipientCardIds: ["b1"],
  initiatorCredits: 0,
  recipientCredits: 300,
  status: "PENDING",
  message: null,
  isCrossRealm: false,
  expiresAt: new Date(NOW.getTime() + 3_600_000),
  createdAt: TABLE_AT,
  updatedAt: TABLE_AT,
};
/** The same trade after Bob countered: Bob wrote revision 1, so b1 is locked and Alice responds. */
const COUNTERED = { ...PENDING, proposerId: "bob", revision: 1 };

type Where = { id: { in: string[] }; ownerId: string };
type Select = Record<string, boolean | { select: Record<string, boolean> }>;
/** The columns a `select` names, as Prisma returns them (one level of relation). */
function picked(row: CopyRow, select: Select): Partial<CopyRow> {
  const entries = Object.entries(select).map(([key, how]) => {
    const value = row[key as keyof CopyRow];
    if (how === true) return [key, value];
    const nested = typeof how === "object" ? Object.keys(how.select) : [];
    return [
      key,
      Object.fromEntries(Object.entries(value ?? {}).filter(([k]) => nested.includes(k))),
    ];
  });
  return Object.fromEntries(entries);
}
const ownedBy = (copies: CopyRow[]) =>
  jest.fn(async ({ where, select }: { where: Where; select: Select }) =>
    copies
      .filter((c) => where.id.in.includes(c.id) && c.ownerId === where.ownerId)
      .map((c) => picked(c, select))
  );

function makeDb(
  copies: CopyRow[],
  options: { trade?: object | null; claimed?: number; bonusUsed?: number; credits?: number } = {}
) {
  const trade = options.trade === undefined ? PENDING : options.trade;
  const tx = {
    cardOwnership: { findMany: ownedBy(copies) },
    tradeOffer: {
      create: jest.fn(async ({ data }: { data: object }) => ({ id: "t1", ...data })),
      updateMany: jest.fn().mockResolvedValue({ count: options.claimed ?? 1 }),
      update: jest.fn(async ({ data }: { data: object }) => ({
        ...trade,
        ...data,
        status: "ACCEPTED",
      })),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ ...trade, revision: 99 }),
      count: jest.fn().mockResolvedValue(options.bonusUsed ?? 0),
    },
  };
  const db = {
    user: { findUnique: jest.fn().mockResolvedValue(BOB) },
    myVault: { findUnique: jest.fn().mockResolvedValue({ credits: options.credits ?? 10_000 }) },
    cardOwnership: { findMany: ownedBy(copies) },
    tradeOffer: { findUnique: jest.fn().mockResolvedValue(trade) },
    $transaction: jest.fn(async <T>(work: (t: typeof tx) => Promise<T>) => work(tx)),
  };
  return { db, tx };
}

const nameOf = jest.fn(async (userId: string) => `@${userId}`);
const offer = (table: object, over: object = {}) => ({
  initiator: ALICE,
  partnerId: "bob",
  table: {
    initiatorCardIds: ["a1"],
    recipientCardIds: ["b1"],
    initiatorCredits: 0,
    recipientCredits: 0,
    ...table,
  },
  now: NOW,
  nameOf,
  ...over,
});
const order = (...mocks: jest.Mock[]) => mocks.map((m) => m.mock.invocationCallOrder[0]);
const ascending = (values: Array<number | undefined>) =>
  values.every((v, i) => v !== undefined && (i === 0 || v > values[i - 1]!));

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getVaultConfig).mockResolvedValue(OPEN as never);
  jest.mocked(refusesTradeOffer).mockResolvedValue(false);
  jest.mocked(settleCreditLegTx).mockResolvedValue({ fee: 0, net: 0, royalties: [] });
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
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
    expect(tx.tradeOffer.create.mock.calls[0]![0].data.message).toBeNull();
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
    expect(transferCardsTx).toHaveBeenCalledWith(tx, {
      ids: ["b1"],
      fromId: "bob",
      toId: "alice",
      expectLocked: false,
      now: NOW,
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
