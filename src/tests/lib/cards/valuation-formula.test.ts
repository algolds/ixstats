/** @jest-environment node */
/**
 * Card values: the formula (`valueOfCopy`, a rarity floor times type and finish, the market median or an unsold
 * NationStates card's bank term, plus the level bonus; a retired card is worth 0), one per-copy value for many copies
 * (`loadCopyValues` and the deck totals every reader shares, trophies counted apart), and the card-values job that
 * rebuilds the medians from priced sales and rewrites each card's reference value under the revalue lock.
 *
 * Folds copy-value and market-values.
 */
jest.mock("~/server/db", () => ({ db: {} }));

import { Prisma } from "@prisma/client";
import {
  baseValue,
  CARD_VALUATION_DEFAULTS,
  CARD_VALUATION_DEFAULTS as cfg,
  valueOfCopy,
  levelBonus,
  type ValueCard,
} from "~/lib/cards/valuation";
import {
  deckValueOf,
  loadCopyValues
} from "~/lib/cards/copy-value";
import { recomputeMarketValues } from "~/server/modules/cards/market-values";

const card = (over: Partial<ValueCard> = {}): ValueCard => ({
  rarity: "RARE",
  cardType: "LORE",
  firstSoldAt: null,
  nsBankValue: null,
  isRetired: false,
  ...over,
});

describe("the value formula", () => {
  it("is floor x type x finish when nothing has sold", () => {
    expect(baseValue(card(), "STANDARD", null, cfg)).toBe(100);
    expect(baseValue(card(), "FOIL", null, cfg)).toBe(300);
    expect(baseValue(card(), "HOLO", null, cfg)).toBe(900);
    expect(baseValue(card({ cardType: "NATION" }), "STANDARD", null, cfg)).toBe(150);
    expect(baseValue(card({ cardType: "SPECIAL" }), "STANDARD", null, cfg)).toBe(200);
    expect(baseValue(card({ cardType: "TROPHY", rarity: "EPIC" }), "SERIALISED", null, cfg)).toBe(
      250
    );
  });

  it("takes the market median when it is higher", () => {
    expect(baseValue(card(), "STANDARD", 180, cfg)).toBe(180);
    expect(baseValue(card(), "FOIL", 180, cfg)).toBe(300);
  });

  it("keeps the NS bank term only until the card first sells here", () => {
    const ns = card({ cardType: "NS", rarity: "COMMON", nsBankValue: 40 });
    expect(baseValue(ns, "STANDARD", null, cfg)).toBe(60);
    expect(baseValue({ ...ns, firstSoldAt: new Date("2026-11-01") }, "STANDARD", null, cfg)).toBe(
      10
    );
    expect(baseValue(card({ nsBankValue: 999 }), "STANDARD", null, cfg)).toBe(100);
  });

  it("adds 2% per level above 1, capped at 20%, on top of the max", () => {
    expect(levelBonus(1, cfg)).toBe(0);
    expect(levelBonus(5, cfg)).toBeCloseTo(0.08);
    expect(levelBonus(10, cfg)).toBeCloseTo(0.18);
    expect(levelBonus(99, cfg)).toBeCloseTo(0.18);
    expect(levelBonus(10, { ...cfg, levelBonusPerLevel: 0.05 })).toBe(0.2);
    expect(valueOfCopy({ card: card(), finish: "FOIL", level: 6, median: null }, cfg)).toBe(330);
  });

  it("gives a retired card's copy no value, whatever its finish, level, median or bank value", () => {
    const retired = card({ cardType: "NS", nsBankValue: 5000, isRetired: true });
    expect(valueOfCopy({ card: retired, finish: "HOLO", level: 10, median: 900 }, cfg)).toBe(0);
    expect(
      valueOfCopy(
        { card: card({ isRetired: true }), finish: "STANDARD", level: 1, median: null },
        cfg
      )
    ).toBe(0);
  });
});

describe("one value per copy", () => {
  type Finish = "STANDARD" | "FOIL" | "HOLO" | "SERIALISED";

  interface Copy {
    id: string;
    ownerId: string;
    cardId: string;
    finish: Finish;
    level: number;
  }

  interface CardRow {
    id: string;
    rarity: string;
    cardType: string;
    firstSoldAt: Date | null;
    isRetired: boolean;
  }

  const CARDS: CardRow[] = [
    { id: "rare", rarity: "RARE", cardType: "LORE", firstSoldAt: null, isRetired: false },
    { id: "ns", rarity: "COMMON", cardType: "NS", firstSoldAt: null, isRetired: false },
    { id: "trophy", rarity: "EPIC", cardType: "TROPHY", firstSoldAt: null, isRetired: false },
  ];

  interface Extra {
    cards?: CardRow[];
    banks?: Array<{ id: string; bank: number | null }>;
    medians?: Array<{ cardId: string; finish: Finish; median: number }>;
  }

  type IdsArgs = { where: { id: { in: string[] } } };

  function makeDb(copies: Copy[], extra: Extra = {}) {
    const cards = extra.cards ?? CARDS;
    return {
      systemConfig: { findMany: jest.fn().mockResolvedValue([]) },
      cardOwnership: { findMany: jest.fn().mockResolvedValue(copies) },
      card: {
        findMany: jest.fn(async ({ where }: IdsArgs) =>
          cards.filter((c) => where.id.in.includes(c.id))
        ),
      },
      cardMarketPrice: { findMany: jest.fn().mockResolvedValue(extra.medians ?? []) },
      $queryRaw: jest.fn().mockResolvedValue(extra.banks ?? []),
    };
  }

  const copy = (
    id: string,
    cardId: string,
    finish: Finish = "STANDARD",
    level = 1,
    ownerId = "u1"
  ) => ({
    id,
    ownerId,
    cardId,
    finish,
    level,
  });

  describe("copy values", () => {
    it("values each copy by finish, level, its finish's median and the NS term", async () => {
      const db = makeDb([copy("a", "rare", "FOIL", 6), copy("b", "rare"), copy("c", "ns")], {
        banks: [{ id: "ns", bank: 40 }],
        medians: [{ cardId: "rare", finish: "STANDARD", median: 400 }],
      });
      const values = await loadCopyValues(db as never, { ownerIds: ["u1"] });
      // a: Rare floor 100 x Foil 3 = 300, +10% at level 6 = 330. The Standard median (400) is not its finish's, so it
      // would wrongly give 440. b: the Standard median 400 beats the floor 100. c: the NS term 40 x 1.5 = 60 beats the
      // Common floor 10.
      expect(values).toEqual([
        {
          ownershipId: "a",
          ownerId: "u1",
          cardId: "rare",
          cardType: "LORE",
          finish: "FOIL",
          value: 330,
        },
        {
          ownershipId: "b",
          ownerId: "u1",
          cardId: "rare",
          cardType: "LORE",
          finish: "STANDARD",
          value: 400,
        },
        {
          ownershipId: "c",
          ownerId: "u1",
          cardId: "ns",
          cardType: "NS",
          finish: "STANDARD",
          value: 60,
        },
      ]);
      expect(db.cardOwnership.findMany).toHaveBeenCalledWith({
        where: { ownerId: { in: ["u1"] }, cards: { isRetired: false } },
        select: { id: true, ownerId: true, cardId: true, finish: true, level: true },
      });
      expect(db.card.findMany).toHaveBeenCalledWith({
        where: { id: { in: ["rare", "ns"] } },
        select: { id: true, rarity: true, cardType: true, firstSoldAt: true, isRetired: true },
      });
      expect(db.cardMarketPrice.findMany).toHaveBeenCalledWith({
        where: { cardId: { in: ["rare", "ns"] } },
        select: { cardId: true, finish: true, median: true },
      });
    });
    it("leaves retired cards out, and values a retired card's copy at 0 if one is read", async () => {
      const cards: CardRow[] = [
        { id: "gone", rarity: "LEGENDARY", cardType: "LORE", firstSoldAt: null, isRetired: true },
      ];
      const db = makeDb([copy("g", "gone", "HOLO", 10)], { cards });
      const values = await loadCopyValues(db as never, { ownershipIds: ["g"] });
      expect(values.map((v) => v.value)).toEqual([0]);
      expect(db.cardOwnership.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: { in: ["g"] }, cards: { isRetired: false } } })
      );
    });
  });

  describe("deck values", () => {
    it("totals a deck with and without trophies", async () => {
      const db = makeDb([copy("a", "rare"), copy("t", "trophy", "SERIALISED")]);
      // The trophy: Epic floor 1000 x trophy 0.25 = 250.
      expect(await deckValueOf(db as never, "u1")).toEqual({ total: 350, exTrophy: 100 });
    });
  });
});

describe("the card-values job", () => {
  const NOW = new Date("2026-11-02T00:00:00Z");

  type RawCall = Parameters<typeof Prisma.sql>;

  /** A raw call as one SQL text with its parameters written in, so a test reads which number feeds which branch. */
  function inlined(call: RawCall): string {
    const sql = Prisma.sql(...call);
    return sql.text.replace(/\$(\d+)/g, (_match, n: string) => String(sql.values[Number(n) - 1]));
  }

  /** A client whose transaction runs on itself and records the order of its lock, config read and writes. */
  function makeDb(
    saleRows: Array<{ cardId: string; finish: string; price: number }>,
    {
      changed = [{ id: "card_1", value: 210 }],
      config = [] as Array<{ key: string; value: string }>,
    } = {}
  ) {
    const order: string[] = [];
    const step =
      <T>(name: string, result: T) =>
      async () => {
        order.push(name);
        return result;
      };
    const db = {
      $executeRaw: jest.fn<Promise<number>, RawCall>(step("lock", 1)),
      systemConfig: { findMany: jest.fn(step("read", config)) },
      $queryRaw: jest
        .fn<Promise<object[]>, RawCall>()
        .mockImplementationOnce(step("sales", saleRows))
        .mockImplementationOnce(step("update", changed)),
      cardMarketPrice: {
        deleteMany: jest.fn(step("delete", { count: 0 })),
        createMany: jest.fn(step("create", { count: saleRows.length })),
      },
      cardValueHistory: { createMany: jest.fn(step("history", { count: changed.length })) },
      $transaction: jest.fn(
        async (
          run: (tx: object) => Promise<object>,
          _options: { timeout: number }
        ): Promise<object> => run(db)
      ),
    };
    return { db, order };
  }

  const salesSql = (db: ReturnType<typeof makeDb>["db"]) => db.$queryRaw.mock.calls[0]!;
  const valueSql = (db: ReturnType<typeof makeDb>["db"]) => inlined(db.$queryRaw.mock.calls[1]!);
  describe("recomputeMarketValues", () => {
    it("reads only the last N priced sales within the window, then rebuilds prices and reference values", async () => {
      const { db } = makeDb([{ cardId: "card_1", finish: "STANDARD", price: 210 }]);
      expect(await recomputeMarketValues(db as never, NOW)).toEqual({ prices: 1, updated: 1 });

      const sales = inlined(salesSql(db));
      expect(sales).toContain('row_number() OVER (PARTITION BY e."cardId", e.finish');
      expect(sales).toContain("e.price IS NOT NULL AND e.finish IS NOT NULL");
      expect(sales).toContain("e.action IN (AUCTION_END,AUCTION_BUYOUT,LISTING_SALE)");
      expect(sales).toContain(`WHERE rn <= ${CARD_VALUATION_DEFAULTS.medianSales}::int`);
      // The 30-day window
      expect(salesSql(db)).toContainEqual(new Date("2026-10-03T00:00:00Z"));

      expect(db.cardMarketPrice.deleteMany).toHaveBeenCalledWith({});
      expect(db.cardMarketPrice.createMany).toHaveBeenCalledWith({
        data: [{ cardId: "card_1", finish: "STANDARD", median: 210, sales: 1, computedAt: NOW }],
      });

      const values = valueSql(db);
      expect(values).toContain(`UPDATE cards c SET "marketValue" = v.value`);
      expect(values).toContain(
        `LEFT JOIN card_market_prices p ON p."cardId" = c2.id AND p.finish = 'STANDARD'`
      );
      expect(db.cardValueHistory.createMany).toHaveBeenCalledWith({
        data: [{ cardId: "card_1", value: 210, recordedAt: NOW }],
      });
    });
    it("reads only sales of cards that still exist, so one orphan sale can never fail the price rebuild", async () => {
      // card_transfer_events.cardId has no foreign key; card_market_prices.cardId has one
      const { db } = makeDb([]);
      await recomputeMarketValues(db as never, NOW);
      const sales = inlined(salesSql(db)).replace(/\s+/g, " ");
      expect(sales).toContain(
        `FROM card_transfer_events e JOIN cards c ON c.id = e."cardId" WHERE`
      );
    });

    it("runs one at a time: it takes the revalue lock, reads the stored config, then writes, in one transaction", async () => {
      const { db, order } = makeDb([{ cardId: "card_1", finish: "STANDARD", price: 210 }]);
      await recomputeMarketValues(db as never, NOW);
      expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), { timeout: 60_000 });
      expect(order).toEqual(["lock", "read", "sales", "delete", "create", "update", "history"]);
      const lock = inlined(db.$executeRaw.mock.calls[0]!);
      expect(lock).toBe("SELECT pg_advisory_xact_lock(7336::int, 0)");
    });
    it("rounds to the cent as referenceValue does, and rewrites only cards whose value moved", async () => {
      const { db } = makeDb([]);
      await recomputeMarketValues(db as never, NOW);
      const sql = valueSql(db).replace(/\s+/g, " ");
      expect(sql).toMatch(
        /SELECT c2\.id, FLOOR\(GREATEST\(.*\) \* 100 \+ 0\.5\) \/ 100 AS value FROM cards c2/
      );
      expect(sql).toContain(`WHERE v.id = c.id AND c."marketValue" IS DISTINCT FROM v.value`);
      expect(sql).toContain("RETURNING c.id, v.value");
    });
  });
});
