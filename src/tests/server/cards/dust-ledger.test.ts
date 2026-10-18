/** @jest-environment node */
/**
 * The dust ledger: one balance per player and realm, credited in one statement that keeps the balance inside its Int
 * column (CardDustBalance.balance), spent only when it covers the amount, with one ledger row per copy or craft.
 */
import {
  creditDustTx,
  DustError,
  getDustBalances,
  MAX_DUST_BALANCE,
  spendDustTx,
  type DustEntry,
} from "~/server/modules/cards/workshop/dust-ledger";
import { makeWorkshopDb } from "~/tests/helpers/fake-workshop-db";

type Tx = ReturnType<typeof makeWorkshopDb>["tx"];

const credit = (tx: Tx, entries: DustEntry[]) =>
  creditDustTx(tx as never, { userId: "u1", realmId: "default", source: "BREAKDOWN", entries });

const flat = (sql: string) => sql.replace(/\s+/g, " ").trim();

describe("creditDustTx", () => {
  it("adds the entries to one realm balance and logs one event per entry with a running balance", async () => {
    const { tx, world } = makeWorkshopDb({ balances: { "u1:default": 100, "u1:iiwiki": 7 } });
    const entries = [
      { amount: 5, cardId: "c1", ownershipId: "o1" },
      // A copy that yields nothing gets no ledger row
      { amount: 0, cardId: "c3", ownershipId: "o3" },
      { amount: 15, cardId: "c2", ownershipId: "o2" },
    ];
    expect(await credit(tx, entries)).toBe(120);

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(world.balances).toEqual({ "u1:default": 120, "u1:iiwiki": 7 });
    expect(tx.cardDustEvent.createMany).toHaveBeenCalledWith({
      data: [
        {
          userId: "u1",
          realmId: "default",
          delta: 5,
          balanceAfter: 105,
          source: "BREAKDOWN",
          cardId: "c1",
          ownershipId: "o1",
        },
        {
          userId: "u1",
          realmId: "default",
          delta: 15,
          balanceAfter: 120,
          source: "BREAKDOWN",
          cardId: "c2",
          ownershipId: "o2",
        },
      ],
    });
  });

  it("creates the balance on a player's first dust of a realm, and an entry may name no card", async () => {
    const { tx, world } = makeWorkshopDb();
    expect(
      await creditDustTx(tx as never, {
        userId: "u1",
        realmId: "iiwiki",
        source: "CRAFT",
        entries: [{ amount: 40 }],
      })
    ).toBe(40);
    expect(world.balances).toEqual({ "u1:iiwiki": 40 });
    expect(world.dustEvents).toEqual([
      {
        userId: "u1",
        realmId: "iiwiki",
        delta: 40,
        balanceAfter: 40,
        source: "CRAFT",
        cardId: null,
        ownershipId: null,
      },
    ]);
  });

  it.each([
    ["with a balance", { "u1:default": 7 }, 7],
    ["with none yet", {}, 0],
  ])("writes nothing for a credit of nothing %s", async (_label, balances, held) => {
    const { tx, world } = makeWorkshopDb({ balances: { ...balances } });
    expect(await credit(tx, [{ amount: 0, cardId: "c1", ownershipId: "o1" }])).toBe(held);
    expect(await credit(tx, [])).toBe(held);
    expect(tx.cardDustBalance.findUnique).toHaveBeenCalledWith({
      where: { userId_realmId: { userId: "u1", realmId: "default" } },
      select: { balance: true },
    });
    expect(tx.$queryRaw).not.toHaveBeenCalled();
    expect(tx.cardDustEvent.createMany).not.toHaveBeenCalled();
    expect(world.balances).toEqual(balances);
  });

  it("creates or adds in one statement whose update holds only while the sum fits the column", async () => {
    const { tx } = makeWorkshopDb();
    await credit(tx, [{ amount: 20, cardId: "c1", ownershipId: "o1" }]);
    const [strings, ...values] = tx.$queryRaw.mock.calls[0]!;
    expect(flat(strings.join("?"))).toBe(
      flat(`INSERT INTO card_dust_balances ("userId", "realmId", balance, "updatedAt")
        VALUES (?, ?, ?::int, now())
        ON CONFLICT ("userId", "realmId") DO UPDATE
          SET balance = card_dust_balances.balance + EXCLUDED.balance, "updatedAt" = now()
          WHERE card_dust_balances.balance <= ?::int
        RETURNING balance`)
    );
    expect(values).toEqual(["u1", "default", 20, MAX_DUST_BALANCE - 20]);
  });

  it("credits up to 2,147,483,647 exactly", async () => {
    const { tx, world } = makeWorkshopDb({ balances: { "u1:default": MAX_DUST_BALANCE - 20 } });
    expect(await credit(tx, [{ amount: 20, cardId: "c1", ownershipId: "o1" }])).toBe(2_147_483_647);
    expect(world.balances["u1:default"]).toBe(MAX_DUST_BALANCE);
  });

  it("refuses a credit one dust past the ceiling and writes no ledger row", async () => {
    const { tx, world } = makeWorkshopDb({ balances: { "u1:default": MAX_DUST_BALANCE - 19 } });
    const refused = credit(tx, [{ amount: 20, cardId: "c1", ownershipId: "o1" }]);
    await expect(refused).rejects.toBeInstanceOf(DustError);
    await expect(refused).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "Your dust in this realm can't go past 2,147,483,647.",
    });
    expect(world.balances["u1:default"]).toBe(MAX_DUST_BALANCE - 19);
    expect(tx.cardDustEvent.createMany).not.toHaveBeenCalled();
  });

  it("refuses a credit that alone passes the ceiling before it reaches the column, and takes one that fills it", async () => {
    const big = makeWorkshopDb();
    await expect(
      credit(big.tx, [
        { amount: MAX_DUST_BALANCE, cardId: "c1", ownershipId: "o1" },
        { amount: 1, cardId: "c2", ownershipId: "o2" },
      ])
    ).rejects.toBeInstanceOf(DustError);
    expect(big.tx.$queryRaw).not.toHaveBeenCalled();
    expect(big.world.balances).toEqual({});

    const full = makeWorkshopDb();
    expect(await credit(full.tx, [{ amount: MAX_DUST_BALANCE, cardId: "c1" }])).toBe(
      MAX_DUST_BALANCE
    );
  });
});

function makeSpendTx(balance: number | null) {
  let held = balance;
  return {
    cardDustBalance: {
      updateMany: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { balance: { gte: number } };
          data: { balance: { decrement: number } };
        }) => {
          if (held === null || held < where.balance.gte) return { count: 0 };
          held -= data.balance.decrement;
          return { count: 1 };
        }
      ),
      findUnique: jest.fn(async () => (held === null ? null : { balance: held })),
      findUniqueOrThrow: jest.fn(async () => ({ balance: held })),
    },
    cardDustEvent: { create: jest.fn(async () => ({})) },
  };
}

const KEY = { userId_realmId: { userId: "u1", realmId: "default" } };

describe("spendDustTx", () => {
  it("takes the amount only when the balance covers it, and logs the spend", async () => {
    const tx = makeSpendTx(100);
    expect(
      await spendDustTx(tx as never, {
        userId: "u1",
        realmId: "default",
        amount: 40,
        source: "CRAFT",
        cardId: "c1",
      })
    ).toBe(60);
    expect(tx.cardDustBalance.updateMany).toHaveBeenCalledWith({
      where: { userId: "u1", realmId: "default", balance: { gte: 40 } },
      data: { balance: { decrement: 40 } },
    });
    expect(tx.cardDustBalance.findUniqueOrThrow).toHaveBeenCalledWith({
      where: KEY,
      select: { balance: true },
    });
    expect(tx.cardDustEvent.create).toHaveBeenCalledWith({
      data: {
        userId: "u1",
        realmId: "default",
        delta: -40,
        balanceAfter: 60,
        source: "CRAFT",
        cardId: "c1",
      },
    });
  });

  it("spends a balance down to nothing, and an event may name no card", async () => {
    const tx = makeSpendTx(40);
    expect(
      await spendDustTx(tx as never, {
        userId: "u1",
        realmId: "default",
        amount: 40,
        source: "CRAFT",
      })
    ).toBe(0);
    expect(tx.cardDustEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ delta: -40, balanceAfter: 0, cardId: null }),
    });
  });

  it.each([
    ["a balance short by one", 39],
    ["no balance at all", null],
  ])("refuses %s and logs nothing", async (_label, balance) => {
    const tx = makeSpendTx(balance);
    const refused = spendDustTx(tx as never, {
      userId: "u1",
      realmId: "default",
      amount: 40,
      source: "CRAFT",
    });
    await expect(refused).rejects.toBeInstanceOf(DustError);
    await expect(refused).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "You need 40 dust from this card's realm.",
    });
    expect(tx.cardDustEvent.create).not.toHaveBeenCalled();
  });

  it.each([
    ["with a balance", 25, 25],
    ["with none yet", null, 0],
  ])("spends nothing for a free craft %s, and logs nothing", async (_label, balance, after) => {
    const tx = makeSpendTx(balance);
    expect(
      await spendDustTx(tx as never, {
        userId: "u1",
        realmId: "default",
        amount: 0,
        source: "CRAFT",
      })
    ).toBe(after);
    expect(tx.cardDustBalance.findUnique).toHaveBeenCalledWith({
      where: KEY,
      select: { balance: true },
    });
    expect(tx.cardDustBalance.updateMany).not.toHaveBeenCalled();
    expect(tx.cardDustEvent.create).not.toHaveBeenCalled();
  });
});

describe("getDustBalances", () => {
  it("lists the player's dust per realm, most first, without empty balances", async () => {
    const db = {
      cardDustBalance: {
        findMany: jest.fn(async () => [
          { realmId: "iiwiki", balance: 90, realm: { name: "IIWiki", slug: "iiwiki" } },
          { realmId: "default", balance: 15, realm: { name: "Ixnay", slug: "ixnay" } },
        ]),
      },
    };
    expect(await getDustBalances(db as never, "u1")).toEqual([
      { realmId: "iiwiki", realmName: "IIWiki", realmSlug: "iiwiki", balance: 90 },
      { realmId: "default", realmName: "Ixnay", realmSlug: "ixnay", balance: 15 },
    ]);
    expect(db.cardDustBalance.findMany).toHaveBeenCalledWith({
      where: { userId: "u1", balance: { gt: 0 } },
      select: { realmId: true, balance: true, realm: { select: { name: true, slug: true } } },
      orderBy: [{ balance: "desc" }, { realmId: "asc" }],
    });
  });
});
